# Spec Delta

## ADDED Requirements

### Requirement: The organizer enters the actual count after both guesses
`POST /api/games/{id}/actual` with body `{"value": <count>}` SHALL settle the current round with that actual count
and answer `200` with the game: the round moves to `rounds`, and a new current round opens unless the game has
just finished. The count SHALL be a whole number from 0 to 500, otherwise `422`. The opponent
SHALL get `403` with `{"detail": "Only the organizer enters the actual count"}`. Before both players have guessed the
answer SHALL be `409` with `{"detail": "Waiting for guesses"}`.

#### Scenario: Organizer settles the round
- **WHEN** in game `1` player `1` has guessed `40`, player `2` has guessed `55`, and player `1` sends
  `POST /api/games/1/actual` with body `{"value": 47}`
- **THEN** the response status is `200`
- **AND** the body's `rounds` has one item whose `actual` equals `47`
- **AND** the body's `current_round.number` equals `2`

#### Scenario: Opponent cannot enter the actual count
- **WHEN** in game `1` both players have guessed and player `2` sends `POST /api/games/1/actual` with body
  `{"value": 47}`
- **THEN** the response status is `403`
- **AND** the body parsed as JSON equals `{"detail": "Only the organizer enters the actual count"}`
- **AND** `GET /api/games/1` as player `1` has `rounds` equal to `[]`

#### Scenario: Actual count before both guesses
- **WHEN** in game `1` only player `1` has guessed and player `1` sends `POST /api/games/1/actual` with body
  `{"value": 47}`
- **THEN** the response status is `409`
- **AND** the body parsed as JSON equals `{"detail": "Waiting for guesses"}`

#### Scenario: Actual count out of range
- **WHEN** in game `1` both players have guessed and player `1` sends `POST /api/games/1/actual` with body
  `{"value": 501}`
- **THEN** the response status is `422`
- **AND** `GET /api/games/1` as player `1` has `rounds` equal to `[]`

## MODIFIED Requirements

### Requirement: A participant sees one game with its rounds
`GET /api/games/{id}` SHALL answer `200` with the game as the acting player sees it: the fields of the game object,
`final_penalty`, `rounds` (every settled round, oldest first) and `current_round` (the round being played, or `null`
when the game is finished). A settled round has `number`, `guesses`, `actual`, `winner_id` and `penalty`. The
current round has `number` and `guesses`. Every per-player list has one entry per player, the organizer first.

#### Scenario: New game
- **WHEN** player `1` has created game `1` against player `2` with exercise `Присідання`, base `10`, step `5`,
  final `30`, and player `2` sends `GET /api/games/1`
- **THEN** the response status is `200`
- **AND** the body parsed as JSON equals
  `{"id": 1, "organizer": {"id": 1, "name": "Клієнт"}, "opponent": {"id": 2, "name": "Тренер"}, "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30, "status": "active", "score": [{"player_id": 1, "points": 0}, {"player_id": 2, "points": 0}], "winner_id": null, "final_penalty": null, "rounds": [], "current_round": {"number": 1, "guesses": [{"player_id": 1, "guessed": false, "value": null}, {"player_id": 2, "guessed": false, "value": null}]}}`

#### Scenario: One settled round
- **WHEN** in game `1` (settings as above) player `1` guesses `40`, player `2` guesses `55`, player `1` enters the
  actual count `47`, and player `1` sends `GET /api/games/1`
- **THEN** the body's `rounds` equals
  `[{"number": 1, "guesses": [{"player_id": 1, "value": 40}, {"player_id": 2, "value": 55}], "actual": 47, "winner_id": 1, "penalty": {"player_id": 2, "reps": 10, "doubled": false}}]`
- **AND** the body's `current_round` equals
  `{"number": 2, "guesses": [{"player_id": 1, "guessed": false, "value": null}, {"player_id": 2, "guessed": false, "value": null}]}`
- **AND** the body's `score` equals `[{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]`

### Requirement: Only the game's players can see or play it
Every `/api/games/{id}` endpoint SHALL answer `404` with `{"detail": "Game not found"}` when no game has that id or
the acting player is neither its organizer nor its opponent, and SHALL change nothing.

#### Scenario: No such game
- **WHEN** player `1` sends `GET /api/games/99`
- **THEN** the response status is `404`
- **AND** the body parsed as JSON equals `{"detail": "Game not found"}`

#### Scenario: Someone else's game
- **WHEN** player `3` `Гість` exists, player `1` has created game `1` against player `2`, and player `3` sends
  `POST /api/games/1/guesses` with body `{"value": 40}`
- **THEN** the response status is `404`
- **AND** the body parsed as JSON equals `{"detail": "Game not found"}`
- **AND** `GET /api/games/1` as player `1` has no entry with `guessed` `true` in `current_round.guesses`

### Requirement: A finished game takes no more moves
When a game's `status` is `finished`, `POST /api/games/{id}/guesses` and `POST /api/games/{id}/actual` by its
players SHALL answer `409` with `{"detail": "Game is finished"}` and change nothing; for the actual count the
organizer check comes first.

#### Scenario: Guess after the end
- **WHEN** player `1` has won game `1` by 5 points and player `2` sends `POST /api/games/1/guesses` with body
  `{"value": 40}`
- **THEN** the response status is `409`
- **AND** the body parsed as JSON equals `{"detail": "Game is finished"}`

#### Scenario: Actual count after the end
- **WHEN** player `1` has won game `1` by 5 points and player `1` sends `POST /api/games/1/actual` with body
  `{"value": 47}`
- **THEN** the response status is `409`
- **AND** the body parsed as JSON equals `{"detail": "Game is finished"}`

## REMOVED Requirements

### Requirement: The creator enters the actual count after both guesses
**Reason**: The game's creator is now called the organizer (spec v2.0); OpenSpec cannot rename a requirement or its scenarios inside a modified requirement.
**Migration**: "The organizer enters the actual count after both guesses" — the same behaviour in the organizer's words.
