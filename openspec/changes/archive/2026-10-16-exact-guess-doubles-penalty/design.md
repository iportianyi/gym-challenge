# Design

## Context

`backend/app/rules.py` `settle()` recomputes the score, streaks and penalties from the stored guesses and actual counts
on every request. Nothing derived is stored. `backend/app/api/games.py` maps `rules.Penalty` to `PenaltyPublic`
(`player_id`, `reps`), and the frontend builds the penalty text in `frontend/src/game/view.ts` `penaltyText()`, which
is used for the result card, the history and the finished game.

## Goals / Non-Goals

**Goals:** the doubling lives in the rules module; the API says explicitly that a penalty was doubled, so the UI does
not have to work it out again.

**Non-Goals:** keeping the old penalties of games that already exist (see Risks); new game settings (the multiplier
is fixed at 2, not configurable).

## Decisions

### D1. `Penalty` gets a `doubled: bool` field, set in `settle()`

`settle()` already knows both distances. If the winner's distance is `0`, it multiplies the reps (round or final) by
`EXACT_MULTIPLIER = 2` and sets `doubled=True`. The streak counter is updated exactly as now, before the doubling, so
the next round uses the plain formula.

Alternative: return only the reps and let the frontend compare the guesses with the actual count to show the mark.
Rejected: it duplicates a rule in TypeScript, and the final penalty card would need the last round's data.

### D2. `doubled` is always present in the API

`PenaltyPublic` gets `doubled: bool` (no default), so every penalty object has it, `false` or `true`. The hand-written
TS type `Penalty` in `frontend/src/api/games.ts` gets `doubled: boolean`. An optional field would let a missing
value pass silently as "not doubled".

### D3. The mark is added in `penaltyText()`

`penaltyText()` appends ` (×2 точно)` when `penalty.doubled` is true. All three places use this one function, so
the card, the history and the final penalty stay identical. Wording is the human's choice: `×2 точно`.
Between `×2` and `точно` is a no-break space (U+00A0): the browser check at 375 px wrapped the mark in the
result card. The specs' texts compare with whitespace collapsed, as the existing UI tests do.

## Risks / Trade-offs

- [Existing games are rescored] Because penalties are recomputed from the stored guesses, a game already played with
  an exact winning guess will show doubled penalties after the update, including a finished game's final penalty.
  → Accepted: the rule always existed between the players, it was only missing from the app. The local database
  holds three games. No rule versioning per game.
- [API shape change] Clients that compare penalty objects exactly break. → The only client is this frontend, updated
  in the same change; the scenario tests that compare whole objects are updated to include `doubled`.
