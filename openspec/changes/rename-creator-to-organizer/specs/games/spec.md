# Spec Delta

## ADDED Requirements

### Requirement: Organizer starts a game against a chosen player
`POST /api/games` SHALL create an active game in which the acting player is the organizer and the player whose id
equals `opponent_id` is the opponent. It SHALL answer `201` with the game. The opponent does not need to accept the
game.

#### Scenario: Клієнт starts a game against Тренер
- **WHEN** player `1` sends `POST /api/games` with body
  `{"opponent_id": 2, "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30}`
- **THEN** the response status is `201`
- **AND** the body parsed as JSON equals
  `{"id": 1, "organizer": {"id": 1, "name": "Клієнт"}, "opponent": {"id": 2, "name": "Тренер"}, "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30, "status": "active", "score": [{"player_id": 1, "points": 0}, {"player_id": 2, "points": 0}], "winner_id": null}`

#### Scenario: Тренер starts a game against Клієнт
- **WHEN** player `2` sends `POST /api/games` with the same body but `"opponent_id": 1`
- **THEN** the response status is `201`
- **AND** the body's `organizer` equals `{"id": 2, "name": "Тренер"}` and its `opponent` equals
  `{"id": 1, "name": "Клієнт"}`

## MODIFIED Requirements

### Requirement: Game settings are validated
A game has one penalty exercise, used for both round and final penalties. Its name SHALL be 1–60 characters after
trimming surrounding spaces and SHALL be stored trimmed. `base_reps`
and `final_reps` SHALL be whole numbers from 1 to 1000; `step_reps` a whole number from 0 to 1000. A body that breaks
any of these rules SHALL be answered with `422` and no game is created.

#### Scenario: Exercise is blank
- **WHEN** player `1` sends `POST /api/games` with the valid body from the first scenario of "Organizer starts a game
  against a chosen player" but `"exercise": "   "`
- **THEN** the response status is `422`

#### Scenario: Base reps is zero
- **WHEN** the same request is sent with `"base_reps": 0`
- **THEN** the response status is `422`

#### Scenario: Step may be zero
- **WHEN** the same request is sent with `"step_reps": 0`
- **THEN** the response status is `201`
- **AND** the body's `step_reps` equals `0`

#### Scenario: Final reps above the limit
- **WHEN** the same request is sent with `"final_reps": 1001`
- **THEN** the response status is `422`

#### Scenario: Exercise is trimmed
- **WHEN** the same request is sent with `"exercise": "  Планка  "`
- **THEN** the response status is `201`
- **AND** the body's `exercise` equals `"Планка"`

#### Scenario: Game endpoints require a player
- **WHEN** a client sends `POST /api/games` with the valid body and no `Authorization` header
- **THEN** the response status is `401`
- **AND** the body parsed as JSON equals `{"detail": "Invalid Telegram login"}`

### Requirement: A player lists their own games, newest first
`GET /api/games` SHALL return, as a JSON list in the shape of the create response, every game in which the acting
player is the organizer or the opponent, newest first, and no other games.

#### Scenario: Opponent sees the game
- **WHEN** player `1` has created games with ids `1` and `2` against player `2`, and player `2` sends
  `GET /api/games`
- **THEN** the response status is `200`
- **AND** the body is a list whose ids are `[2, 1]` in this order

#### Scenario: Other players' games are not listed
- **WHEN** player `3` `Гість` exists, player `1` has created one game against player `2`, and player `3` sends
  `GET /api/games`
- **THEN** the response status is `200`
- **AND** the body parsed as JSON equals `[]`

### Requirement: The app lists my games
After the player is known, the web app SHALL show the heading `Мої ігри` and the caller's games from
`GET /api/games`. Each game SHALL show the other player's name and the penalty exercise. With no games it SHALL show
`Ще немає ігор. Почни першу.` A button `Нова гра` SHALL open the new-game form.

#### Scenario: No games yet
- **WHEN** the app is opened as player `1` and `GET /api/games` returns `[]`
- **THEN** the page shows the text `Ще немає ігор. Почни першу.`
- **AND** the page shows the button `Нова гра`

#### Scenario: One game against Тренер
- **WHEN** the app is opened as player `1` and `GET /api/games` returns the game from the first scenario of
  "Organizer starts a game against a chosen player"
- **THEN** the page shows the texts `Тренер` and `Присідання` inside the list of games
- **AND** the page does not show `Ще немає ігор. Почни першу.`

### Requirement: Listed games show their current score
Each game in `GET /api/games` SHALL carry its current `score` — a list of `{"player_id", "points"}`, the organizer
first — and `winner_id` (`null` until someone wins), computed from its settled rounds.

#### Scenario: Score after one round
- **WHEN** player `1` has created game `1` against player `2`, one round is settled with guess `40` by player `1`,
  guess `55` by player `2` and actual `47`, and player `2` sends `GET /api/games`
- **THEN** the listed game has `score` equal to `[{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]`
- **AND** `winner_id` equal to `null`

## REMOVED Requirements

### Requirement: Creator starts a game against a chosen player
**Reason**: The game's creator is now called the organizer (spec v2.0); OpenSpec cannot rename a requirement or its scenarios inside a modified requirement.
**Migration**: "Organizer starts a game against a chosen player" — the same behaviour in the organizer's words.
