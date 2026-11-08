# Design

## Context

All words on the game screen are built in `frontend/src/game/view.ts` (`viewGame`, add-game-screen D4 and D7: no
grammatical gender, no declined names). Today one `RoundView` shape serves both the result card and every history
item, and `history` holds every settled round, so the card's round is always repeated. `GameScreen.tsx` renders, in
order: back link, heading, score, end banner, `CurrentRound`, card, history. The score is one five-column grid
(`1fr auto auto auto 1fr`) with `overflow-wrap: anywhere` on the names, which is what breaks `Олександра` mid-word.
The invite buttons sit in the two-column `.actions` grid shared with the confirm step. The penalty text is built by
`penaltyText`, with ordinary spaces around `×`. See proposal.md (Why) and the audit for the screenshots.

## Goals / Non-Goals

**Goals:**
- The words and their order come from `viewGame`, so most new scenarios are asserted in Vitest without layout.
- Layout scenarios (score, invite buttons) are checked in a real browser, as in number-entry-thumb-reach D3.

**Non-Goals:**
- A rules screen, onboarding of the invited player (audit finding 2), a rematch (7), the new-game form (8), Telegram
  theme or `BackButton` (12), the header, the list or the favicon (13–15).
- Any change to the API: everything needed (`actual`, guesses, `penalty.reps`, `penalty.doubled`) is already there.

## Decisions

### D1. Two round views: card and history line

Split `RoundView` into `CardView` (outcome, penalty, actual, two guess lines with distance or `точно`) and
`HistoryItem` (`Раунд N · у залі A`, `Ти X · <name> Y` with ` (точно)`, outcome, penalty). `viewGame` returns
`card: CardView | null` as today and `history: HistoryItem[]` without the card's round (newest first). The rule "the
card shows the last round while nobody has guessed in the next one, or the game is over" is unchanged and stays the
one place that decides both.

Alternatives: keep one shape and hide the duplicate in `GameScreen` — the rule would then live in two places;
dropping the card entirely and highlighting the newest history item — the card's place above the field (D2) is what
fixes finding 3, and the history line is too short to carry distances.

### D2. Card above the current round, outcome first

Render order becomes: score, end banner, card, `CurrentRound`, history. Inside the card the outcome and the penalty
come first, then the numbers. A finished game shows the end banner, then the card of the last round. DOM order and
visual order agree (no CSS `order`), so the reading-order scenarios hold for screen readers too.

### D3. Exact hit and doubled penalty

A guess equal to `actual` reads `<who>: <value> · точно` in the card and `<value> (точно)` in the history; the card
line gets a class with the amber colour and bold weight, the same accent the penalty already uses. The doubled mark
becomes ` (<reps / 2> ×2 за точне влучання)`. `/ 2` is the backend's `EXACT_MULTIPLIER` (`backend/app/rules.py`); the
frontend keeps a named constant with a comment pointing there rather than adding a field to the API for one number.

Alternative: send `base_reps` in `penalty` from the API — a backend and API change for a value the client can
derive; if the multiplier ever changes, the Vitest scenario with `× 20 (10 ×2 …)` and the pytest rule tests fail
together.

### D4. No-break spaces in one place

`penaltyText` joins `<exercise>`, `×` and the reps with U+00A0, and the mark as `(<base> ×2 за точне
влучання)`. Testing Library's default text matcher collapses `\s` (which includes U+00A0) into a space, so the
existing scenarios written with ordinary spaces still match; the new scenarios check the exact `textContent`.

### D5. Score as a 3-column grid with names under the digits

`grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)` with named areas `mine colon theirs` / `me . other`.
Equal tracks put the colon exactly in the middle whatever the names; each name is centred under its points. The DOM
order stays `Ти`, mine, `:`, theirs, name, so the region's text and the existing score scenarios do not change. Names
get `overflow-wrap: break-word` (breaks a word only when it alone is wider than its track) and `hyphens: manual`.

Alternatives: keep one row and shrink the names — at 320 px each name would get about 55 px, too little for
`Олександра`; truncate with an ellipsis — hides who the opponent is.

### D6. Invite buttons stacked, text without gender

The invite panel gets its own one-column grid instead of the shared `.actions`, `Копіювати посилання` first and
`Надіслати в Telegram` below it (the primary action nearer the thumb). The heading becomes
`Чекаємо суперника. Надішли посилання на гру.`; `суперник` stays as the generic word the whole app already uses.

### D7. How layout is checked

Vitest asserts texts, `textContent` with U+00A0, and reading order (`compareDocumentPosition`). The three score
scenarios and the invite-buttons scenario are checked with Playwright on `docker compose up --build` through the dev
login link, with the long name set on a test player via the name step and bounding boxes and `Range.getClientRects`
for line breaks; screenshots go to `.playwright-mcp/`. The human looks once on the iPhone through the dev bot.

## Risks / Trade-offs

- [Rewritten scenarios could hide a regression] → each rewritten test keeps its old intent (same game data, same
  roles) and only the accepted text changes, as listed in the delta; no test is deleted.
- [The card above the field pushes `Твоя здогадка` lower on a short phone] → the card is four or five short lines;
  number-entry-thumb-reach keeps `Далі` beside the field, and the browser scrolls to the focused field. Checked in
  the Playwright step at 320×640.
- [`reps / 2` is wrong if the multiplier changes] → named constant pointing to `rules.py`; scenario tests on both
  sides fail together (D3).
- [The wording is the agent's proposal] → the human may change any text in review; only the spec delta and the
  tests then change, not the approach.
