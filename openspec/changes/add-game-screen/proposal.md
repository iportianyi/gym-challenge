# Proposal

## Why

Since `add-rounds-and-scoring` the API can play a whole game, but the web app stops at the "Мої ігри" list: two
players still cannot play from their phones, which is the product's first success criterion (`docs/spec.md`,
"Критерії успіху"). This change adds the game screen, the second half of the split the human chose in explore on
2026-10-03 (`docs/autonomy-log.md` rows 48 and 61).

## What Changes

- Every game gets its own address `/games/{id}`. The list links to it, the address can be opened directly on a
  phone, and the browser's back gesture returns to the list. The web app gains client-side routing through the
  `react-router` library (new frontend dependency, approved by the human in explore, row 61).
- The game screen: scoreboard from the viewer's side (`Ти` against the other player), the current round, a
  "round result" card for the round just settled, the full round history, and the end of the game with the winner
  and the final penalty.
- The current round follows the API: enter a guess, wait for the opponent (their number stays hidden until both
  have guessed), then the creator enters the actual count and the opponent waits for it.
- A guess and the actual count go through a confirm step inside the card ("Надіслати здогадку 47? Змінити не
  вийде."), because the server cannot undo them. Values are checked on the phone against the server's 0–500 range.
- The screen of an active game asks the server again every 3 s while the tab is visible, pauses while it is hidden,
  and asks at once when the tab comes back. A finished game is not polled. A failed poll keeps the screen and says
  so quietly.
- Refused moves (`409`, `403`) are not shown as errors: the screen re-reads the game and shows what actually
  happened (for example, the round was already settled from the other phone).
- "Мої ігри" shows each game's score from the viewer's side and the mark `Завершена` for a finished game, and
  reloads the list when the player returns to it or to the tab.
- All UI copy avoids grammatical gender and does not decline player names or the exercise ("Твоя перемога",
  "Переможець — Тренер", "Твоє покарання: Присідання × 30").

No backend, API or database changes.

## Capabilities

### New Capabilities
- `game-screen`: the web app's screen for one game — its address, the scoreboard, playing the current round with a
  confirm step, the round result card, the history, the finished game, polling and how refused moves are shown.

### Modified Capabilities
- `games`: the "Мої ігри" list gains the score, the `Завершена` mark and reloading when the player returns to it.
  The existing list and form requirements are unchanged.

## Impact

- Frontend: `react-router` `8.4.0` in `frontend/package.json` and `pnpm-lock.yaml`; `frontend/src/api/games.ts`
  gains the list fields (`score`, `winner_id`, `status: "finished"`) and the detail, guess and actual calls;
  `PlayerSession` switches screens by route instead of local state; `GameList` gains links, score and the mark;
  new game screen components and styles in the existing «Табло» look; new Vitest tests, and the existing test
  fixture `GAME` in `Games.test.tsx` gains `score` and `winner_id` because the real API returns them since
  `add-rounds-and-scoring`.
- Backend: none. The server already answers `/games/{id}` with the start page (`web-shell`, "Client-side routes
  fall back to the start page").
- Docker: none beyond installing the new package in the existing frontend build stage.
