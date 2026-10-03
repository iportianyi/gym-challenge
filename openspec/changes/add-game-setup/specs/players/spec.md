# Spec Delta

## Purpose

Defines who can play gym-challenge in the MVP — two default players without passwords — and how the browser and every
API request say which of them is acting, so the app can tell the players' actions apart.

## ADDED Requirements

### Requirement: Two default players exist
The system SHALL have exactly two players after it starts for the first time: id `1`, name `Клієнт`, email
`client@gym.local`; id `2`, name `Тренер`, email `coach@gym.local`. Starting the system again on the same database
SHALL NOT create more players.

#### Scenario: Fresh database
- **WHEN** the system starts on an empty database and a client sends `GET /api/players`
- **THEN** the response status is `200`
- **AND** the body parsed as JSON equals
  `[{"id": 1, "name": "Клієнт", "email": "client@gym.local"}, {"id": 2, "name": "Тренер", "email": "coach@gym.local"}]`

#### Scenario: Restart keeps two players
- **WHEN** the system is started a second time on the same database file and a client sends `GET /api/players`
- **THEN** the body parsed as JSON is a list of exactly `2` players with ids `1` and `2`

### Requirement: Listing players needs no player identity
The system SHALL answer `GET /api/players` without an `X-Player-Id` header, because the browser needs the list before
it knows who is using it.

#### Scenario: No identity header
- **WHEN** a client sends `GET /api/players` without the `X-Player-Id` header
- **THEN** the response status is `200`

### Requirement: A request names its player in the X-Player-Id header
Every game endpoint SHALL take the acting player from the `X-Player-Id` request header: the decimal id of an
existing player. A missing header, a value that is not a whole number, or an id with no player SHALL be answered
with `401` and the JSON body `{"detail": "Unknown player"}`. The header is not a secret; anyone can send any id.

#### Scenario: Header missing
- **WHEN** a client sends `GET /api/games` without the `X-Player-Id` header
- **THEN** the response status is `401`
- **AND** the body parsed as JSON equals `{"detail": "Unknown player"}`

#### Scenario: Header is not a number
- **WHEN** a client sends `GET /api/games` with header `X-Player-Id: abc`
- **THEN** the response status is `401`
- **AND** the body parsed as JSON equals `{"detail": "Unknown player"}`

#### Scenario: No player with that id
- **WHEN** a client sends `GET /api/games` with header `X-Player-Id: 99`
- **THEN** the response status is `401`
- **AND** the body parsed as JSON equals `{"detail": "Unknown player"}`

#### Scenario: Known player
- **WHEN** a client sends `GET /api/games` with header `X-Player-Id: 2`
- **THEN** the response status is `200`

### Requirement: The browser asks who is using it
When no player is remembered in the browser, the web app SHALL show the heading `Хто ти?` and one button per player
from `GET /api/players`, labelled `Я — <name>`, with the player's email next to it. It SHALL NOT show games yet.

#### Scenario: First open
- **WHEN** the app loads with no remembered player and `GET /api/players` returns the two default players
- **THEN** the page shows the heading `Хто ти?`
- **AND** the page shows the buttons `Я — Клієнт` and `Я — Тренер`
- **AND** the page shows the texts `client@gym.local` and `coach@gym.local`
- **AND** the page does not show the heading `Мої ігри`

### Requirement: The browser remembers the chosen player
Choosing a player SHALL store the choice in the browser's local storage for this site, so that the next load in
the same browser skips the picker, and SHALL show
`Ти граєш як <name>` with a button `Змінити гравця`. The app SHALL send the chosen id as `X-Player-Id` with every
game request.

#### Scenario: Pick a player
- **WHEN** on the picker the person taps `Я — Тренер`
- **THEN** the page shows the text `Ти граєш як Тренер`
- **AND** the page shows the heading `Мої ігри`
- **AND** the request to `GET /api/games` carries the header `X-Player-Id: 2`

#### Scenario: Reload keeps the choice
- **WHEN** the person has picked `Я — Тренер` and the app is loaded again in the same browser
- **THEN** the page shows the text `Ти граєш як Тренер` without showing the heading `Хто ти?`

#### Scenario: Change player
- **WHEN** the person who plays as `Тренер` taps `Змінити гравця`
- **THEN** the page shows the heading `Хто ти?`
- **AND** loading the app again also shows the heading `Хто ти?`

#### Scenario: Remembered player no longer accepted
- **WHEN** the app loads with remembered player id `7` and `GET /api/games` answers `401`
- **THEN** the page shows the heading `Хто ти?`
- **AND** the remembered player is cleared
