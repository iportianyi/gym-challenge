# Tasks

Scope: frontend only (`view.ts`, `GameScreen.tsx`, `GameScreen.module.css`, their tests); no backend, API,
dependency or harness changes. Vitest runs as
`env UID=$(id -u) GID=$(id -g) docker compose --profile check run --rm --no-deps frontend-check vitest run`.

## 1. Red scenario tests

- [x] 1.1 `frontend/src/GameScreen.test.tsx`: one test per Vitest-checkable scenario of the game-screen delta — the
  new scenarios ("Card comes before the next round", "Exact guess in the card", "The card's round is not repeated in
  the history", "One settled round shown in the card has no history", all of "The round says what is guessed" and
  "A penalty keeps its reps with the exercise"), and the scenarios whose accepted text or data changed ("Two rounds,
  newest first", all of "A doubled penalty is marked") rewritten in place to the delta, same game data and roles.
  Reading order via `compareDocumentPosition`; exact `textContent` for U+00A0. The three "score fits a phone"
  scenarios are covered by task 3.2 (design D7)
- [x] 1.2 `frontend/src/Invites.test.tsx`: the four scenarios that name `Чекаємо суперника. Надішли йому посилання.`
  rewritten to `Чекаємо суперника. Надішли посилання на гру.`; "Buttons fit a phone screen" is covered by task 3.2
  — five occurrences in four tests (one test also asserts the waiting text in its form flow)
- [x] 1.3 Run Vitest and quote the failing lines and the `Tests … failed | … passed` summary; every test outside
  1.1–1.2 still passes — `Tests  16 failed | 90 passed (106)`: the 12 game-screen tests of the doubled mark (3), no-break
  spaces (2), card order and exact guess (2), what is guessed (2: guess, actual count) and history (3), all
  `Unable to find an element with the text` or `expected false to be true`, and history `expected [ …(2) ] to have a
  length of 1 but got 2` / `expected <h3 id="history-heading" …(1)></h3> to be null`; 4 invites tests `Unable to find
  an element with the text: Чекаємо суперника. Надішли посилання на гру.`. "Nothing to explain while waiting" passes
  already (it asserts absence). ESLint and tsc clean
- [x] 1.4 Commit the failing tests on their own (`test: red scenarios for the round result, exact hit and invite copy`)

## 2. Round view and screen

- [x] 2.1 `frontend/src/game/view.ts`: split the round view into card and history item, history without the card's
  round (design D1); exact guess as `· точно` / `(точно)` and the mark ` (<base> ×2 за точне влучання)` with a named
  multiplier constant pointing to `backend/app/rules.py` (D3); no-break spaces in `penaltyText` (D4). Update
  `frontend/src/game/view.test.ts` to the new shapes and texts, keeping every case's game data; verify it passes
  — `Tests  18 passed (18)` (two new cases: the card's round left out of the history, an exact guess in both views;
  the history-order case gets a guess in round 3 so both rounds are in the history)
- [x] 2.2 `frontend/src/components/GameScreen.tsx` + `GameScreen.module.css`: card above `CurrentRound`, outcome and
  penalty first (D2); exact-guess accent (D3); the explaining texts in the guess and actual-count phases; history item
  in its three or four lines. Verify every test in `GameScreen.test.tsx` passes — all pass; Vitest
  `Tests  4 failed | 104 passed (108)`, the 4 being the invite text of task 3.1; ESLint and tsc clean
- [x] 2.3 Commit (`feat(web): round result above the next round, compact history, exact hit explained`)

## 3. Score and invite layout

- [x] 3.1 `GameScreen.module.css` (+ markup only if the grid areas need it): score as the 3-column grid with names
  under the digits and `overflow-wrap: break-word` (D5); invite panel with its own one-column button grid and the new
  heading text (D6). Verify `GameScreen.test.tsx` and `Invites.test.tsx` pass, the score region's text unchanged
  — `Tests  108 passed (108)`, the two score-region scenarios included; the markup got one grid-area class per score
  part, DOM order kept; ESLint and tsc clean
- [x] 3.2 Playwright on `docker compose up --build` via the dev login link (second player named
  `Олександра-Вікторія` in the name step): assert the bounding-box and line-break conditions of the three scenarios of
  "The score fits a phone screen" (320×640 and 375×667) and of "Buttons fit a phone screen" (320×640); see the card
  above `Раунд N` with the field still reachable at 320×640; quote the measured numbers and save screenshots in
  `.playwright-mcp/`. If `.env` holds the real bot token, run with `TELEGRAM_BOT_TOKEN=local-dev-token` from the shell
  and leave the app as it was found — seeded through the API with the dev-signed initData: players 900201 `Ти-тест`
  and 900202 `Олександра-Вікторія`, game 9 at `3 : 1` (round 4 an exact hit by the opponent, doubled `× 20`), waiting
  game 10. At 320×640 the board spans x 16–289 (middle 152.5) and the colon 148.6–156.4 (middle 152.5); the name lays
  out as `Олександра-` / `Вікторія`; `Ти` top 299.7 and the name top 287.7 are below the digits' bottom 280.1. At
  375×667 board middle 180, colon middle 180, `Ти` middle 96.5 (left half), the name 263.5 (right half). Invite at
  320×640: panel content x 33.6–290.4 (after the 4 px amber edge), `Копіювати посилання` y 406.2–454.2 and
  `Надіслати в Telegram` y 462.2–510.2, both x 33.6–290.4 and 48 px tall. No horizontal scroll. The card
  `Підсумок раунду 4` (top 382) comes before `Раунд 5` (688), exact line and penalty in amber; at 320×640 the field
  and `Далі` sit at y 848–896, below the first screen, reached by scrolling (the trade-off in design Risks). The
  rule line's `— до` wrapped to a line start, so it got a no-break space before the dash. Console: only the known
  `favicon.ico` 404 (audit 15). Screenshots `clarify-round-320.png`, `clarify-invite-320.png`; the app was not
  running before and was removed after; the test players and games stay in the local `gym-data` volume
- [x] 3.3 Commit (`feat(web): score centred with names under it, invite buttons on their own lines`)
- [ ] 3.4 Ask the human to look at a round result, an exact hit, the score and the invite screen on the iPhone through
  the dev bot, and record the answer here

## 4. Review and check

- [ ] 4.1 Run the change-reviewer subagent on a review packet and save its reply verbatim to
  `docs/reviews/clarify-round-and-result.md`
- [ ] 4.2 Run the project check command and quote its summary line
