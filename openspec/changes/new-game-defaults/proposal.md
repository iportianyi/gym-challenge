# Proposal

## Why

Finding 8 of the UX audit (`docs/ux-audit-2026-10-20.md`, P2): the new-game form's three number fields are empty,
with no example, so the organizer has to invent every value before the first game. The human narrowed the finding to
one fix: the fields start with sensible defaults — the same numbers as the example in `docs/spec.md` (base 10, step 5)
and the final penalty 30 — so a game can be started by typing only the exercise.

## What Changes

- The new-game form opens with `Повторень за першу поразку` = `10`, `Додати за кожну наступну поразку поспіль` = `5`
  and `Повторень за програну гру` = `30`. They stay ordinary editable fields with the same limits as today
  (`1…1000`, `0…1000`, `1…1000`, whole numbers).
- Submitting without touching them sends `base_reps` `10`, `step_reps` `5`, `final_reps` `30`.
- `Вправа` stays empty (the human named only the numbers).
- Out of scope, as the human decided: the field labels, the browser's validation messages and the fields turning red
  on an empty submit — the rest of finding 8 stays open in `docs/next-steps.md`.
- No server change: `POST /api/games` still requires all three values; the defaults live only in the form.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `games`: the requirement "The app creates a game with the chosen opponent" states the prefilled values, with
  scenarios for the opened form and for a submit that keeps them.

## Impact

- Frontend: `frontend/src/components/NewGameForm.tsx` (`defaultValue` on the three reps inputs), tests in
  `frontend/src/Games.test.tsx`.
- No backend, database, dependency or harness change. After the change, `fly deploy` (asked first, per `CLAUDE.md`).
