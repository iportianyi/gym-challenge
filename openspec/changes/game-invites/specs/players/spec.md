# Spec Delta

## ADDED Requirements

### Requirement: Players are not listed to each other
There SHALL be no endpoint that lists all players: `GET /api/players` SHALL answer `404`. A player sees other players
only as the organizer or opponent of a shared game and as known opponents (capability `games`).

#### Scenario: The old list is gone
- **WHEN** players `1` `Клієнт` and `2` `Тренер` exist and player `1` sends `GET /api/players`
- **THEN** the response status is `404`

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Other players are listed for choosing an opponent
**Reason**: It was temporary until invitations (telegram-auth, decision 5): it showed every name to everyone.
**Migration**: Choose a known opponent from `GET /api/opponents`, or invite a new one by link (capability `invites`).
