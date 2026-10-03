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
  `{"id": 1, "creator": {"id": 1, "name": "Клієнт"}, "opponent": {"id": 2, "name": "Тренер"}, "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30, "status": "active"}`

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
buttons `Почати гру` and `Скасувати`. On success the app SHALL show `Мої ігри` with the new game; on a `422` from the
server it SHALL stay on the form and show the error in Ukrainian.

#### Scenario: Successful create
- **WHEN** player `Клієнт` fills the form with `coach@gym.local`, `Присідання`, `10`, `5`, `30` and taps
  `Почати гру`
- **THEN** the app sends `POST /api/games` with header `X-Player-Id: 1` and body
  `{"opponent_email": "coach@gym.local", "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30}`
- **AND** after a `201` answer the page shows the heading `Мої ігри` and the text `Тренер` in the list of games

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
