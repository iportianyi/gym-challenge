# Spec Delta

## MODIFIED Requirements

### Requirement: The first player to 5 points wins the game
When a settled round gives a player their 5th point, the game's `status` SHALL become `finished`, `winner_id` SHALL
be that player, `current_round` SHALL be `null`, and `final_penalty` SHALL be
`{"player_id": <loser>, "reps": final, "doubled": false}`, unless an exact winning guess doubled it. That last
round's `penalty` SHALL be `null`. Before that, `winner_id` and `final_penalty` SHALL be `null` and `status` `active`.

#### Scenario: Four points is not the end
- **WHEN** player `1` wins rounds 1–4
- **THEN** the game's `status` equals `"active"`, `winner_id` equals `null` and `final_penalty` equals `null`
- **AND** the game's `score` equals `[{"player_id": 1, "points": 4}, {"player_id": 2, "points": 0}]`

#### Scenario: Fifth point ends the game
- **WHEN** player `1` wins rounds 1–5
- **THEN** the game's `status` equals `"finished"` and `winner_id` equals `1`
- **AND** the game's `score` equals `[{"player_id": 1, "points": 5}, {"player_id": 2, "points": 0}]`
- **AND** `final_penalty` equals `{"player_id": 2, "reps": 30, "doubled": false}`
- **AND** the penalties of rounds 1–5 equal reps `10`, `15`, `20`, `25` for player `2` and then `null`
- **AND** `current_round` equals `null`

#### Scenario: Full game through the API
- **WHEN** players `1` and `2` play game `1` through the API with their Telegram logins: rounds 1–5 with guesses `40`
  and `60` and actual `45`, each settled by player `1`, then player `2` sends `GET /api/games`
- **THEN** the listed game has `status` `"finished"`, `winner_id` `1` and `score`
  `[{"player_id": 1, "points": 5}, {"player_id": 2, "points": 0}]`
