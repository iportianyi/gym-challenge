# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
