# games Specification

## Purpose

Lets a player start a game against another player with the penalty settings fixed at the start, and see the games
they take part in; games are kept across restarts so a game can run over several gym visits.

## Requirements

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

### Requirement: The opponent must be another existing player
`POST /api/games` SHALL answer `422` with `{"detail": "Opponent not found"}` when no player has the given email, and
`422` with `{"detail": "Cannot play against yourself"}` when the email is the acting player's own. No game SHALL be
created in either case.

#### Scenario: Unknown email
- **WHEN** a client sends `POST /api/games` with header `X-Player-Id: 1` and a valid body whose `opponent_email` is
  `"nobody@gym.local"`
- **THEN** the response status is `422`
- **AND** the body parsed as JSON equals `{"detail": "Opponent not found"}`
- **AND** `GET /api/games` with header `X-Player-Id: 1` returns `[]`

#### Scenario: Own email
- **WHEN** a client sends `POST /api/games` with header `X-Player-Id: 1` and a valid body whose `opponent_email` is
  `"client@gym.local"`
- **THEN** the response status is `422`
- **AND** the body parsed as JSON equals `{"detail": "Cannot play against yourself"}`

### Requirement: Game settings are validated
A game has one penalty exercise, used for both round and final penalties. Its name SHALL be 1–60 characters after
trimming surrounding spaces and SHALL be stored trimmed. `base_reps`
and `final_reps` SHALL be whole numbers from 1 to 1000; `step_reps` a whole number from 0 to 1000. A body that breaks
any of these rules SHALL be answered with `422` and no game is created.

#### Scenario: Exercise is blank
- **WHEN** a client sends `POST /api/games` with header `X-Player-Id: 1` and the valid body from the first scenario
  but `"exercise": "   "`
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
- **WHEN** a client sends `POST /api/games` with the valid body from the first scenario and no `X-Player-Id` header
- **THEN** the response status is `401`

### Requirement: Several active games are allowed
The system SHALL NOT limit how many active games a player has, including several with the same opponent.

#### Scenario: Second game with the same opponent
- **WHEN** player `1` creates a game against `coach@gym.local` and then sends the same request again
- **THEN** both responses have status `201`
- **AND** the two games have different ids

### Requirement: A player lists their own games, newest first
`GET /api/games` SHALL return, as a JSON list in the shape of the create response, every game in which the acting
player is the creator or the opponent, newest first, and no other games.

#### Scenario: Opponent sees the game
- **WHEN** player `1` has created games with ids `1` and `2` against player `2`, and a client sends `GET /api/games`
  with header `X-Player-Id: 2`
- **THEN** the response status is `200`
- **AND** the body is a list whose ids are `[2, 1]` in this order

#### Scenario: Other players' games are not listed
- **WHEN** a third player `Гість` with email `guest@gym.local` exists in the database (inserted by the test),
  player `1` has created one game against `coach@gym.local`, and a client sends `GET /api/games` with the
  `X-Player-Id` of `Гість`
- **THEN** the response status is `200`
- **AND** the body parsed as JSON equals `[]`

### Requirement: Games survive a restart
Games SHALL be stored in a database file, so that a game created before the system stops is listed after it starts
again on the same file.

#### Scenario: Restart
- **WHEN** player `1` creates a game against `coach@gym.local`, the system is stopped and started again on the same
  database file, and a client sends `GET /api/games` with header `X-Player-Id: 1`
- **THEN** the body is a list with exactly one game whose `exercise` equals `"Присідання"`

### Requirement: The app lists my games
After a player is chosen, the web app SHALL show the heading `Мої ігри` and the caller's games from `GET /api/games`.
Each game SHALL show the other player's name and the penalty exercise. With no games it SHALL show
`Ще немає ігор. Почни першу.` A button `Нова гра` SHALL open the new-game form.

#### Scenario: No games yet
- **WHEN** the player `Клієнт` is chosen and `GET /api/games` returns `[]`
- **THEN** the page shows the text `Ще немає ігор. Почни першу.`
- **AND** the page shows the button `Нова гра`

#### Scenario: One game against Тренер
- **WHEN** the player `Клієнт` is chosen and `GET /api/games` returns the game from the first scenario of
  "Creator starts a game by the opponent's email"
- **THEN** the page shows the texts `Тренер` and `Присідання` inside the list of games
- **AND** the page does not show `Ще немає ігор. Почни першу.`

### Requirement: The app creates a game from a form
The form SHALL have the heading `Нова гра`, the fields `Email суперника`, `Вправа`, `Повторень за першу поразку`,
`Додати за кожну наступну поразку поспіль`, `Повторень за програну гру`, and the
buttons `Почати гру` and `Скасувати`. On success the app SHALL open the new game's screen at `/games/{id}`; on a
`422` from the server it SHALL stay on the form and show the error in Ukrainian.

#### Scenario: Successful create
- **WHEN** player `Клієнт` fills the form with `coach@gym.local`, `Присідання`, `10`, `5`, `30` and taps
  `Почати гру`
- **THEN** the app sends `POST /api/games` with header `X-Player-Id: 1` and body
  `{"opponent_email": "coach@gym.local", "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30}`
- **AND** after a `201` answer with game id `7` the address is `/games/7`
- **AND** the page shows the heading `Гра: Присідання`

#### Scenario: Unknown opponent email
- **WHEN** the server answers the form's `POST /api/games` with `422` and `{"detail": "Opponent not found"}`
- **THEN** the page still shows the heading `Нова гра`
- **AND** the page shows the text `Гравця з таким email немає`

#### Scenario: Own email
- **WHEN** the server answers the form's `POST /api/games` with `422` and `{"detail": "Cannot play against yourself"}`
- **THEN** the page shows the text `Це твій email. Введи email суперника.`

#### Scenario: Cancel
- **WHEN** on the form the person taps `Скасувати`
- **THEN** the page shows the heading `Мої ігри`
- **AND** no `POST /api/games` request is sent

### Requirement: Listed games show their current score
Each game in `GET /api/games` SHALL carry its current `score` — a list of `{"player_id", "points"}`, the creator
first — and `winner_id` (`null` until someone wins), computed from its settled rounds.

#### Scenario: Score after one round
- **WHEN** player `1` has created game `1` against `coach@gym.local`, one round is settled with guess `40` by player
  `1`, guess `55` by player `2` and actual `47`, and a client sends `GET /api/games` with header `X-Player-Id: 2`
- **THEN** the listed game has `score` equal to `[{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]`
- **AND** `winner_id` equal to `null`

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

### Requirement: The form names the other players' emails
Under the field `Email суперника` the form SHALL show one line `<name>: <email>` for every player from
`GET /api/players` except the acting player, in the order of that list, and the field SHALL be described by these
lines for assistive technology. The field SHALL stay empty until the person types. If the players could not be
loaded, the form SHALL work without the hint.

#### Scenario: Клієнт sees Тренер's email
- **WHEN** player `Клієнт` (id `1`) opens `Нова гра` and `GET /api/players` answered the two default players
- **THEN** the page shows the text `Тренер: coach@gym.local`
- **AND** the page does not show the text `Клієнт: client@gym.local`
- **AND** the field `Email суперника` has the value `""`

#### Scenario: Тренер sees Клієнт's email
- **WHEN** player `Тренер` (id `2`) opens `Нова гра` and `GET /api/players` answered the two default players
- **THEN** the page shows the text `Клієнт: client@gym.local`
- **AND** the page does not show the text `Тренер: coach@gym.local`

#### Scenario: Players could not be loaded
- **WHEN** player id `1` is remembered, `GET /api/players` answers `500`, and the person opens `Нова гра`
- **THEN** the page shows the heading `Нова гра` and the field `Email суперника`
- **AND** the page shows no text containing `@gym.local`
