# Tasks

## 1. Failing scenario tests

- [x] 1.1 Backend: in `backend/tests/conftest.py` add the test login helpers (design D10: `BOT_TOKEN`,
  `sign_init_data`, `login`, a fixture registering `Клієнт`/`Тренер`/`Гість` through `POST /api/me` with `as_player`)
  and pass `bot_token` to `create_app`; write one test per scenario of `telegram-auth` (API part) and `players` (API
  part) in new `backend/tests/test_auth.py` and `backend/tests/test_players.py`, including the upgrade from a
  database at revision `0002`; move `test_games.py`, `test_rounds.py` and the full-game test from `X-Player-Id` to
  `as_player(n)` and from `opponent_email` to `opponent_id` per the `games`, `rounds` and `scoring` deltas; run pytest
  through `docker compose --profile check run --rm backend-check pytest` and quote the failing lines
- [x] 1.2 Frontend: add a test helper that opens the app with `#tgWebAppData=<t1|t2>` and answers `GET /api/me`;
  write one test per web-app scenario of `telegram-auth`, `players`, `games`, `game-screen` and `web-shell` (new and
  modified), replacing the picker-based setup in `App.test.tsx`, `Games.test.tsx` and `GameScreen.test.tsx`; run
  Vitest through `docker compose --profile check run --rm frontend-check vitest run` and quote the failing lines

## 2. Backend: login

- [x] 2.1 Add `backend/app/auth.py` with `verify_init_data()` (design D1) and the `telegram_user` /
  `current_player` dependencies (D2); verify the signature, age and malformed-header tests from 1.1 pass
- [x] 2.2 `create_app(bot_token=...)` with the startup check in the lifespan, module-level `app` from
  `TELEGRAM_BOT_TOKEN` (design D4); verify the "Token missing" and "Health check does not need a login" tests pass
- [x] 2.3 Models `Player` without `email`, new `TelegramAccount`, migration `0003_telegram_accounts` (design D5);
  verify the upgrade-from-MVP and restart tests pass and `alembic` downgrade to `0002` then upgrade runs on a test
  database
- [x] 2.4 `GET /api/me`, `POST /api/me` (409 on a second registration, 422 on a bad name) and the temporary
  `GET /api/players` in `backend/app/api/players.py` (design D5, D6); verify the `players` API tests pass
- [x] 2.5 `backend/app/api/games.py`: `CurrentPlayerDep` from `app/auth.py`, `opponent_id` instead of
  `opponent_email` (design D6); verify all of `test_games.py`, `test_rounds.py`, `test_rules.py` pass and `ruff`,
  `ty` are clean through `backend-check`

## 3. Frontend: login

- [x] 3.1 Add `frontend/src/telegram.ts` (`takeInitData`, `firstName`, forget on refusal; design D7) and call it in
  `App` before the router; verify the "Opened from Telegram", "Reload in the same tab" and "Opened in a plain
  browser" tests pass
- [x] 3.2 `src/api/players.ts` (`fetchMe`, `registerMe`, `fetchPlayers` → `{id, name}`) and `src/api/games.ts` take
  `initData` and send `Authorization: tma …`; `LoginRefusedError` replaces `UnknownPlayerError`; verify `tsc` is
  clean through `frontend-check`
- [x] 3.3 Rewrite `PlayerSession` as the state machine of design D7 with the name form, the refused-login and
  unreachable messages; delete `PlayerPicker`, `playerStore` and their styles; verify the `players`,
  `telegram-auth`, `web-shell` and `game-screen` Vitest scenarios pass
- [x] 3.4 `NewGameForm`: select `Суперник` with the empty-list, load-error and "no opponent chosen" states, body with
  `opponent_id`; verify the `games` Vitest scenarios pass and ESLint is clean

## 4. Local run and Telegram development

- [x] 4.1 Ask the human to confirm the build-config change (CLAUDE.md «Межі»), then in `docker-compose.yml` add
  `TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:-local-dev-token}` to `app` and the `tunnel` service in profile `tunnel`
  with an exactly pinned `ngrok/ngrok` image (design D8); add `.env.example` with `TELEGRAM_BOT_TOKEN=`,
  `NGROK_AUTHTOKEN=`, `NGROK_URL=`; verify `docker compose config` and `docker compose --profile tunnel config`
  succeed and `docker compose up --build` starts the app without `.env`
- [x] 4.2 Add `scripts/dev-login-link.mjs` (design D9: signs with `local-dev-token` only, prints the link); verify a
  link for `--id 1001 --name Іван` opened with Playwright on `http://localhost:8000` shows `Як тебе звати?` with
  `Іван`, and after `Почати` shows `Мої ігри`
- [x] 4.3 Browser check with Playwright: two contexts with links for `1001` and `1002`, player 1 creates a game
  against player 2 from the select, both guess, player 1 enters the actual count; the plain `http://localhost:8000`
  in a fresh context shows only `Відкрий Gym Challenge у Telegram`; screens fit 375 px width
- [x] 4.4 Write `docs/telegram-dev.md` (Ukrainian): creating the dev bot in @BotFather, setting the Mini App URL to
  `https://$NGROK_URL`, filling `.env` by hand, `docker compose --profile tunnel up --build`, the ngrok warning page,
  the dev link; verify every command in it runs as written (except the ones that need the human's `.env`)
- [x] 4.5 Ask the human to fill `.env` and run the tunnel, then open the dev bot in Telegram on a phone; record in
  the change's review packet whether the first login, the name form and `Мої ігри` worked (the human reports)

## 5. Docs and harness

- [x] 5.1 Record decisions 1–5 in `docs/spec.md` («Вирішено»: tunnel, dev login, login kept per request for 24 h,
  rename as a separate change, temporary player list; bump to v2.2) and update the `players` Purpose in
  `openspec/specs/players/spec.md` to describe Telegram registration; commit as `docs(spec)`; verify with
  `git show --stat HEAD` that only these files changed
- [x] 5.2 Harness, separate commit after showing the diff and getting the human's «так»: a Telegram bot token
  pattern (`\b\d{8,10}:[A-Za-z0-9_-]{35}\b`) in `scripts/secret-scan.mjs` with its self-test case, and the tunnel /
  dev-link commands in `CLAUDE.md` «Команди»; verify `node scripts/secret-scan.mjs --self-test` passes

## 6. Review and check

- [x] 6.1 Run the change-reviewer subagent on a review packet and save its reply verbatim to
  `docs/reviews/telegram-auth.md`
- [ ] 6.2 Run the project check command (`make check`) and quote its summary line
