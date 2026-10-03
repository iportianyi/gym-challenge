# Spec Delta

## ADDED Requirements

### Requirement: The list shows each game's score and whether it is finished
Each game in `Мої ігри` SHALL show its score from the viewer's side as `<my points> : <their points>` in an element
named `Рахунок`, and a game whose `status` is `finished` SHALL also show the mark `Завершена`. Games keep the
server's order, newest first.

#### Scenario: Active game seen by the opponent
- **WHEN** player `Тренер` (id `2`) is chosen and `GET /api/games` returns game `1` of `Клієнт` against `Тренер`
  with `status` `"active"` and `score` `[{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]`
- **THEN** that game's `Рахунок` reads `0 : 1`
- **AND** the list does not show the text `Завершена`

#### Scenario: Finished game
- **WHEN** player `Клієнт` (id `1`) is chosen and `GET /api/games` returns that game with `status` `"finished"`,
  `winner_id` `1` and `score` `[{"player_id": 1, "points": 5}, {"player_id": 2, "points": 0}]`
- **THEN** that game's `Рахунок` reads `5 : 0`
- **AND** the game shows the text `Завершена`

### Requirement: The list is reloaded when the player returns to it
The app SHALL request `GET /api/games` again each time `Мої ігри` is shown, and when the page becomes visible again
while `Мої ігри` is shown, so that a game created on the other phone appears without reloading the app.

#### Scenario: Back from a game
- **WHEN** player `Клієнт` opens game `1` from `Мої ігри` and taps the link `Мої ігри` on its screen
- **THEN** the app has sent `GET /api/games` twice

#### Scenario: Tab becomes visible again
- **WHEN** `Мої ігри` is shown, the page becomes hidden, and then visible again
- **THEN** the app sends another `GET /api/games`
