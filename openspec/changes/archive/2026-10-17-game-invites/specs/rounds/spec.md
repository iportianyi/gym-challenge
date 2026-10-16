# Spec Delta

## MODIFIED Requirements

### Requirement: A participant sees one game with its rounds
`GET /api/games/{id}` SHALL answer `200` with the game as the acting player sees it: the fields of the game object,
`final_penalty`, `rounds` (every settled round, oldest first), `current_round` (the round being played, or `null`
when the game is finished or still waiting for its opponent) and `invite_url` (capability `invites`). A settled round
has `number`, `guesses`, `actual`, `winner_id` and `penalty`. The current round has `number` and `guesses`. Every
per-player list has one entry per player, the organizer first.

In API scenarios "player `1` has created game `1` against player `2`" means player `1` created invite game `1` and
player `2` joined it (capability `invites`).

#### Scenario: New game
- **WHEN** player `1` has created game `1` against player `2` with exercise `Присідання`, base `10`, step `5`,
  final `30`, and player `2` sends `GET /api/games/1`
- **THEN** the response status is `200`
- **AND** the body parsed as JSON equals
  `{"id": 1, "organizer": {"id": 1, "name": "Клієнт"}, "opponent": {"id": 2, "name": "Тренер"}, "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30, "status": "active", "score": [{"player_id": 1, "points": 0}, {"player_id": 2, "points": 0}], "winner_id": null, "final_penalty": null, "rounds": [], "current_round": {"number": 1, "guesses": [{"player_id": 1, "guessed": false, "value": null}, {"player_id": 2, "guessed": false, "value": null}]}, "invite_url": null}`

#### Scenario: One settled round
- **WHEN** in game `1` (settings as above) player `1` guesses `40`, player `2` guesses `55`, player `1` enters the
  actual count `47`, and player `1` sends `GET /api/games/1`
- **THEN** the body's `rounds` equals
  `[{"number": 1, "guesses": [{"player_id": 1, "value": 40}, {"player_id": 2, "value": 55}], "actual": 47, "winner_id": 1, "penalty": {"player_id": 2, "reps": 10, "doubled": false}}]`
- **AND** the body's `current_round` equals
  `{"number": 2, "guesses": [{"player_id": 1, "guessed": false, "value": null}, {"player_id": 2, "guessed": false, "value": null}]}`
- **AND** the body's `score` equals `[{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]`
- **AND** the body's `invite_url` equals `null`
