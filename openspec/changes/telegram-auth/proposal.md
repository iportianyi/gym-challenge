# Proposal

## Why

Spec v2.0–v2.1 (`docs/spec.md`, «Платформа і доступ») replaces the two default players and the easy-to-fake
`X-Player-Id` header with a Telegram Mini App login: the server trusts only `initData` whose signature it has checked
with the bot token. Nothing else in v2 (invitations, known opponents, hosting on Fly.io) can be built before the
server knows who is acting, so this is the first of the three agreed changes: **login → invitations → hosting**.

## What Changes

- **BREAKING (API)**: every endpoint except `GET /api/health` takes the acting person from the header
  `Authorization: tma <initData>`. The server checks the `initData` signature with `TELEGRAM_BOT_TOKEN` and its
  `auth_date` age; a missing, malformed, forged or expired login is `401 {"detail": "Invalid Telegram login"}`.
  `X-Player-Id` is gone.
- A player is created at the first login: `GET /api/me` answers `404 {"detail": "Not registered"}` for an unknown
  Telegram user, and `POST /api/me` with `{"name": ...}` creates the player (name 1–40 characters after trimming).
  One Telegram account belongs to one player; names need not be unique. The Telegram account is stored in its own
  table, apart from the player, so other login methods can be added later (spec v2.0).
- Game endpoints and `GET /api/players` answer `403 {"detail": "Not registered"}` to a valid login of a person
  who has not chosen a name yet.
- **BREAKING (data)**: a migration deletes the two default players «Клієнт»/«Тренер», all games, rounds and guesses
  (local test data, spec v2.0), and drops the player email.
- **BREAKING (API)**: `POST /api/games` names the opponent by `opponent_id` instead of `opponent_email`.
  `GET /api/players` becomes a **temporary** list of every other registered player (`id`, `name`), for choosing the
  opponent until invitations exist (decision 5).
- Frontend: reads `initData` from the Telegram launch parameters in the URL (`#tgWebAppData=…`), keeps it for the
  tab, and sends it with every request. Outside Telegram it shows only `Відкрий Gym Challenge у Telegram`. The first
  login shows `Твоє ім'я`, prefilled with the Telegram first name. An expired or refused login shows
  `Вхід застарів. Закрий і знову відкрий застосунок у Telegram.` The picker `Хто ти?`, `Змінити гравця` and the
  remembered player in local storage are removed. The new-game form chooses `Суперник` from a list instead of an
  email field.
- Development in Telegram: a tunnel from the laptop to the development bot (decision 1), and a way to log in on
  `localhost` without Telegram (decision 2). Hosting on Fly.io and the game bot are **not** in this change.

## Decisions for the human

The specs, design and tasks are written for the **recommended** option of each decision.

**Status (2026-10-16, human):** decisions 2–5 accepted as recommended. Decision 1 (tunnel) is still under
discussion; its answer is folded in with `/opsx:update` before `/opsx:apply` starts group 4.

1. **Tunnel for the development bot — ngrok or cloudflared.**
   - *(Recommended)* **ngrok with the free static domain**: one fixed `https://<name>.ngrok-free.app` set once in
     @BotFather; needs an ngrok account and `NGROK_AUTHTOKEN` (a secret in `.env`). Cost: the free plan shows an
     ngrok warning page on the first browser visit (one tap «Visit Site», then remembered).
   - **cloudflared quick tunnel**: no account and no warning page, but a new random `*.trycloudflare.com` address on
     every start, so the Mini App URL in @BotFather must be edited each session.
   - Either way it runs as a Compose service in a new profile `tunnel` (pinned official image), so nothing is
     installed on the host — this is a **build-config change and a new image** that needs your «так».
2. **Development login without Telegram, only on localhost.**
   - *(Recommended)* **No bypass in the server.** Locally, without a real token, Compose starts the app with a fixed
     non-secret token `local-dev-token`; a script `scripts/dev-login-link.mjs` signs `initData` with it and prints
     `http://localhost:8000/#tgWebAppData=…`. The server always checks signatures; the link is useless anywhere the
     token is real (dev bot via tunnel, Fly.io). Playwright uses the same link.
   - **Server flag** `DEV_LOGIN=1` that accepts an unsigned user from `localhost` only: simpler links, but a bypass
     that lives in production code, and "from localhost" is hard to tell apart from tunnel traffic (both reach the
     app through Docker's port forwarding).
   - **None**: UI checked only inside Telegram; Playwright cannot log in.
3. **How the login is kept between requests.**
   - *(Recommended)* **`initData` on every request** in `Authorization: tma <initData>`, checked each time; accepted
     for 24 hours after `auth_date` (Telegram issues fresh `initData` every time the Mini App is opened). Stateless:
     no session table, no cookie, no extra secret.
   - **Exchange for a session** (`POST /api/login` → HttpOnly cookie with a session id in the database, or a signed
     cookie): shorter-lived credential on the wire and revocable, but a session table or one more secret, and
     cookie behaviour in Telegram's in-app web views to verify.
4. **Rename `creator` → `organizer` in code, API and database.**
   - *(Recommended)* **A separate small change right after this one** (`rename-creator-to-organizer`): a pure rename
     across `creator`/`creator_id`/`Only the creator…` in specs, API, DB and frontend. This change already rewrites
     most scenarios for the new login; mixing a mechanical rename in makes the review harder.
   - **In this change**: one breaking API change instead of two.
   - **Later, together with invitations.**
5. **Choosing the opponent before invitations exist.**
   - *(Recommended, as you leaned)* **Temporary list of everyone who has logged in**: `GET /api/players` returns
     every other registered player, the form shows them as `Суперник`. Trade-offs: everyone who opens the dev bot is
     visible to everyone; equal names are not distinguishable. Acceptable because only the dev bot exists until the
     hosting change, which comes after invitations; the invitations change replaces this list with known opponents.
   - **No new games until invitations**: nothing playable between the two changes.

Also needs your «так» (CLAUDE.md, «Межі»): `docker-compose.yml` gets `TELEGRAM_BOT_TOKEN` for `app` and the
`tunnel` service; a new `.env.example` lists `TELEGRAM_BOT_TOKEN`, `NGROK_AUTHTOKEN`, `NGROK_URL` (names only). No new
Python or npm dependency: the signature check uses Python's `hmac`/`hashlib`, the frontend reads the launch
parameters itself instead of loading `telegram-web-app.js`.

## Capabilities

### New Capabilities

- `telegram-auth`: how a request proves who makes it — the `Authorization: tma <initData>` header, the signature
  and age checks, the bot token the server is started with, and how the web app gets `initData` from Telegram,
  keeps it, sends it, and what it shows outside Telegram or when the login is refused.

### Modified Capabilities

- `players`: the two default players, the anonymous player list, `X-Player-Id`, the picker and the remembered player
  are removed; players are created at the first Telegram login with a chosen name; `/api/me`; the temporary list of
  other players; old data is deleted.
- `games`: the opponent is chosen by `opponent_id` from the temporary list instead of by email; scenarios act
  through the Telegram login; the email hint under the form is removed.
- `rounds`: scenarios act through the Telegram login instead of `X-Player-Id` (behaviour unchanged).
- `scoring`: the full-game API scenario acts through the Telegram login (behaviour unchanged).
- `game-screen`: requests carry the login; a refused login shows the "reopen in Telegram" message instead of the
  picker.
- `web-shell`: the greeting scenarios depend on `GET /api/me` instead of `GET /api/players`.

## Impact

- Backend: new `app/auth.py` (signature check, `CurrentPlayerDep`), `app/api/players.py` (`/me`, list), models
  `Player` (no email) and new `TelegramAccount`, migration `0003`, `app/api/games.py` (`opponent_id`), `create_app()`
  takes the bot token; `TELEGRAM_BOT_TOKEN` read at startup. Tests: a fixture that signs `initData` with a test token
  and registers players; every existing test moves from `X-Player-Id` to it.
- Frontend: new `src/telegram.ts` (launch parameters, stored `initData`), `src/api/*` send `Authorization`,
  `PlayerSession` rewritten (outside Telegram / name / expired), `PlayerPicker` and `playerStore` removed,
  `NewGameForm` gets a select. Tests updated accordingly.
- Config: `docker-compose.yml` (`TELEGRAM_BOT_TOKEN`, profile `tunnel`), new `.env.example`, new
  `scripts/dev-login-link.mjs`; `docs/telegram-dev.md` with the @BotFather and tunnel steps.
- Docs: `docs/spec.md` records decisions 1–5 (the tunnel choice closes the open item in «Вирішено»).
- Data: existing local games are deleted on upgrade (agreed in spec v2.0).
