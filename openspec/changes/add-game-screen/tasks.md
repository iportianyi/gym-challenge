# Tasks

Scope agreed with the human in explore on 2026-10-03 (`docs/autonomy-log.md` row 61): frontend only, one new
dependency (`react-router`), no backend, API or Docker changes.

## 1. Red scenario tests

- [ ] 1.1 `frontend/src/GameScreen.test.tsx`: one test per `game-screen` scenario through `<App/>`, the address set
  by `window.history.replaceState` before `render` (design D1), with the API stub and `detail(...)` builder of
  design D9; polling scenarios with fake timers and a stubbed `document.visibilityState` (design D5)
- [ ] 1.2 `frontend/src/Games.test.tsx`: the `GAME` fixture gains `score` `[{"player_id": 1, "points": 0},
  {"player_id": 2, "points": 0}]` and `winner_id` `null` (the real API shape); add one test per scenario of the two
  ADDED `games` requirements. No existing assertion changes
- [ ] 1.3 Run `docker compose --profile check run --rm frontend-check pnpm test` and quote the failing lines; all
  tests that passed before still pass
- [ ] 1.4 Commit the failing tests on their own (`test: red scenarios for the game screen and list score`)

## 2. Dependency

- [ ] 2.1 Add `react-router` `8.4.0` (exact) with `pnpm add` in the `frontend-check` container; verify
  `frontend/package.json` and `frontend/pnpm-lock.yaml` changed, `docker compose --profile check build
  frontend-check` succeeds and the existing tests still pass. On a DNS failure stop and ask the human (VPN)
- [ ] 2.2 Commit (`chore(deps): add react-router 8.4.0 (frontend)`)

## 3. API client and routing

- [ ] 3.1 `frontend/src/api/games.ts`: the types and `fetchGame`, `sendGuess`, `sendActual` of design D3; verify
  `pnpm typecheck` in `frontend-check` passes
- [ ] 3.2 `App` wraps `PlayerSession` in `BrowserRouter`; `PlayerSession` renders the routes of design D2 below the
  player gate; `GamesPage` loads the list on mount and on `visibilitychange`; `NewGameForm` navigates to `/` on
  create and cancel; `GameList` rows link to `/games/{id}` and show `Рахунок` from the viewer's side and
  `Завершена`. Verify every test in `Games.test.tsx` and `App.test.tsx` passes and the `game-screen` scenario
  "Unknown address" passes (the other `game-screen` scenarios turn green in group 4)
- [ ] 3.3 Commit (`feat(web): routes for my games, new game and game screen; score and finished mark in the list`)

## 4. Game screen

- [ ] 4.1 `frontend/src/game/view.ts`: `viewGame(detail, me)` with the phase table of design D4 and the wording of
  design D7; `frontend/src/game/view.test.ts` covers each phase row, the card rule and each phrase of D7. Verify the
  tests pass
- [ ] 4.2 `useGame` hook with the timer chain, visibility pause, move abort, refused-move re-read and offline flag
  of design D5. Verify the polling and refused-move scenarios in `GameScreen.test.tsx` pass
- [ ] 4.3 `NumberEntry` (design D6) and the `GameScreen` components: scoreboard, current round, result card,
  history, finished state, not found, back link; CSS modules on the «Табло» tokens (design D8). Verify every test in
  `GameScreen.test.tsx` passes and `pnpm lint` and `pnpm typecheck` are clean
- [ ] 4.4 Commit (`feat(web): game screen with confirm step, result card, history and polling`)

## 5. Run in the browser

- [ ] 5.1 Note whether the human's `app` container is running (`docker compose ps`); `docker compose up --build -d`
  on the existing `gym-data` volume; with Playwright at 390×844 open two browser contexts as `Клієнт` and `Тренер`,
  create a game and play it to 5 points: check the hidden guess, the confirm step, the result card on both phones
  within ~3 s, the history and both finished views. Save screenshots of each phase in `.playwright-mcp/` and look at
  them for layout problems. Restore the container to the state noted at the start

## 6. Journal

- [ ] 6.1 Add rows to `docs/autonomy-log.md` for the red tests, dependency, routing, game screen and the browser
  run, including any agent mistakes and human interventions; add implementation notes to `design.md` if reality
  differed; commit with `.agent-log/actions.jsonl`

## 7. Review and check

- [ ] 7.1 Run the change-reviewer subagent on a review packet and save its reply verbatim to
  docs/reviews/add-game-screen.md
- [ ] 7.2 Run the project check command and quote its summary line
