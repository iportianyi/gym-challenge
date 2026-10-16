# games Specification

## Purpose

Lets a player start a game against another player with the penalty settings fixed at the start, and see the games
they take part in; games are kept across restarts so a game can run over several gym visits.

## Requirements

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

### Requirement: Several active games are allowed
The system SHALL NOT limit how many active games a player has, including several with the same opponent.

#### Scenario: Second game with the same opponent
- **WHEN** player `1` creates a game against player `2` and then sends the same request again
- **THEN** both responses have status `201`
- **AND** the two games have different ids

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

### Requirement: Games survive a restart
Games SHALL be stored in a database file, so that a game created before the system stops is listed after it starts
again on the same file.

#### Scenario: Restart
- **WHEN** player `1` creates a game against player `2`, the system is stopped and started again on the same
  database file, and player `1` sends `GET /api/games`
- **THEN** the body is a list with exactly one game whose `exercise` equals `"Присідання"`

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

### Requirement: The list shows each game's score and whether it is finished
Each game in `Мої ігри` SHALL show its score from the viewer's side as `<my points> : <their points>` in an element
named `Рахунок`, and a game whose `status` is `finished` SHALL also show the mark `Завершена`. Games keep the
server's order, newest first.

#### Scenario: Active game seen by the opponent
- **WHEN** the app is opened as player `2` and `GET /api/games` returns game `1` of `Клієнт` against `Тренер`
  with `status` `"active"` and `score` `[{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]`
- **THEN** that game's `Рахунок` reads `0 : 1`
- **AND** the list does not show the text `Завершена`

#### Scenario: Finished game
- **WHEN** the app is opened as player `1` and `GET /api/games` returns that game with `status` `"finished"`,
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

### Requirement: The form offers every other player as the opponent
The new-game form SHALL have a select `Суперник` whose first option `Обери суперника` has no value, followed by one
option per player from `GET /api/players`, labelled with the name, in that order. With no other players it SHALL show
`Поки немає інших гравців. Попроси суперника відкрити Gym Challenge у Telegram.` If the players could not be loaded it
SHALL show `Не вдалося завантажити гравців.` In both cases `Почати гру` SHALL be disabled.

#### Scenario: Клієнт sees the other players
- **WHEN** the app is opened as player `1`, the person opens `Нова гра`, and `GET /api/players` answers
  `[{"id": 2, "name": "Тренер"}, {"id": 3, "name": "Гість"}]`
- **THEN** the select `Суперник` has the options `Обери суперника`, `Тренер`, `Гість` in this order
- **AND** `Обери суперника` is selected

#### Scenario: Nobody else yet
- **WHEN** `GET /api/players` answers `[]`
- **THEN** the page shows the text `Поки немає інших гравців. Попроси суперника відкрити Gym Challenge у Telegram.`
- **AND** the button `Почати гру` is disabled

#### Scenario: Players could not be loaded
- **WHEN** `GET /api/players` answers `500`
- **THEN** the page shows the heading `Нова гра` and the text `Не вдалося завантажити гравців.`
- **AND** the button `Почати гру` is disabled

#### Scenario: No opponent chosen
- **WHEN** the person fills `Присідання`, `10`, `5`, `30`, leaves `Обери суперника` selected and taps `Почати гру`
- **THEN** the page shows the text `Обери суперника зі списку`
- **AND** no `POST /api/games` has been sent

### Requirement: The opponent must be another registered player
`POST /api/games` SHALL answer `422` with `{"detail": "Opponent not found"}` when no player has the id
`opponent_id`, and `422` with `{"detail": "Cannot play against yourself"}` when it is the acting player's own id. No
game SHALL be created in either case.

#### Scenario: Unknown opponent
- **WHEN** player `1` sends `POST /api/games` with a valid body whose `opponent_id` is `99`
- **THEN** the response status is `422`
- **AND** the body parsed as JSON equals `{"detail": "Opponent not found"}`
- **AND** `GET /api/games` as player `1` returns `[]`

#### Scenario: Own id
- **WHEN** player `1` sends `POST /api/games` with a valid body whose `opponent_id` is `1`
- **THEN** the response status is `422`
- **AND** the body parsed as JSON equals `{"detail": "Cannot play against yourself"}`

### Requirement: The app creates a game with the chosen opponent
The form SHALL have the heading `Нова гра`, the select `Суперник`, the fields `Вправа`, `Повторень за першу поразку`,
`Додати за кожну наступну поразку поспіль`, `Повторень за програну гру`, and the buttons `Почати гру` and
`Скасувати`. On success the app SHALL open the new game's screen at `/games/{id}`; on a `422` from the server it
SHALL stay on the form and show the error in Ukrainian.

#### Scenario: Successful create
- **WHEN** the app is opened as player `1`, `GET /api/players` answers `[{"id": 2, "name": "Тренер"}]`, and the
  person chooses `Тренер` in `Суперник`, fills `Присідання`, `10`, `5`, `30` and taps `Почати гру`
- **THEN** the app sends `POST /api/games` with header `Authorization: tma <t1>` and body
  `{"opponent_id": 2, "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30}`
- **AND** after a `201` answer with game id `7` the address is `/games/7`
- **AND** the page shows the heading `Гра: Присідання`

#### Scenario: Opponent no longer exists
- **WHEN** the server answers the form's `POST /api/games` with `422` and `{"detail": "Opponent not found"}`
- **THEN** the page still shows the heading `Нова гра`
- **AND** the page shows the text `Такого гравця немає. Обери іншого.`

#### Scenario: Cancel
- **WHEN** on the form the person taps `Скасувати`
- **THEN** the page shows the heading `Мої ігри`
- **AND** no `POST /api/games` request is sent

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
