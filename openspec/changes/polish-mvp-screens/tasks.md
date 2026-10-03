# Tasks

Scope decided by the human after the MVP review on 2026-10-03 (`docs/autonomy-log.md` row 72): frontend only, no
backend, API, Docker or dependency changes.

## 1. Red scenario tests

- [x] 1.1 `frontend/src/App.test.tsx`: the greeting scenarios with `Gym Challenge` (the failing request becomes
  `GET /api/players`) and the new scenario "No server status"; delete the four tests of the removed requirement
  (design D4)
- [x] 1.2 `frontend/src/Games.test.tsx`: "Successful create" asserts the address `/games/7` and the heading
  `Гра: Присідання` (the stub answers `GET /api/games/7` with a game detail); one test per scenario of "The form
  names the other players' emails"
- [x] 1.3 Run `env UID=$(id -u) GID=$(id -g) docker compose --profile check run --rm --no-deps frontend-check vitest
  run` and quote the failing lines; every test outside these scenarios still passes
- [x] 1.4 Commit the failing tests on their own (`test: red scenarios for game open after create, email hint and the
  plain heading`), the message naming the four deleted status tests and why

## 2. Implementation

- [x] 2.1 `App.tsx`: heading `Gym Challenge`, no health request and no status; drop `.status*` from
  `App.module.css`; delete `api/health.ts` (design D3). Verify the `App.test.tsx` tests pass
- [x] 2.2 `PlayerSession.tsx`: `onCreated` navigates to `/games/{id}` with `replace` (design D2) and passes the other
  players to `NewGameForm`; `NewGameForm.tsx` renders the hint list with `aria-describedby` (design D1). Verify every
  test in `Games.test.tsx` and `GameScreen.test.tsx` passes
- [x] 2.3 Commit (`feat(web): open the new game after create, opponent email hint, plain Gym Challenge heading`)
- [x] 2.4 Browser check with Playwright on `docker compose up --build` at a phone width (restore the human's `app`
  container state afterwards): create a game as `Клієнт`, see the hint and land on the game screen; screenshot in
  `.playwright-mcp/`

## 3. Review and check

- [x] 3.1 At archive, update the Purpose of `openspec/specs/web-shell/spec.md` (it still promises a reachability
  signal) and verify `pnpm spec:check` passes
- [ ] 3.2 Run the change-reviewer subagent on a review packet and save its reply verbatim to
  `docs/reviews/polish-mvp-screens.md`
- [ ] 3.3 Run the project check command and quote its summary line
