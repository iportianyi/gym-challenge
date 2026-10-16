# Spec Delta

## ADDED Requirements

### Requirement: An exact winning guess doubles the penalty
When the round winner's distance is `0`, the loser's penalty for that round SHALL have its reps multiplied by 2 and
`doubled` `true`; if that round ends the game, the final penalty SHALL be `final × 2` with `doubled` `true` instead.
The doubling SHALL apply to that round only and SHALL NOT change how the loss streak is counted. A penalty that was
not doubled SHALL have `doubled` `false`.

#### Scenario: Exact guess doubles the first penalty
- **WHEN** the first round is settled as (`50`, `47`, `47`)
- **THEN** that round's `winner_id` equals `2`
- **AND** its `penalty` equals `{"player_id": 1, "reps": 20, "doubled": true}`

#### Scenario: Exact guess inside a loss streak
- **WHEN** player `2` loses round 1 as (`45`, `40`, `46`), round 2 as (`46`, `40`, `46`) and round 3 as
  (`45`, `40`, `46`)
- **THEN** the penalties of rounds 1–3 equal `{"player_id": 2, "reps": 10, "doubled": false}`,
  `{"player_id": 2, "reps": 30, "doubled": true}` and `{"player_id": 2, "reps": 20, "doubled": false}`

#### Scenario: Both guesses exact is a draw
- **WHEN** the first round is settled as (`47`, `47`, `47`)
- **THEN** that round's `winner_id` equals `null` and its `penalty` equals `null`
- **AND** the game's `score` equals `[{"player_id": 1, "points": 0}, {"player_id": 2, "points": 0}]`

#### Scenario: Exact guess in the last round doubles the final penalty
- **WHEN** player `1` wins rounds 1–4 as (`45`, `40`, `46`) and round 5 as (`46`, `40`, `46`)
- **THEN** the game's `status` equals `"finished"` and `winner_id` equals `1`
- **AND** round 5's `penalty` equals `null`
- **AND** `final_penalty` equals `{"player_id": 2, "reps": 60, "doubled": true}`

## MODIFIED Requirements

### Requirement: The round loser does a penalty that grows in a loss streak
The loser of a round that does not end the game SHALL get `penalty`
`{"player_id": <loser>, "reps": base + (n − 1) × step, "doubled": false}`, where `n` is the number of rounds the
loser has lost in a row, counting this one; an exact winning guess changes `reps` and `doubled` as the requirement
"An exact winning guess doubles the penalty" says. A round the player wins and a draw SHALL end that player's streak.

#### Scenario: Three losses in a row
- **WHEN** player `2` loses rounds 1, 2 and 3
- **THEN** the penalties of rounds 1, 2 and 3 equal `{"player_id": 2, "reps": 10, "doubled": false}`,
  `{"player_id": 2, "reps": 15, "doubled": false}` and `{"player_id": 2, "reps": 20, "doubled": false}`

#### Scenario: Own win ends the streak
- **WHEN** player `2` loses rounds 1 and 2, wins round 3 and loses round 4
- **THEN** the penalties of rounds 1–4 equal `{"player_id": 2, "reps": 10, "doubled": false}`,
  `{"player_id": 2, "reps": 15, "doubled": false}`, `{"player_id": 1, "reps": 10, "doubled": false}` and
  `{"player_id": 2, "reps": 10, "doubled": false}`

#### Scenario: Draw ends the streak
- **WHEN** player `2` loses rounds 1 and 2, round 3 is a draw and player `2` loses round 4
- **THEN** the penalties of rounds 1–4 equal `{"player_id": 2, "reps": 10, "doubled": false}`,
  `{"player_id": 2, "reps": 15, "doubled": false}`, `null` and `{"player_id": 2, "reps": 10, "doubled": false}`

#### Scenario: Zero step keeps the reps
- **WHEN** in a game with base `10`, step `0`, final `30` player `2` loses rounds 1, 2 and 3
- **THEN** every one of these penalties equals `{"player_id": 2, "reps": 10, "doubled": false}`

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
- **WHEN** players `1` and `2` play game `1` through the API: rounds 1–5 with guesses `40` and `60` and actual `45`,
  each settled by player `1`, then a client sends `GET /api/games` with header `X-Player-Id: 2`
- **THEN** the listed game has `status` `"finished"`, `winner_id` `1` and `score`
  `[{"player_id": 1, "points": 5}, {"player_id": 2, "points": 0}]`
