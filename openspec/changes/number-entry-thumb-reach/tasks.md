# Tasks

Scope: frontend only (`NumberEntry`, its CSS, `GameScreen.test.tsx`); no backend, API, dependency or harness changes.

## 1. Red scenario tests

- [x] 1.1 `frontend/src/GameScreen.test.tsx`: one test per Vitest-checkable scenario of "The number entry keeps its
  forward button under the right thumb" (both confirm-step orders and "Далі follows the field on its line"), asserting
  order with `compareDocumentPosition`; the 360×640 scenario is covered by task 2.3 (design D3)
- [x] 1.2 Run `env UID=$(id -u) GID=$(id -g) docker compose --profile check run --rm --no-deps frontend-check vitest
  run` and quote the failing lines; every other test still passes — `× confirm step puts Надіслати on the right`
  (`expected [ 'Надіслати', 'Змінити' ] to deeply equal [ 'Змінити', 'Надіслати' ]`), the same for the actual count,
  `× Далі follows the field on its line` (`expected <p class="_error_…" role="alert"> to be <button type="submit">`);
  `Tests 3 failed | 94 passed (97)`
- [x] 1.3 Commit the failing tests on their own (`test: red scenarios for thumb-side buttons in the number entry`)

## 2. Implementation

- [x] 2.1 `NumberEntry.tsx` + `GameScreen.module.css`: field and `Далі` in one `1fr auto` row, error below it
  (design D1); confirm buttons in the order `Змінити`, `Надіслати` (design D2). Verify every test in
  `GameScreen.test.tsx` passes
- [x] 2.2 Commit (`feat(web): next button beside the number field, send on the right`)
- [ ] 2.3 Playwright on `docker compose up --build` at 360×640 (dev login link): assert the bounding-box conditions
  of "Далі stays beside the field on a phone" and see `Змінити` left of `Надіслати`; screenshots in `.playwright-mcp/`
- [ ] 2.4 Ask the human to confirm on the iPhone through the dev bot that `Далі` is visible above the keypad

## 3. Review and check

- [ ] 3.1 Run the change-reviewer subagent on a review packet and save its reply verbatim to
  `docs/reviews/number-entry-thumb-reach.md`
- [ ] 3.2 Run the project check command and quote its summary line
