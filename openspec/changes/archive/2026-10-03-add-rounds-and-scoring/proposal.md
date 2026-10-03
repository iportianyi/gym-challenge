# Proposal

## Why

A game can be created, but nobody can play it: there are no rounds, no guesses and no score. The game rules
(`docs/spec.md`, "Правила гри" 1–7) are the riskiest part of the product and the main success criterion is "two
players play a full game from 0:0 to 5 and every round is counted right". This change delivers the rules and the
API to play by them, without a new screen: the human split the work in two (explore, 2026-10-03) so the rules land
fully tested by pytest first, and the game screen follows in a separate change (`add-game-screen`).

## What Changes

- A pure rules module (no database, no HTTP): from a game's settings and its settled rounds it computes each
  round's winner or draw, the score, the round penalty by the loser's streak (`base + (n − 1) × step`), the end of
  the game at 5 points, the game winner and the final penalty (no round penalty for the last round).
- Storage: rounds and guesses in SQLite (Alembic migration `0002`). Only facts are stored — guesses and the actual
  count; score, streaks and penalties are always computed by the rules module. The game status becomes `finished`
  when someone reaches 5.
- `GET /api/games/{id}` — one game as the acting player sees it: settings, score, winner, final penalty, every
  settled round, and the current round. While only one player has guessed, the other player's guess is hidden.
- `POST /api/games/{id}/guesses` — the acting player's guess for the current round (whole number 0–500), once per
  round; it cannot be changed.
- `POST /api/games/{id}/actual` — the actual count (0–500), only by the creator and only after both guesses; it
  settles the round and opens the next one or finishes the game.
- Errors: `404` for a game that does not exist or that the player does not take part in, `403` when a non-creator
  enters the actual count, `409` when the game state does not allow the move (already guessed, waiting for guesses,
  game finished), `422` for a value outside 0–500.
- **BREAKING (response shape)**: game objects from `POST /api/games` and `GET /api/games` gain `score` and `winner_id`;
  `status` may be `finished`. The current frontend ignores the extra fields.

Out of scope (next change `add-game-screen`): the game screen, polling every ~3 s, the confirm dialog before a guess
or the actual count is sent, the score in the "Мої ігри" list.

## Capabilities

### New Capabilities
- `rounds`: playing a round — viewing a game with its rounds, making one guess per round, hiding the opponent's guess
  until both have guessed, the creator entering the actual count, which moves are refused, and keeping rounds across
  restarts.
- `scoring`: what a settled round means — winner or draw, points, round penalty reps by the loss streak, the end of
  the game at 5 points, the game winner and the final penalty.

### Modified Capabilities
- `games`: the game object returned by create and list gains `score` and `winner_id`; the list shows each game's
  current score.

## Impact

- Backend: new `app/rules.py` (pure) with `tests/test_rules.py`; `app/models.py` gains `Round` and `Guess`;
  migration `app/migrations/versions/0002_rounds_and_guesses.py` (also opens round 1 for games created before it);
  `app/api/games.py` gains the detail, guess and actual endpoints and the new fields; new `tests/test_rounds.py`;
  the exact-JSON assertion in the existing `tests/test_games.py` create scenario follows the new shape.
- No new dependencies, no Docker or build changes, no frontend changes.
- API: three new endpoints under `/api/games/{id}`; create and list responses gain two fields.
