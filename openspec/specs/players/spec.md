# players Specification

## Purpose

Defines who plays gym-challenge: a player appears at their first Telegram login under a name they choose and is kept
apart from the Telegram account they log in with. Players are not listed to each other; they meet through invite links
and shared games.

## Requirements

### Requirement: A Telegram user becomes a player by choosing a name
`POST /api/me` with body `{"name": <name>}` and a valid login of a Telegram user with no player SHALL create a player
with that name, trimmed of surrounding spaces, link the Telegram account to it, and answer `201` with
`{"id", "name"}`. The player is stored apart from the Telegram account it logs in with.

#### Scenario: First login
- **WHEN** no player exists and a client sends `POST /api/me` with a valid login for Telegram user `1001` and body
  `{"name": "  Іван "}`
- **THEN** the response status is `201`
- **AND** the body parsed as JSON equals `{"id": 1, "name": "Іван"}`

#### Scenario: Names need not be unique
- **WHEN** Telegram user `1001` has registered as `Іван` and Telegram user `1002` sends `POST /api/me` with body
  `{"name": "Іван"}`
- **THEN** the response status is `201`
- **AND** the body parsed as JSON equals `{"id": 2, "name": "Іван"}`

### Requirement: The app asks the server who I am
`GET /api/me` SHALL answer `200` with `{"id", "name"}` of the player linked to the login's Telegram user, and `404`
with `{"detail": "Not registered"}` when that user has no player yet.

#### Scenario: Not registered yet
- **WHEN** no player exists and a client sends `GET /api/me` with a valid login for Telegram user `1001`
- **THEN** the response status is `404`
- **AND** the body parsed as JSON equals `{"detail": "Not registered"}`

#### Scenario: Registered
- **WHEN** Telegram user `1001` has registered as `Іван` and sends `GET /api/me`
- **THEN** the response status is `200`
- **AND** the body parsed as JSON equals `{"id": 1, "name": "Іван"}`

### Requirement: A Telegram account belongs to one player
A second `POST /api/me` by a Telegram user who already has a player SHALL answer `409` with
`{"detail": "Already registered"}` and SHALL NOT change the player or create another one.

#### Scenario: Registering twice
- **WHEN** Telegram user `1001` has registered as `Іван` and sends `POST /api/me` with body `{"name": "Петро"}`
- **THEN** the response status is `409`
- **AND** the body parsed as JSON equals `{"detail": "Already registered"}`
- **AND** `GET /api/me` for Telegram user `1001` answers `{"id": 1, "name": "Іван"}`

### Requirement: A player's name is 1 to 40 characters
The name in `POST /api/me` SHALL be 1–40 characters after trimming surrounding spaces; otherwise the answer SHALL be
`422` and no player is created.

#### Scenario: Blank name
- **WHEN** Telegram user `1001` sends `POST /api/me` with body `{"name": "   "}`
- **THEN** the response status is `422`
- **AND** `GET /api/me` for Telegram user `1001` answers `404`

#### Scenario: Longest name
- **WHEN** Telegram user `1001` sends `POST /api/me` with a name of 40 letters `я`
- **THEN** the response status is `201`

#### Scenario: Name too long
- **WHEN** Telegram user `1001` sends `POST /api/me` with a name of 41 letters `я`
- **THEN** the response status is `422`

### Requirement: Only registered players can use the game endpoints
`GET /api/opponents` and every `/api/games` endpoint SHALL answer a valid login of a Telegram user with no player with
`403` and `{"detail": "Not registered"}`, and SHALL change nothing.

#### Scenario: Unregistered user lists games
- **WHEN** no player is linked to Telegram user `1009` and it sends `GET /api/games` with a valid login
- **THEN** the response status is `403`
- **AND** the body parsed as JSON equals `{"detail": "Not registered"}`

#### Scenario: Unregistered user lists players
- **WHEN** the same user sends `GET /api/opponents` (the known opponents; the list of all players is gone)
- **THEN** the response status is `403`

#### Scenario: Unregistered user opens an invite
- **WHEN** player `1` has created an invite game and the same user sends `POST /api/games/join` with its token
- **THEN** the response status is `403`
- **AND** the body parsed as JSON equals `{"detail": "Not registered"}`
- **AND** `GET /api/games/1` as player `1` has `status` `"waiting"`

### Requirement: The default players and their games are gone
Upgrading a database that has the two default players `Клієнт` and `Тренер` SHALL delete them with all games, rounds
and guesses, and SHALL drop player emails, so the first Telegram login starts from an empty app.

#### Scenario: Upgrade from the MVP database
- **WHEN** a database file holds the MVP data — players `1` `Клієнт` (`client@gym.local`) and `2` `Тренер`
  (`coach@gym.local`) and one game between them with one settled round — and the system is started on it
- **THEN** `GET /api/me` with a valid login for Telegram user `1001` answers `404`
- **AND** after that user registers as `Іван`, `GET /api/games` and `GET /api/opponents` as that player both answer
  `[]`

### Requirement: Players survive a restart
Players and their Telegram accounts SHALL be stored in the database file, so that a player registered before the
system stops is recognised after it starts again on the same file.

#### Scenario: Restart
- **WHEN** Telegram user `1001` has registered as `Іван`, the system is stopped and started again on the same database
  file, and the user sends `GET /api/me`
- **THEN** the body parsed as JSON equals `{"id": 1, "name": "Іван"}`

### Requirement: The first login asks for the player's name
When `GET /api/me` answers `404`, the web app SHALL show the heading `Як тебе звати?`, a field `Твоє ім'я` filled
with the `first_name` from the launch `initData`, and a button `Почати`. `Почати` SHALL send `POST /api/me` with the
trimmed name and, on `201`, continue to the requested address as that player. A name outside 1–40 characters SHALL
show `Ім'я — від 1 до 40 символів` and send nothing.

#### Scenario: Confirm the Telegram name
- **WHEN** the app is loaded with `t1` (first name `Іван`), `GET /api/me` answers `404`, and the person taps `Почати`
- **THEN** before the tap the page shows the heading `Як тебе звати?` and the field `Твоє ім'я` has the value `Іван`
- **AND** the app sends `POST /api/me` with header `Authorization: tma <t1>` and body `{"name": "Іван"}`
- **AND** after a `201` answer `{"id": 1, "name": "Іван"}` the page shows the text `Ти граєш як Іван` and the
  heading `Мої ігри`

#### Scenario: Correct the name
- **WHEN** on that screen the person replaces the name with `Ваня` and taps `Почати`
- **THEN** the app sends `POST /api/me` with body `{"name": "Ваня"}`

#### Scenario: Empty name
- **WHEN** on that screen the person clears the field and taps `Почати`
- **THEN** the page shows the text `Ім'я — від 1 до 40 символів`
- **AND** no `POST /api/me` has been sent

#### Scenario: The requested address is kept
- **WHEN** the app is loaded at `/games/new` with `t1`, `GET /api/me` answers `404`, and the person taps `Почати`
  and the server answers `201`
- **THEN** the page shows the heading `Нова гра` and the address is `/games/new`

### Requirement: A known player goes straight to their games
When `GET /api/me` answers `200`, the web app SHALL show `Ти граєш як <name>` and the requested screen, without the
name form and without any way to switch players. If `GET /api/me` fails for another reason, it SHALL show
`Не вдалося зв'язатися з сервером.` instead.

#### Scenario: Returning player
- **WHEN** the app is opened as player `1`
- **THEN** the page shows the text `Ти граєш як Клієнт` and the heading `Мої ігри`
- **AND** the page shows neither the field `Твоє ім'я` nor the button `Змінити гравця`

#### Scenario: Server unreachable
- **WHEN** the app is loaded with `t1` and `GET /api/me` fails with a network error
- **THEN** the page shows the text `Не вдалося зв'язатися з сервером.`
- **AND** the page does not show the heading `Мої ігри`

### Requirement: Players are not listed to each other
There SHALL be no endpoint that lists all players: `GET /api/players` SHALL answer `404`. A player sees other players
only as the organizer or opponent of a shared game and as known opponents (capability `games`).

#### Scenario: The old list is gone
- **WHEN** players `1` `Клієнт` and `2` `Тренер` exist and player `1` sends `GET /api/players`
- **THEN** the response status is `404`
