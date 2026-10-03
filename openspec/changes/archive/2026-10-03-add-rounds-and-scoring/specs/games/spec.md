# Spec Delta

## MODIFIED Requirements

### Requirement: Creator starts a game by the opponent's email
`POST /api/games` SHALL create an active game in which the acting player (`X-Player-Id`) is the creator and the
player whose email equals `opponent_email` (ignoring surrounding spaces and letter case) is the opponent. It SHALL
answer `201` with the game. The opponent does not need to accept the game.

#### Scenario: Клієнт starts a game against Тренер
- **WHEN** a client sends `POST /api/games` with header `X-Player-Id: 1` and body
  `{"opponent_email": "coach@gym.local", "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30}`
- **THEN** the response status is `201`
- **AND** the body parsed as JSON equals
  `{"id": 1, "creator": {"id": 1, "name": "Клієнт"}, "opponent": {"id": 2, "name": "Тренер"}, "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30, "status": "active", "score": [{"player_id": 1, "points": 0}, {"player_id": 2, "points": 0}], "winner_id": null}`

#### Scenario: Email with spaces and capitals
- **WHEN** a client sends `POST /api/games` with header `X-Player-Id: 2` and a valid body whose `opponent_email` is
  `"  Client@GYM.local "`
- **THEN** the response status is `201`
- **AND** the body's `opponent` equals `{"id": 1, "name": "Клієнт"}`
- **AND** the body's `creator` equals `{"id": 2, "name": "Тренер"}`

## ADDED Requirements

### Requirement: Listed games show their current score
Each game in `GET /api/games` SHALL carry its current `score` — a list of `{"player_id", "points"}`, the creator
first — and `winner_id` (`null` until someone wins), computed from its settled rounds.

#### Scenario: Score after one round
- **WHEN** player `1` has created game `1` against `coach@gym.local`, one round is settled with guess `40` by player
  `1`, guess `55` by player `2` and actual `47`, and a client sends `GET /api/games` with header `X-Player-Id: 2`
- **THEN** the listed game has `score` equal to `[{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]`
- **AND** `winner_id` equal to `null`
