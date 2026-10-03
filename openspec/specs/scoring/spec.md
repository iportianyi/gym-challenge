# scoring Specification

## Purpose

Decides what each settled round means under the game rules of `docs/spec.md` — who scores, who does the round
penalty and how many reps, when the game ends and what the loser of the game does.

## Requirements

### Requirement: The closer guess wins the round
A settled round's distance for each player SHALL be `|guess − actual|`. The player with the smaller distance SHALL be
the round's winner (`winner_id`) and SHALL get 1 point in `score`.

In the scenarios below the game is between player `1` (creator) and player `2` (opponent) with base `10`, step `5`,
final `30` unless stated otherwise; a round is written as (guess of `1`, guess of `2`, actual).

#### Scenario: Player 1 is closer
- **WHEN** the first round is settled as (`40`, `55`, `47`)
- **THEN** that round's `winner_id` equals `1`
- **AND** the game's `score` equals `[{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]`

#### Scenario: Exact guess
- **WHEN** the first round is settled as (`50`, `47`, `47`)
- **THEN** that round's `winner_id` equals `2`

### Requirement: Equal distances are a draw
When both distances are equal, the round's `winner_id` and `penalty` SHALL be `null`, nobody SHALL get a point, and
the loss streaks of both players SHALL restart.

#### Scenario: Draw
- **WHEN** the first round is settled as (`40`, `54`, `47`)
- **THEN** that round's `winner_id` equals `null` and its `penalty` equals `null`
- **AND** the game's `score` equals `[{"player_id": 1, "points": 0}, {"player_id": 2, "points": 0}]`

### Requirement: The round loser does a penalty that grows in a loss streak
The loser of a round that does not end the game SHALL get `penalty`
`{"player_id": <loser>, "reps": base + (n − 1) × step}`, where `n` is the number of rounds the loser has lost in a
row, counting this one. A round the player wins and a draw SHALL end that player's streak.

#### Scenario: Three losses in a row
- **WHEN** player `2` loses rounds 1, 2 and 3
- **THEN** the penalties of rounds 1, 2 and 3 equal `{"player_id": 2, "reps": 10}`, `{"player_id": 2, "reps": 15}`
  and `{"player_id": 2, "reps": 20}`

#### Scenario: Own win ends the streak
- **WHEN** player `2` loses rounds 1 and 2, wins round 3 and loses round 4
- **THEN** the penalties of rounds 1–4 equal `{"player_id": 2, "reps": 10}`, `{"player_id": 2, "reps": 15}`,
  `{"player_id": 1, "reps": 10}` and `{"player_id": 2, "reps": 10}`

#### Scenario: Draw ends the streak
- **WHEN** player `2` loses rounds 1 and 2, round 3 is a draw and player `2` loses round 4
- **THEN** the penalties of rounds 1–4 equal `{"player_id": 2, "reps": 10}`, `{"player_id": 2, "reps": 15}`,
  `null` and `{"player_id": 2, "reps": 10}`

#### Scenario: Zero step keeps the reps
- **WHEN** in a game with base `10`, step `0`, final `30` player `2` loses rounds 1, 2 and 3
- **THEN** every one of these penalties equals `{"player_id": 2, "reps": 10}`

### Requirement: The first player to 5 points wins the game
When a settled round gives a player their 5th point, the game's `status` SHALL become `finished`, `winner_id` SHALL
be that player, `current_round` SHALL be `null`, and `final_penalty` SHALL be `{"player_id": <loser>, "reps": final}`.
That last round's `penalty` SHALL be `null`. Before that, `winner_id` and `final_penalty` SHALL be `null` and
`status` `active`.

#### Scenario: Four points is not the end
- **WHEN** player `1` wins rounds 1–4
- **THEN** the game's `status` equals `"active"`, `winner_id` equals `null` and `final_penalty` equals `null`
- **AND** the game's `score` equals `[{"player_id": 1, "points": 4}, {"player_id": 2, "points": 0}]`

#### Scenario: Fifth point ends the game
- **WHEN** player `1` wins rounds 1–5
- **THEN** the game's `status` equals `"finished"` and `winner_id` equals `1`
- **AND** the game's `score` equals `[{"player_id": 1, "points": 5}, {"player_id": 2, "points": 0}]`
- **AND** `final_penalty` equals `{"player_id": 2, "reps": 30}`
- **AND** the penalties of rounds 1–5 equal reps `10`, `15`, `20`, `25` for player `2` and then `null`
- **AND** `current_round` equals `null`

#### Scenario: Full game through the API
- **WHEN** players `1` and `2` play game `1` through the API: rounds 1–5 with guesses `40` and `60` and actual `45`,
  each settled by player `1`, then a client sends `GET /api/games` with header `X-Player-Id: 2`
- **THEN** the listed game has `status` `"finished"`, `winner_id` `1` and `score`
  `[{"player_id": 1, "points": 5}, {"player_id": 2, "points": 0}]`
