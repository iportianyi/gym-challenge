# Tasks

## 1. Failing scenario tests

- [x] 1.1 Backend: in `backend/tests/conftest.py` pass `bot_username="gym_test_bot"` to `create_app` and add the
  `invite` / `share_game` helpers (design D9); write one test per API scenario of the `invites`, `games`, `players`,
  `rounds` and `telegram-auth` deltas (new `backend/tests/test_invites.py`, the rest in the existing files), including
  the upgrade from a database at revision `0004`; move existing tests that start a game between players who never
  played to `share_game`, keeping their assertions; delete the `GET /api/players` list tests (the requirement is
  REMOVED); run `docker compose --profile check run --rm backend-check pytest` and quote the failing lines
- [x] 1.2 Frontend: add `t2s` (`t2` with `start_param=Abc_123-xyz`) and an `answerJoin` helper to
  `frontend/src/test/telegram.ts`; write one test per web-app scenario of the `invites` and `games` deltas, replacing
  the `GET /api/players` mocks with `GET /api/opponents`; run
  `docker compose --profile check run --rm frontend-check vitest run` and quote the failing lines

## 2. Backend

- [x] 2.1 Models: `Game.opponent_id` nullable, `Game.invite_token` unique nullable; migration `0005_game_invites`
  with `batch_alter_table` and a downgrade that deletes waiting games (design D1); verify the upgrade-from-`0004` test
  passes and `alembic downgrade 0004` then `upgrade head` runs on a test database
- [x] 2.2 `create_app(bot_token=…, bot_username=…)`, module-level app from `TELEGRAM_BOT_USERNAME`, startup check in
  the lifespan (design D6); verify the "Username missing" and "Token missing" tests pass
- [x] 2.3 `POST /api/games` without `opponent_id` creates a waiting game with a token; with `opponent_id` only a
  known opponent (design D2, D3); `GET /api/opponents` replaces `GET /api/players` in `app/api/players.py`; verify the
  `games` and `players` API tests and the invites "Create an invite game" tests pass
- [x] 2.4 Waiting games in responses and moves: nullable `opponent`, `score` `[]`, `current_round` `null`,
  `invite_url` for the organizer only, `409 Waiting for opponent` on moves (design D2, D5); verify the invites
  "Only the organizer sees the invite link" and "Nothing is played until the opponent joins" tests pass
- [x] 2.5 `POST /api/games/join` with the guarded update and round `1` in one transaction (design D4); add a test
  that two joins of the same token by players `2` and `3` leave exactly one opponent; verify all of pytest passes and
  `ruff`, `ty` are clean through `backend-check`

## 3. Frontend

- [x] 3.1 `src/api/games.ts` (`joinGame`, nullable `opponent`, `"waiting"`, `invite_url`) and `src/api/players.ts`
  (`fetchOpponents` instead of `fetchPlayers`); verify `tsc` is clean through `frontend-check`
- [x] 3.2 `src/telegram.ts`: `takeInitData()` returns `{ initData, startParam }`, the start parameter only on launch,
  `tgWebAppStartParam` removed from the address (design D7); `PlayerSession` gets the `joining` and `join-failed`
  states; verify the invites "web app joins" and "cannot be joined" Vitest scenarios pass
- [x] 3.3 `NewGameForm`: select with `Запросити за посиланням` first, known opponents after it, body without
  `opponent_id` for an invite, the load-error note (design D8); verify the `games` form scenarios and "Create an invite
  from the form" pass
- [x] 3.4 `GameList` waiting row and `GameScreen` waiting block with copy and share (design D8); verify the `games`
  list scenarios and the invites waiting-screen scenarios pass, and ESLint is clean

## 4. Local run and development tools

- [x] 4.1 Ask the human to confirm the build-config change (CLAUDE.md «Межі»), then add
  `TELEGRAM_BOT_USERNAME: ${TELEGRAM_BOT_USERNAME:-local_dev_bot}` to `app` in `docker-compose.yml`; ask the human to
  add `TELEGRAM_BOT_USERNAME=` to `.env.example` (and the dev bot's username to `.env`) and commit it themselves;
  verify `docker compose config --quiet` succeeds and `docker compose up --build` starts the app without `.env`
- [x] 4.2 `scripts/dev-login-link.mjs --start <token>`: `start_param` in the signed fields, `?tgWebAppStartParam=` in
  the URL, token checked against `^[A-Za-z0-9_-]{1,512}$` (design D10); verify that a link for `--id 1002 --start
  <token of a real invite>` opened with Playwright joins that game
- [x] 4.3 Browser check with Playwright at 375 px width: context A (`1001`) creates an invite and sees the waiting
  screen with the link and `Скопійовано` after copying; context B (`1002 --start <token>`) passes the name form and
  lands in round 1 while A's screen turns into round 1 by itself; both guess, A enters the actual count; context C
  (`1003 --start <token>`) sees `Це запрошення вже прийняв інший гравець.`; A's next `Нова гра` offers `Тренер`
  (the name B chose); save screenshots to `.playwright-mcp/`
- [x] 4.4 Update `docs/telegram-dev.md` (Ukrainian): `TELEGRAM_BOT_USERNAME` in `.env`, that the invite link needs the
  Main Mini App (step 4), the dev link with `--start`, why a hybrid «Telegram + dev link» is impossible (proposal,
  decision 6); verify every command in it runs as written (except the ones that need the human's `.env`)

## 5. Check in Telegram

- [x] 5.1 Ask the human to turn on the VPN and run `docker compose --profile tunnel up --build`; on the phone the human
  creates an invite, checks `Копіювати посилання` and `Надіслати в Telegram`, opens their own link from a chat and
  sees the waiting game; record what worked in the review packet. If the share link misbehaves, propose a separate
  spec commit that removes it (copy stays) and wait for the human's decision
  — 2026-10-17, the human: everything worked (copy, share to a chat, own link opens the waiting game); share stays

## 6. Docs and harness

- [x] 6.1 `docs/spec.md` v2.4: record the decisions of this change in «Вирішено» (link format and
  `TELEGRAM_BOT_USERNAME`, copy/share without the Telegram script, token on the game without expiry or cancel, what
  the opener sees, the waiting game, how invites are checked) and close «тимчасовий список гравців»; update the
  `players` Purpose in `openspec/specs/players/spec.md` (players no longer see each other in a list); commit as
  `docs(spec)`; verify with `git show --stat HEAD` that only these files changed
- [ ] 6.2 Harness, separate commit after showing the diff and getting the human's «так»: the dev-link command with
  `--start` in `CLAUDE.md` «Команди»; verify `git show --stat HEAD` lists only `CLAUDE.md`

## 7. Review and check

- [ ] 7.1 Run the change-reviewer subagent on a review packet and save its reply verbatim to
  `docs/reviews/game-invites.md`
- [ ] 7.2 Run the project check command (`make check`) and quote its summary line
