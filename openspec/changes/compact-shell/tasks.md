# Tasks

Scope: the page header, the place of `Нова гра` and a page icon; no backend, database, dependency or harness change.
Frontend tests: `env UID=$(id -u) GID=$(id -g) docker compose --profile check run --rm --no-deps frontend-check
vitest run`.

## 1. Red scenario tests

- [ ] 1.1 `frontend/src/App.test.tsx` (or `Login.test.tsx`, where the session tests live): "The header names the
  player" and "The header before the player is known" (design D5); the existing web-shell greeting tests stay
- [ ] 1.2 `frontend/src/Login.test.tsx`: "Confirm the Telegram name" and "Returning player" rewritten in place to the
  delta (the name in the page header instead of the visible `Ти граєш як <name>`), same data
- [ ] 1.3 `frontend/src/Games.test.tsx`: "New game comes before the list" (8 games) and "New game comes before the
  empty note"
- [ ] 1.4 `frontend/src/indexHtml.test.ts`: "The icon is linked"
- [ ] 1.5 Run Vitest, quote the failing lines and the summary; every other test still passes; ESLint and tsc clean
- [ ] 1.6 Commit the failing tests on their own (`test: red scenarios for a one-line header, New game first and a page icon`)

## 2. Web app

- [ ] 2.1 `.visually-hidden` in the global stylesheet; `AppHeader.tsx` with its CSS (design D2); `App.tsx` without the
  header; `PlayerSession.tsx` renders `AppHeader` in every state and with the name in `ready`, without `.me`
  (design D1). Verify the header and login tests pass
- [ ] 2.2 `GameList.tsx`: `Нова гра` between the heading and the list or note (design D3). Verify the games tests pass
- [ ] 2.3 `frontend/public/favicon.svg` and the link in `index.html` (design D4). Verify every Vitest test passes,
  ESLint and tsc clean
- [ ] 2.4 Playwright on `docker compose up --build` (with `TELEGRAM_BOT_TOKEN=local-dev-token` from the shell) and a
  dev login link: at 320×640 as `Олександра-Анастасія Вишнева-Подільська` — header one line (same top for heading
  and name), name cut with `…`, no horizontal scroll; `Нова гра` under `Мої ігри`; the name form, a game screen and
  the new-game form under the one-line header; `GET /favicon.svg` `200` `image/svg+xml` and no `/favicon.ico` request
  in the network log; screenshots in `.playwright-mcp/`, findings quoted here
- [ ] 2.5 Commit (`feat(web): one-line header with the player's name, New game above the list, page icon`)

## 3. Hosted check

- [ ] 3.1 Ask the human before `fly deploy --remote-only --app gym-challenge`; deploy, run
  `node scripts/hosting-check.mjs` and quote its last line; `curl -sI https://gym-challenge.fly.dev/favicon.svg`
  answers `200` with `image/svg+xml`

## 4. Review and check

- [ ] 4.1 Run the change-reviewer subagent on a review packet and save its reply verbatim to
  `docs/reviews/compact-shell.md`
- [ ] 4.2 Run the project check command and quote its summary line
