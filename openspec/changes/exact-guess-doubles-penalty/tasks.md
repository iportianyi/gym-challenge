# Tasks

## 1. Product rule

- [ ] 1.1 Add the exact-guess rule to `docs/spec.md` «Правила гри» (round penalty ×2, final penalty ×2 when the last
  round is won exactly, both exact is a draw), bump the status line to v1.6, and commit it as `docs(spec)`; verify
  with `git show --stat HEAD` that only `docs/spec.md` changed

## 2. Failing scenario tests

- [ ] 2.1 Backend: in `backend/tests/test_rules.py` add one test per new `scoring` scenario (exact first penalty,
  exact inside a streak, both exact is a draw, exact last round doubles the final penalty) and make the existing
  penalty assertions include `doubled=False`; in `backend/tests/test_rounds.py` add `"doubled": false` to the
  penalty objects of "One settled round" and the full-game test; run pytest through
  `docker compose --profile check run --rm backend-check` and quote the failing lines
- [ ] 2.2 Frontend: in `frontend/src/game/view.test.ts` and `frontend/src/GameScreen.test.tsx` add one test per
  `game-screen` scenario of "A doubled penalty is marked" and add `doubled: false` to existing penalty fixtures; run
  Vitest through `frontend-check` and quote the failing lines

## 3. Backend

- [ ] 3.1 In `backend/app/rules.py` add `doubled: bool` to `Penalty` and, in `settle()`, multiply the round or final
  reps by `EXACT_MULTIPLIER = 2` when the winner's distance is `0` (design D1); verify the `scoring` tests in
  `test_rules.py` pass
- [ ] 3.2 In `backend/app/api/games.py` add `doubled: bool` to `PenaltyPublic` and pass it in `penalty_public()`
  (design D2); verify `test_rounds.py` passes

## 4. Frontend

- [ ] 4.1 Add `doubled: boolean` to `Penalty` in `frontend/src/api/games.ts` and append ` (×2 точно)` in
  `penaltyText()` in `frontend/src/game/view.ts` when it is true (design D3); verify the Vitest scenarios from 2.2
  pass and `tsc` is clean
- [ ] 4.2 Check the result card and the history in the browser (Playwright on `localhost`) with a round won by an
  exact guess; verify the text `(×2 точно)` is visible and fits on a phone-width screen

## 5. Review and check

- [ ] 5.1 Run the change-reviewer subagent on a review packet and save its reply verbatim to
  `docs/reviews/exact-guess-doubles-penalty.md`
- [ ] 5.2 Run the project check command (`make check`) and quote its summary line
