# Tasks

Scope: one new API route, the web app's launch flow and a new invite screen; no database, dependency or harness
change. Backend tests: `env UID=$(id -u) GID=$(id -g) docker compose --profile check run --rm --no-deps backend-check
pytest`; frontend: the same with `frontend-check vitest run`.

## 1. Red scenario tests

- [x] 1.1 `backend/tests/test_invites.py`: one test per scenario of "An invite can be read before joining", with the
  existing helpers (`invite`, `join`, `as_player`, `login` for Telegram user `3003` without a player)
- [x] 1.2 `frontend/src/Invites.test.tsx`: a stub for `POST /api/invites/preview`; one test per scenario of "The invite
  screen shows who invites and the penalties"; the scenarios of "The web app joins the game it was launched with" and
  "A link that cannot be joined says why" rewritten in place to the delta (same data and roles), plus the new ones
  ("Declining the invite", "A new player declines", "The opponent opens the link again", "No connection while reading the invite",
  "Someone else accepted first")
- [x] 1.3 Run pytest and Vitest, quote the failing lines and both summaries; every other test still passes —
  pytest `7 failed, 129 passed`: all 7 preview tests, `assert 404 == 200` (no route yet), `{'detail': 'Not Found'}`
  for the unknown token, `assert 404 == 401` without a login. Vitest `Tests  12 failed | 103 passed (115)`: the two
  invite-screen tests, five of the launch flow (registered, new player, declining, a new player declines, reload) and
  all five error tests; "The opponent opens the link again" and "Launch without a start parameter" pass already, since
  they keep today's behaviour. ESLint and tsc clean
- [x] 1.4 Commit the failing tests on their own (`test: red scenarios for reading an invite before accepting it`)

## 2. Backend

- [x] 2.1 `backend/app/api/invites.py` with `POST /api/invites/preview` (design D1), included in `main.py` before the
  `/api` fallback; verify every test in `test_invites.py` and the rest of pytest pass, and ruff and ty are clean —
  `136 passed`; ruff check, ruff format --check and ty: all clean. The route reuses `JoinRequest` (strict string
  token) and `account_player`
- [ ] 2.2 Commit (`feat(api): read an invite before joining its game`)

## 3. Web app

- [ ] 3.1 `frontend/src/api/`: `previewInvite(initData, token)` returning the preview or `"used"` / `"not-found"`, and
  401 as `LoginRefusedError`, like `joinGame`
- [ ] 3.2 `InviteScreen.tsx` and its pure `inviteLines` (design D3, with a unit test for the step-`0` case and the
  no-break spaces); `PlayerSession.tsx` launch flow of design D2. Verify every test in `Invites.test.tsx` and the rest
  of Vitest pass, ESLint and tsc clean
- [ ] 3.3 Playwright on `docker compose up --build` with the dev link `--start <token>` of a real invite game: the
  invite screen at 320×640 (no horizontal scroll, `Відмовитись` left of `Прийняти`, both visible without
  scrolling), accept as a new player (name form, then the game), as a registered player, and decline (back to
  `Мої ігри`, the game still waiting for the organizer); screenshots in `.playwright-mcp/`, findings quoted here
- [ ] 3.4 Commit (`feat(web): invite screen with the organizer and penalties, join after Прийняти`)

## 4. Hosted check

- [ ] 4.1 Ask the human before `fly deploy --remote-only --app gym-challenge`; deploy, run
  `node scripts/hosting-check.mjs` and quote its last line
- [ ] 4.2 **human** — with a second Telegram account: open an invite from `gym_challenge_iport_bot`, see the organizer
  and the penalties, `Прийняти`, play a round; record the answer here

## 5. Review and check

- [ ] 5.1 Run the change-reviewer subagent on a review packet and save its reply verbatim to
  `docs/reviews/invite-preview-accept.md`
- [ ] 5.2 Run the project check command and quote its summary line
