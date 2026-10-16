# Proposal

## Why

Spec v2.0 (`docs/spec.md`, «Обсяг», «Критерії успіху») lets two people who have never played together start a game
from their own phones: the organizer sends an invite link in Telegram, the first other player who opens it becomes
the opponent; later games with the same person start by choosing them from the people one has already played with.
Today the opponent is picked from a **temporary list of every registered player** (`GET /api/players`, telegram-auth
decision 5), which shows every name to everyone and has to go before the game bot is hosted. This is the second of
the three agreed changes: login → **invitations** → hosting (Fly.io stays out of this change).

## What Changes

- **New: invite games.** `POST /api/games` without `opponent_id` creates a game with `status` `"waiting"`, no
  opponent, no rounds, and a one-time invite link that only the organizer sees (`invite_url` in the game's detail). Guesses and the actual
  count in a waiting game are refused with `409 {"detail": "Waiting for opponent"}`.
- **New: joining by the link.** The link opens the Main Mini App with the invite token as `startapp`; Telegram puts it
  into the signed `initData` as `start_param`. The web app sends it to `POST /api/games/join`: the first player other
  than the organizer becomes the opponent, round 1 opens and the game is `"active"`. A used link, an unknown link and
  the organizer's own link each have a defined answer (decision 4).
- **New: known opponents.** `GET /api/opponents` lists the players with whom the acting player shares at least one
  game, most recent first. `POST /api/games` with `opponent_id` accepts only a known opponent; the game starts at once,
  as today.
- **BREAKING (API)**: `GET /api/players` is removed (now `404`). `POST /api/games` with an `opponent_id` that is not a
  known opponent answers `422 {"detail": "Opponent not found"}` even if that player exists. `opponent` in game objects
  is `null` and `score` is `[]` while a game is waiting; `status` gains the value `"waiting"`.
- **New game form**: the select `Суперник` offers `Запросити за посиланням` (first, chosen by default) and then the
  known opponents; the hint about «попроси суперника відкрити Gym Challenge» and the «no players» blocking are gone —
  a game can always be started.
- **Waiting game in the UI**: `Мої ігри` shows `Чекаємо суперника` instead of the opponent's name and no score; the game
  screen shows the link with `Копіювати посилання` and `Надіслати в Telegram` and refreshes itself until the opponent
  joins, then turns into round 1.
- **Config**: a new non-secret variable `TELEGRAM_BOT_USERNAME` to build the link (decision 1); `dev-login-link.mjs`
  gets `--start <token>` (decision 6); `docs/telegram-dev.md` and `docs/spec.md` (v2.4) record the decisions.

## Decisions for the human

The specs, design and tasks are written for the **recommended** option of each decision. Facts about Telegram are
from the Mini Apps docs (core.telegram.org/bots/webapps, via Context7): a Main Mini App opens by
`https://t.me/<bot>?startapp=<param>`; a non-empty `startapp` arrives as `start_param` inside the signed `initData` and
as the GET parameter `tgWebAppStartParam`; `startapp` allows only `A-Z a-z 0-9 _ -`, up to 512 characters.

1. **Link format and the bot's username.**
   - *(Recommended)* **Main Mini App direct link** `https://t.me/<bot>?startapp=<token>`. @BotFather: nothing new —
     the dev bot already has **Configure Mini App → Enable Mini App** with the tunnel URL (`docs/telegram-dev.md`,
     step 4); that *is* the Main Mini App. The server builds the link, so it needs the username: a new **non-secret**
     variable `TELEGRAM_BOT_USERNAME` (dev bot now, game bot on Fly.io later), passed by Compose with the default
     `local_dev_bot` when `.env` has none (a local link then only shows the token; locally you join with
     `dev-login-link.mjs --start`). Startup fails without it, like the token. You add it to `.env` and
     `.env.example` yourself (`.env*` is yours to commit).
   - **Named Mini App** `https://t.me/<bot>/<app>?startapp=<token>`: needs `/newapp` in @BotFather and a second
     variable (the app's short name); nothing gained over the Main Mini App.
   - **Ask Telegram for the username** (`getMe` at startup): no new variable, but a network call at every start —
     fails without your VPN and with `local-dev-token`.
   - **Bot deep link** `t.me/<bot>?start=<token>`: needs a bot that answers messages (webhook) — we have none.
2. **Sending the link from the Mini App without `telegram-web-app.js`.**
   - *(Recommended)* **Both, no script**: the link shown as text, a button `Копіювати посилання`
     (`navigator.clipboard`, then `Скопійовано`), and a link `Надіслати в Telegram` to
     `https://t.me/share/url?url=<invite_url>&text=…` (Telegram's chat picker). Copy works everywhere and is testable;
     the share link is the one-tap path. Risk: Telegram's web view may open a plain `t.me` link outside the app or not
     at all on some clients — task 5.1 checks it on your phone; if it misbehaves we drop the share link (copy stays).
   - **Load `telegram-web-app.js` and call `openTelegramLink(share url)`**: reliable chat picker inside Telegram, but
     a third-party script on every page (telegram-auth D7 avoided it) and the dev links in a plain browser get no
     share at all.
   - **Copy only**: simplest, one more step for you (paste into the chat).
3. **Where the invite token lives; length, expiry, cancel.**
   - *(Recommended)* **A column on the game**: `game.invite_token` (unique, nullable; `null` for a game started with
     a known opponent), kept after the game is joined so a second opener gets «already used», not «not found».
     `game.opponent_id` becomes nullable. One game ↔ at most one invite, so a separate table adds a join and nothing
     else. Token: `secrets.token_urlsafe(16)` — 22 characters of `A-Za-z0-9_-` (128 random bits), fits `startapp`.
     **No expiry, no cancel** in this change: a waiting game just waits (spec: a game cannot be left); the link stays
     valid until someone joins.
   - **Separate `invite` table** (token, game, created, used_at, used_by): room for expiry, several invites per game
     or invites without a game — none of which the spec asks for.
   - **Expiry** (e.g. 7 days) **and/or `Скасувати запрошення`** (deletes the waiting game): protects against a link
     sent to the wrong chat; costs a rule, a message and scenarios. Easy to add later on the column.
4. **What the person who opens the link sees.**
   - *(Recommended)*:
     - **New Telegram user**: the name form `Як тебе звати?` first (as today), then they join and see the game screen
       at round 1.
     - **Registered player, unused link**: joins at once, no confirmation (spec: the first opener becomes the
       opponent), sees the game screen at round 1.
     - **The opponent of this game opens the link again**: just the game screen (`200`, nothing changes).
     - **The organizer opens their own link**: their waiting game screen with the link — no error.
     - **Someone else, link already used**: `Це запрошення вже прийняв інший гравець.` and the link `Мої ігри`.
     - **Unknown or broken token**: `Запрошення не знайдено.` and the link `Мої ігри`.
     The join runs only when the app is *launched* with the link, not on a reload of the same tab.
   - **Confirmation screen** («Тренер запрошує тебе: Присідання… Прийняти»): protects against accidental joins,
     contradicts «перший, хто відкрив» and adds a step.
5. **The waiting game in `Мої ігри` and on the game screen.**
   - *(Recommended)* Only the organizer sees it (nobody else is in the game). In `Мої ігри`: `Проти` →
     `Чекаємо суперника`, no `Рахунок`, the settings board as usual. On the game screen: the heading `Гра: <exercise>`,
     `Чекаємо суперника. Надішли йому посилання.`, the link with `Копіювати посилання` / `Надіслати в Telegram`, no
     score and no round fields; it keeps refreshing every 3 s (as an active game does) and shows round 1 as soon as
     the opponent joins. After `Почати гру` with `Запросити за посиланням` the app opens this screen. The opponent
     never sees a waiting state: their first view is round 1.
   - **Also a mark `Очікує суперника` with a different style** in the list — cosmetic, can be added in review.
6. **Checking without two phones.**
   - *(Recommended)* **Locally with two tabs**: `dev-login-link.mjs --start <token>` adds `start_param` to the signed
     `initData` and `tgWebAppStartParam` to the URL, exactly as Telegram does; Playwright plays organizer and invitee
     in two browser contexts through a whole invite → join → round flow. **In Telegram, one person**: you create an
     invite on the phone via the tunnel, check copy/share, open your own link (organizer case). The full two-person
     run in Telegram stays the spec's success criterion, with the coach.
   - **Hybrid «me in Telegram + second player via dev link» is not possible** without weakening the login: dev links
     are signed with `local-dev-token`, and a server running with the real dev-bot token refuses them — by design
     (telegram-auth D9). Accepting both tokens would let anyone sign as anyone (the local token is public). A real
     hybrid needs a second Telegram account (e.g. Telegram Web on the laptop with another number).

Also needs your «так» (CLAUDE.md, «Межі»): `docker-compose.yml` passes `TELEGRAM_BOT_USERNAME` to `app`. No new Python
or npm dependency.

## Capabilities

### New Capabilities

- `invites`: invite games — creating a game without an opponent, its waiting state, the one-time link (format,
  token), joining by it (`POST /api/games/join`, each outcome), how the web app takes the token from the Telegram
  launch and what it shows, and the screen of a waiting game with copy/share.

### Modified Capabilities

- `games`: the opponent is a known opponent or none (invite); `GET /api/opponents`; the new-game form offers
  `Запросити за посиланням` and known opponents; game objects may be `waiting` (`opponent` `null`, `score` `[]`); the list shows a waiting game.
- `players`: the temporary list of all players (`GET /api/players`) is removed; the requirements that mentioned it
  name `GET /api/opponents` instead.
- `rounds`: `GET /api/games/{id}` carries `invite_url`; `current_round` is `null` while the game waits.
- `telegram-auth`: the server also needs `TELEGRAM_BOT_USERNAME` to start.

## Impact

- Backend: `app/models.py` (`Game.opponent_id` nullable, `invite_token`), migration `0005_game_invites`,
  `app/api/games.py` (create without opponent, `join`, `waiting` in moves and responses, `invite_url`),
  `app/api/players.py` (`/players` → `/opponents`), `create_app(bot_username=…)`. Tests: new invite and opponent
  tests; the `GET /api/players` tests go; existing game tests need a shared game before choosing an opponent (fixture).
- Frontend: `src/telegram.ts` (start parameter on launch), `src/api/*` (`fetchOpponents`, `joinGame`, nullable
  `opponent`, `waiting`), `PlayerSession` (join step), `NewGameForm` (select), `GameList`, `GameScreen` (waiting view).
- Config/docs: `docker-compose.yml` (`TELEGRAM_BOT_USERNAME`), `.env.example` (by the human),
  `scripts/dev-login-link.mjs` (`--start`), `docs/telegram-dev.md`, `docs/spec.md` v2.4.
- Data: existing games keep their opponent and get `invite_token` `null`; no data is deleted.
