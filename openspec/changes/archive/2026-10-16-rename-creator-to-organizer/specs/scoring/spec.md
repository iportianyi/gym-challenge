# Spec Delta

## MODIFIED Requirements

### Requirement: The closer guess wins the round
A settled round's distance for each player SHALL be `|guess − actual|`. The player with the smaller distance SHALL be
the round's winner (`winner_id`) and SHALL get 1 point in `score`.

In the scenarios below the game is between player `1` (organizer) and player `2` (opponent) with base `10`, step `5`,
final `30` unless stated otherwise; a round is written as (guess of `1`, guess of `2`, actual).

#### Scenario: Player 1 is closer
- **WHEN** the first round is settled as (`40`, `55`, `47`)
- **THEN** that round's `winner_id` equals `1`
- **AND** the game's `score` equals `[{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]`

#### Scenario: Exact guess
- **WHEN** the first round is settled as (`50`, `47`, `47`)
- **THEN** that round's `winner_id` equals `2`
