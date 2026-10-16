# Design

## Context

- `Game.opponent_id` is `NOT NULL`; `create_game` (`backend/app/api/games.py`) checks that `opponent_id` is an existing
  player other than me, inserts the game and its round `1` in one transaction. Design D2 of `add-rounds-and-scoring`:
  an active game always has exactly one round with `actual IS NULL`.
- `GameState.players` is the pair `(organizer_id, opponent_id)`; `settle()` in `rules.py` and every per-player list
  (`score`, `guesses`) are built from it.
- `GET /api/players` (`app/api/players.py`, marked temporary) feeds the select in `NewGameForm`.
- The web app takes `initData` from `#tgWebAppData=…` once per launch (`src/telegram.ts`, `takeInitData`), keeps it in
  `sessionStorage`, and `PlayerSession` is a small state machine `loading → register | ready | refused | unreachable`.
- The game screen polls `GET /api/games/{id}` every 3 s unless the game is finished (`src/game/useGame.ts`).
- `create_app(bot_token=…)` stores the token on `app.state`; the lifespan refuses to start without it.

The proposal's six decisions are open; this design follows the recommended option of each and notes where another
answer changes it.

## Goals / Non-Goals

**Goals:**
- A waiting game is an ordinary `Game` row with no opponent and no rounds; joining turns it into exactly the game that
  `POST /api/games` with an opponent creates today, so rounds and scoring do not change.
- Exactly one player can win the join, also under two simultaneous requests.
- The token is never shown to anyone but the organizer, and never logged in a URL path.
- No new dependency; no Telegram script.

**Non-Goals:**
- Fly.io and the game bot (the hosting change) — only `TELEGRAM_BOT_USERNAME` is introduced, ready for it.
- Expiry or cancelling of invites (decision 3), a confirmation step for the invitee (decision 4).
- Telegram bot messages or notifications (spec: out of scope).
- Telegram theme, `BackButton`, `telegram-web-app.js` (decision 2).

## Decisions

### D1. Data model: two columns on `game`, migration `0005_game_invites`

- `game.opponent_id` becomes nullable; new `game.invite_token VARCHAR(32) NULL UNIQUE`.
- `status` gets the value `"waiting"` (the column is a plain string; no check constraint exists today).
- Migration with `op.batch_alter_table("game")` (SQLite cannot change nullability in place). Existing rows keep their
  opponent, `invite_token` `NULL`. Downgrade deletes waiting games (they have no opponent), drops the column and makes
  `opponent_id` `NOT NULL` again.
- The token stays on the game after the join: that is what tells «already used» (409) from «not found» (404) and
  lets the opponent reopen the link (200).

Alternative (decision 3): an `invite` table `(token PK, game_id UNIQUE, created_at, used_at)` — only worth it with
expiry or several invites per game.

### D2. Token and link

`secrets.token_urlsafe(16)` → 22 characters of `A-Za-z0-9_-`, 128 random bits: unguessable and within Telegram's
`startapp` limits (same alphabet, ≤ 512). A collision with the unique index is practically impossible; the insert is
not retried. `invite_url = f"https://t.me/{bot_username}?startapp={token}"` is computed in `to_detail` only when the
viewer is the organizer **and** the game is waiting; otherwise `null`. The list (`GamePublic`) and the create
response do not carry it: the app always opens the game screen after creating a game, and the list does not need it.

### D3. Create: `opponent_id` optional, known opponents only

`GameCreate.opponent_id: int | None = None` (strict int when present).

- `None` → `Game(status="waiting", opponent_id=None, invite_token=…)`, no round.
- an id → own id: `422 Cannot play against yourself`; not in `known_opponent_ids(me)`: `422 Opponent not found`
  (also for a non-existent id, so the endpoint does not reveal which ids exist); else as today, game and round `1`.

`known_opponent_ids` / `GET /api/opponents` share one query: from games where `opponent_id IS NOT NULL` and I am
organizer or opponent, take the other id, group by it, order by `MAX(game.id) DESC` (id order = creation order), join
`player` for names. It lives in `app/api/players.py`, replacing `list_other_players`, behind `CurrentPlayerDep`.

### D4. Join: `POST /api/games/join` with the token in the body

`{"token": StrictStr}` in the body, not in the path: tokens then do not appear in access logs or the ngrok inspector's
URL column. Steps:

1. `SELECT game WHERE invite_token = :token` → none: `404 Invite not found`.
2. I am the organizer or already the opponent → `200` with `detail_for(game, me)` (no change).
3. Opponent already set → `409 Invite already used`.
4. `UPDATE game SET opponent_id = :me, status = 'active' WHERE id = :id AND opponent_id IS NULL`; `rowcount == 0`
   means another join won in between → rollback, refresh, go to step 2 (gives 200 or 409). Otherwise insert
   `Round(number=1)` and commit together — the D2 invariant of `add-rounds-and-scoring` holds from the first active
   moment.

Same guarded-update pattern as `enter_actual` (design D3 there). The route is declared before `/{game_id}` routes;
there is no other `POST /games/{x}` with one segment, so no clash, and the `/api` fallback still answers 405/404 for
the rest.

Alternative: take the token from the signed `start_param` in `initData` instead of the body — no gain (the token
itself is the secret, the login is checked anyway) and the web app could not join after the name form without
re-reading it; rejected.

### D5. Responses and moves for a waiting game

- `GamePublic.opponent: PlayerRef | None`, `status: Literal["waiting", "active", "finished"]`.
- `GameState.players` returns `()` while `opponent_id is None`; `to_public` then gives `score=[]`, `winner_id=None`
  without calling `settle()`; `to_detail` gives `rounds=[]`, `current_round=None`, `final_penalty=None`.
- `make_guess`: after `my_game`, `status == "waiting"` → `409 Waiting for opponent` (before the finished check, which
  cannot be true then anyway). `enter_actual`: organizer check first (as today), then the same `409`.
- `players_by_id` skips `None`.

### D6. Bot username in config (decision 1)

`create_app(bot_token=…, bot_username=…)`; the module-level app reads `TELEGRAM_BOT_USERNAME`; the lifespan raises
`RuntimeError("TELEGRAM_BOT_USERNAME is not set")` after the token check, before migrating. Compose:
`TELEGRAM_BOT_USERNAME: ${TELEGRAM_BOT_USERNAME:-local_dev_bot}` — a placeholder that makes local links look real but
point nowhere; locally one joins with the dev link (D10). The human adds the variable (with the dev bot's username)
to `.env` and its name to `.env.example`. Tests pass `gym_test_bot`.

If the human picks a named Mini App instead, the link becomes `https://t.me/{bot}/{app}?startapp=…` with a second
variable `TELEGRAM_MINI_APP_NAME`; nothing else changes.

### D7. Web app: the start parameter belongs to the launch, not to the tab

- `takeInitData()` returns `{ initData, startParam }`. `startParam` is read from the `start_param` field of the
  launched `initData` (the same value Telegram also puts into `tgWebAppStartParam`) **only when** `initData` came from
  the fragment; from `sessionStorage` it is always `null`, so a reload never joins again. The launch also removes
  `tgWebAppStartParam` from the query, as it already removes the fragment.
- `PlayerSession` gets one more state, `joining` (with the token), entered from `loading` (on `200`) or from
  `register` (after `201`) when `startParam` is set. It calls `joinGame(initData, token)`:
  `200` → `ready` and `navigate("/games/{id}", { replace: true })`; `409` / `404` / other → `join-failed` with its
  message and a `Мої ігри` link that goes to `ready` at `/`.
- `src/api/games.ts`: `joinGame`, `Game.opponent: Player | null`, `status` with `"waiting"`,
  `GameDetail.invite_url: string | null`; `src/api/players.ts`: `fetchPlayers` → `fetchOpponents`
  (`GET /api/opponents`).

### D8. Web app: form, list and the waiting screen (decisions 2 and 5)

- `NewGameForm`: the select's first option `Запросити за посиланням` has the value `""`; on submit an empty value
  omits `opponent_id` from the body. The «no players» note and the disabled button go; a failed list shows its note
  and keeps the invite option.
- `GameList`: `other = …` is `null` for a waiting game → `Чекаємо суперника` in place of the name, no `Рахунок`.
- `GameScreen`: when `status === "waiting"` render a `WaitingForOpponent` block (text, link, buttons) instead of the
  score and the round. The share link is built with `encodeURIComponent` (`URLSearchParams` would encode spaces as
  `+`, which the spec does not expect) and opens with `target="_blank" rel="noopener"`. Copy uses
  `navigator.clipboard.writeText`; any rejection or a missing `navigator.clipboard` shows the manual-copy text.
- `useGame` already polls every game that is not finished, so a waiting game refreshes every 3 s and becomes round 1
  when the opponent joins; nothing to change there. `game/view.ts` functions that assume an opponent are only
  called for active/finished games.

### D9. Backend tests: games are started through an invite

`conftest.py` gets `invite(as_player) -> (game_id, token)` (create without opponent, parse the token from
`invite_url`) and `share_game(org, opp, **settings) -> game_id` (invite + join). Every test that today creates a game
with `opponent_id` for players who have never played — most of `test_rounds.py`, `test_games.py`, the scoring
scenario — uses `share_game` instead; the assertions stay. Tests that need a *second* game with a known opponent post
`opponent_id` as before. The migration test builds a database at `0004` with Alembic and starts the app on it.

### D10. Local check: `dev-login-link.mjs --start <token>` and Playwright (decision 6)

`--start` (validated against `^[A-Za-z0-9_-]{1,512}$`) adds `start_param` to the signed fields — so the data-check
string matches what Telegram would sign — and `?tgWebAppStartParam=<token>` before the fragment, as Telegram does.
Playwright: context A (`--id 1001`) creates an invite and reads the link from the screen; context B (`--id 1002
--start <token>`) registers and lands in round 1; both play one round; a third context (`--id 1003 --start <token>`)
gets «already used». The hybrid run (Telegram + dev link) is not possible by design (proposal, decision 6).

## Risks / Trade-offs

- [The link is a bearer ticket] Whoever opens it first becomes the opponent, e.g. if it is posted to a group. →
  The spec's rule; the organizer sees who joined at once. Expiry or cancel can be added on the same column later.
- [Waiting games pile up] No cancel and no expiry: an invite nobody opened stays in `Мої ігри` forever. → Accepted
  for two players; `Скасувати запрошення` is a small follow-up if it bothers.
- [`t.me/share/url` inside Telegram's web view] Behaviour of a plain link differs by client (may open the chat picker,
  an external browser, or nothing). → Copy always works; task 5.1 checks share on the human's phone and drops it if
  broken.
- [Main Mini App not enabled] If the dev bot has only a menu button URL, `t.me/<bot>?startapp=…` opens the bot chat,
  not the app, and no `start_param` arrives. → `docs/telegram-dev.md` step 4 already enables it; the manual check
  confirms.
- [Wrong `TELEGRAM_BOT_USERNAME`] Links point at another bot. → Visible at once in the manual check; the username is
  not a secret and is printed in the link.
- [Known-opponent check reveals nothing new] Both unknown and never-played ids give the same `422`. → Intended.
- [Large test diff] Many backend tests change how they start a game. → One helper, assertions unchanged; the reviewer
  can diff setup separately.

## Migration Plan

1. Human: add `TELEGRAM_BOT_USERNAME=<dev bot username>` to `.env` and the name to `.env.example` (commits it).
2. `docker compose up --build` runs `0005`: existing games keep their opponents. Without `.env` the app starts with
   `local_dev_bot`.
3. Rollback: previous commit + `alembic downgrade 0004` (deletes waiting games) or `docker compose down -v`.

## Open Questions

- Whether `t.me/share/url` behaves inside the Telegram web view on the human's phone — answered by the manual check;
  if it is broken, a separate spec commit removes the share link and copy stays (task 5.1).

## Implementation notes

<!-- Filled during apply: differences between the decisions above and the code. -->
