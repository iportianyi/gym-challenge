# Tasks

Scope: default values on the three reps fields of the new-game form; no backend, database, dependency or harness
change. Frontend tests: `env UID=$(id -u) GID=$(id -g) docker compose --profile check run --rm --no-deps
frontend-check vitest run`.

## 1. Red scenario tests

- [x] 1.1 `frontend/src/Games.test.tsx`: one test per new scenario of "The app creates a game with the chosen
  opponent" — "The form opens with default reps" (field values `""`, `10`, `5`, `30`), "Submit keeping the defaults"
  (only `Вправа` filled; the request body equals the one in the scenario) and "Submit with changed reps"
  (`12`, `0`, `50`). The existing scenarios stay as they are
- [x] 1.2 Run Vitest, quote the failing lines and the summary; every other test still passes. "Submit with changed
  reps" is expected to pass already (the form sends what is typed); the other two fail — `Tests  2 failed | 118
  passed (120)`: "the form opens with default reps" `AssertionError: expected '' to be '10'`, "submit keeping the
  defaults" `expected [] to have a length of 1 but got +0` (the empty required fields block the submit); "submit with
  changed reps" passes. ESLint and tsc clean
- [x] 1.3 Commit the failing tests on their own (`test: red scenarios for default reps on the new-game form`)

## 2. Web app

- [ ] 2.1 `frontend/src/components/NewGameForm.tsx`: `RepsInput` takes a `defaultValue`; the three fields get `10`,
  `5`, `30`. Limits (`min`, `max`, `step`, `required`) unchanged. Verify every Vitest test passes, ESLint and tsc clean
- [ ] 2.2 Playwright on `docker compose up --build` with a dev login link: open `Нова гра` at 320×640, the three
  fields show `10`, `5`, `30`; fill only `Вправа`, `Почати гру` opens the invite game with those reps; screenshot in
  `.playwright-mcp/`, findings quoted here
- [ ] 2.3 Commit (`feat(web): prefill the new-game reps with 10, 5 and 30`)

## 3. Hosted check

- [ ] 3.1 Ask the human before `fly deploy --remote-only --app gym-challenge`; deploy, run
  `node scripts/hosting-check.mjs` and quote its last line

## 4. Review and check

- [ ] 4.1 Run the change-reviewer subagent on a review packet and save its reply verbatim to
  `docs/reviews/new-game-defaults.md`
- [ ] 4.2 Run the project check command and quote its summary line
