# Design

## Context

Today the acting player comes from `X-Player-Id` (`backend/app/api/players.py` `current_player`, `CurrentPlayerDep`),
which every game endpoint depends on. `Player` has `id`, `name`, unique `email`; migration `0001` inserts `Клієнт`
and `Тренер`. The frontend keeps the chosen id in `localStorage` (`src/playerStore.ts`), shows `PlayerPicker` when
there is none, and every function in `src/api/games.ts` takes `playerId` to build its headers; a `401` throws
`UnknownPlayerError`, which sends the user back to the picker. The new-game form sends `opponent_email` and lists
emails from `GET /api/players`. All backend tests send `X-Player-Id` directly.

The proposal's five decisions are open; this design follows the recommended option of each and says where another
answer would change it.

## Goals / Non-Goals

**Goals:**
- One place on the server that turns `Authorization: tma <initData>` into a verified Telegram user, and one dependency
  that turns it into a registered player; every endpoint uses them.
- No code path that accepts an unsigned identity, in any environment.
- The player stays separate from the Telegram account, so another login method is a new table, not a rewrite.
- Every existing scenario keeps its behaviour; only how the actor is named changes.

**Non-Goals:**
- Fly.io, the game bot, `fly secrets` (the hosting change).
- Invitations and known opponents (the next change); the temporary player list is not polished beyond the spec.
- `creator` → `organizer` (decision 4: separate change).
- Telegram UI integration: `telegram-web-app.js`, theme colours, `BackButton`, `ready()`/`expand()`. The page works
  inside Telegram without them; they can come with the hosting change if wanted.
- Changing one's name after registration (spec: out of scope).

## Decisions

### D1. Signature check is a pure function in `app/auth.py`

`verify_init_data(raw, bot_token, now) -> TelegramUser | None` does only the check from `telegram-auth`: parse the
query string with `urllib.parse.parse_qsl(raw, keep_blank_values=True, strict_parsing=True)`, reject duplicate keys,
take out `hash`, build the data-check-string from all other pairs (including `signature`) sorted by key, compare
`hmac.compare_digest(hex(HMAC_SHA256(secret, dcs)), hash)` with `secret = HMAC_SHA256(key=b"WebAppData",
msg=bot_token)`, then check `auth_date` (whole number, `now − auth_date ≤ 86400`) and that `user` is a JSON object
with an integer `id`. Any failure is `None` — the caller does not learn which check failed, and neither does the
client (one `401` detail). No library: the standard library covers it, and it is ~30 lines that the tests pin down.

It lives apart from FastAPI so it is tested like `rules.py`: table tests for each rejection, plus one fixture signed
by a reference implementation in the test helper (the same helper that signs logins for API tests).

Alternative: a package such as `init-data-py` — rejected as a new dependency for a small, well-specified check.

### D2. Two dependencies: `TelegramUserDep` and `CurrentPlayerDep`

- `telegram_user(request, authorization: Header)` → `TelegramUser` or `401 Invalid Telegram login`. Reads the header
  as a string so a malformed value is a `401`, not a `422` (same reason as today's `X-Player-Id`). Used by `/api/me`.
- `current_player(session, tg_user)` → `Player` via `TelegramAccount`, or `403 Not registered`. Replaces today's
  `current_player`; `CurrentPlayerDep` keeps its name, so the game endpoints only change their imports.

Both live in `app/auth.py`; `app/api/players.py` keeps the player endpoints.

### D3. The login is checked on every request (decision 3)

The frontend sends the same `initData` with each request; the server verifies it each time (an HMAC — negligible
cost). No session table, no cookie, no extra secret, and nothing to invalidate: reopening the Mini App yields a fresh
`initData`. 24 hours is long enough for a game screen left open during a gym visit and short enough that a leaked
header expires the next day. The `Authorization` header is never logged by the app.

If the human picks a session instead, D3 is replaced by `POST /api/login` (verify once, set an HttpOnly `SameSite=Lax`
cookie with a random session id stored in a `session` table) and the frontend stops sending the header; the specs'
"with header `Authorization: tma <t1>`" lines become "with the session cookie".

### D4. Bot token: `create_app(bot_token=...)`, checked at startup

`create_app()` gets `bot_token: str | None` and stores it on `app.state`; the lifespan raises
`RuntimeError("TELEGRAM_BOT_TOKEN is not set")` before migrating when it is empty. The module-level `app` passes
`os.environ.get("TELEGRAM_BOT_TOKEN")`, so importing `app.main` in tests does not need the variable — tests pass the
token `123456:TEST-TOKEN` explicitly. Failing in the lifespan (not at import) gives the clear message in
`docker compose up` logs and keeps the scenario testable with `TestClient`.

### D5. Data model and migration `0003`

- `Player(id, name)` — `email` dropped.
- `TelegramAccount(telegram_user_id BIGINT PRIMARY KEY, player_id FK UNIQUE, created_at)`. Telegram user ids exceed
  32 bits, hence `BIGINT`; the primary key is the "one account → one player" rule, the unique `player_id` keeps it
  one-to-one for now. A future `EmailAccount` would be a sibling table.
- `0003_telegram_accounts`: `DELETE FROM guess`, `round`, `game`, `player` (in FK order; before v2 only the two
  default players exist, so "all" equals "the defaults and their games"), drop `player.email` with
  `op.batch_alter_table` (SQLite cannot drop a column with a unique constraint in place), create `telegram_account`.
  Downgrade restores the schema (adds a nullable `email`, drops `telegram_account`) but not the deleted rows.
- `POST /api/me` inserts the player and the account in one transaction; an `IntegrityError` on the account (double
  tap, two tabs) is turned into `409 Already registered`, the same pattern as `Already guessed`.

### D6. Opponent by id, from a temporary list (decision 5)

`GameCreate.opponent_email` → `opponent_id: int`; the two `422` details stay. `GET /api/players` returns
`PlayerRef`-shaped `{"id", "name"}` for all players except me, by id, behind `CurrentPlayerDep`. The endpoint and the
select are marked in code as temporary (to be replaced by known opponents in the invitations change), so the next
change deletes rather than extends them.

### D7. Frontend: `src/telegram.ts` owns `initData`

- `takeInitData()` runs once at startup (before the router): if `location.hash` has `tgWebAppData`, store it in
  `sessionStorage` (`gym-challenge.init-data`) and `history.replaceState` the address without the fragment, so the
  router sees a clean path; otherwise read `sessionStorage`. `sessionStorage` (per tab) matches Telegram's own
  behaviour on reload; storage errors fall back to memory, as `playerStore.ts` does today.
- `firstName(initData)` parses `user` only to prefill `Твоє ім'я` (never trusted; the server decides).
- `src/api/*` functions take `initData: string` instead of `playerId: number` and send `Authorization: tma …`; a `401`
  throws `LoginRefusedError` (renamed from `UnknownPlayerError`), handled where `onUnknownPlayer` is today.
- `PlayerSession` becomes a small state machine: `outside` (no `initData`) → `loading` (`GET /api/me`) →
  `register` (404) | `ready` (200, player) | `refused` (401) | `unreachable` (other failure). `ready` renders the
  existing routes keyed by player id. `PlayerPicker`, `playerStore` and `Змінити гравця` are deleted.
- `NewGameForm` replaces the email field and hint with the select; `PlayerSession` loads `GET /api/players` only when
  the form is shown (it now needs a login).

Reading the launch parameters ourselves instead of loading `https://telegram.org/js/telegram-web-app.js` avoids a
third-party script on every page and keeps the dev link (D9) working with no Telegram objects at all.

### D8. Tunnel as a Compose profile (decision 1)

`docker-compose.yml` gets a `tunnel` service in profile `tunnel`: official image `ngrok/ngrok` pinned to an exact
version, `command: http app:8000 --url=${NGROK_URL}`, `NGROK_AUTHTOKEN` from `.env`. Run:
`docker compose --profile tunnel up --build`. The `app` service gets
`TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:-local-dev-token}`: with the dev bot's token in `.env` the app accepts
Telegram logins through the tunnel; without it, only dev links (D9). `.env.example` lists the three names with empty
values. `docs/telegram-dev.md` (Ukrainian) gives the @BotFather steps (create the dev bot, set the Mini App / menu
button URL to `https://$NGROK_URL`) and the run commands.

If the human picks cloudflared: the service becomes `cloudflare/cloudflared` with
`tunnel --no-autoupdate --url http://app:8000`, no token variables, and the docs say to copy the printed
`trycloudflare.com` address into @BotFather each session.

### D9. Local login without Telegram: a signed link, no bypass (decision 2)

`scripts/dev-login-link.mjs --id 1001 --name Іван [--base http://localhost:8000]` signs `initData` (`auth_date` now,
`user`) with `local-dev-token` using Node's `crypto` and prints `<base>/#tgWebAppData=<urlencoded>`. It refuses any
other token, so it cannot be pointed at a real bot by mistake, and it never reads `.env`. The server code has no
development branch: the link works only because Compose started the app with the non-secret local token. Playwright
checks open this link; two different `--id` values give two players in two browser contexts.

### D10. Tests act through signed logins

`backend/tests/conftest.py` gets `BOT_TOKEN = "123456:TEST-TOKEN"`, `sign_init_data(user_id, first_name="Іван",
age=60, token=BOT_TOKEN, extra=None) -> str`, `login(user_id) -> dict[str, str]` (the header), and a fixture that
registers the test players `Клієнт` (1001), `Тренер` (1002) — and `Гість` (1003) where a scenario names it — through
`POST /api/me`, exposing `as_player(n)`. Every `{"X-Player-Id": "1"}` in the existing tests becomes `as_player(1)`;
assertions stay. The upgrade scenario builds a database at revision `0002` with Alembic, inserts the MVP rows, then
starts the app on it.

Frontend tests get a helper that sets `location.hash` to `#tgWebAppData=<t1>` (or `t2`) and answers `GET /api/me`;
`sessionStorage` is cleared between tests.

## Risks / Trade-offs

- [`initData` is a bearer credential for 24 h] A copied header lets someone act as that player until it expires. →
  HTTPS only outside localhost (ngrok, Fly), the app does not log headers, the window is short; a session (decision 3,
  alternative) would shorten it at the cost of state.
- [Clock skew] A server clock behind Telegram's would reject fresh logins only if off by a day; ahead is harmless. →
  Accepted; Docker uses the host clock.
- [ngrok warning page] The free plan shows an interstitial on the first browser visit in the Telegram web view. →
  Dev bot only, one tap; documented. cloudflared avoids it at the cost of a changing URL.
- [Temporary list leaks names] Anyone who opens the dev bot sees every registered name. → Only the dev bot exists
  until the hosting change, which comes after invitations remove the list.
- [Same names] Two players called `Іван` look the same in the select. → Accepted for the temporary list; known
  opponents will carry context (shared games).
- [Lost local data] The upgrade deletes all games. → Agreed in spec v2.0; the data was test data.
- [Large test diff] Every backend test changes its headers. → Mechanical, one helper; the reviewer can diff
  assertions separately from headers.

## Migration Plan

1. `docker compose up --build` on the existing volume runs `0003`: old players and games are deleted, schema updated.
2. Without `.env`: the app runs with `local-dev-token`; open the dev link. With the dev bot token in `.env` and
   `--profile tunnel`: open the bot in Telegram.
3. Rollback: check out the previous commit and `docker compose down -v` (the downgrade cannot bring back the deleted
   players; a fresh volume recreates the MVP state).

## Open Questions

- Exact pinned `ngrok/ngrok` image tag — chosen at implementation time (latest release at least two weeks old).
