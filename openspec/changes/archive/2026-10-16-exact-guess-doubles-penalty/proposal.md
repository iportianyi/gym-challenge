# Proposal

## Why

The players have one more rule that `docs/spec.md` never recorded: when the round winner names the exact number of
people in the gym, the loser's penalty doubles. Without it the app gives a smaller penalty than the players agreed on.

## What Changes

- A round won with an exact guess (distance `0`) doubles the loser's round penalty:
  `reps = (base + (n − 1) × step) × 2`. The loss streak counts as before, and the doubling stays in that one round.
- If the round that ends the game is won with an exact guess, the final penalty doubles: `final × 2`.
- Both players exact is still a draw (equal distances): no point and no penalty.
- **BREAKING (API)**: every penalty object (`rounds[].penalty`, `final_penalty`) gets a `doubled` field, `true` when
  the exact guess doubled it and `false` otherwise.
- The game screen marks a doubled penalty with `(×2 точно)` after the reps, in the result card, the round
  history and the finished game.
- `docs/spec.md` gets the rule in «Правила гри» (v1.6).

No database changes: penalties are recomputed from stored guesses, so games that already exist are rescored under
the new rule (see design).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `scoring`: the round penalty and the final penalty double after an exact winning guess; penalty objects carry
  `doubled`.
- `rounds`: the settled round in `GET /api/games/{id}` shows the new `doubled` field.
- `game-screen`: a doubled penalty is shown with the mark `(×2 точно)`.

## Impact

- Backend: `backend/app/rules.py` (`Penalty`, `settle`), `backend/app/api/games.py` (`PenaltyPublic`,
  `penalty_public`); tests `backend/tests/test_rules.py`, `test_rounds.py`.
- Frontend: `frontend/src/api/games.ts` (`Penalty` type), `frontend/src/game/view.ts` (`penaltyText`); tests
  `frontend/src/game/view.test.ts`, `GameScreen.test.tsx`.
- Docs: `docs/spec.md` «Правила гри».
- No new dependencies, no migration, no Docker changes.
