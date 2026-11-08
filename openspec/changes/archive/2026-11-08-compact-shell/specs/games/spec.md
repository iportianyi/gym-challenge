# Spec Delta

## MODIFIED Requirements

### Requirement: The app lists my games
After the player is known, the web app SHALL show the heading `Мої ігри` and the caller's games from
`GET /api/games`. Each game SHALL show the other player's name — or `Чекаємо суперника` while the game is waiting —
and the penalty exercise. With no games it SHALL show `Ще немає ігор. Почни першу.` A button `Нова гра` SHALL stand
right after the heading, before the list or that text, and SHALL open the new-game form.

#### Scenario: No games yet
- **WHEN** the app is opened as player `1` and `GET /api/games` returns `[]`
- **THEN** the page shows the text `Ще немає ігор. Почни першу.`
- **AND** the page shows the button `Нова гра`

#### Scenario: One game against Тренер
- **WHEN** the app is opened as player `1` and `GET /api/games` returns the game from the first scenario of
  "Organizer starts a game against a chosen player"
- **THEN** the page shows the texts `Тренер` and `Присідання` inside the list of games
- **AND** the page does not show `Ще немає ігор. Почни першу.`

#### Scenario: A waiting game
- **WHEN** the app is opened as player `1` and `GET /api/games` returns game `7` of player `1` with `status`
  `"waiting"`, `opponent` `null`, `score` `[]` and exercise `Присідання`
- **THEN** the page shows the texts `Чекаємо суперника` and `Присідання` inside the list of games

#### Scenario: New game comes before the list
- **WHEN** the app is opened as player `1` and `GET /api/games` returns 8 games
- **THEN** in document order the heading `Мої ігри` comes first, then the button `Нова гра`, then the list of games

#### Scenario: New game comes before the empty note
- **WHEN** the app is opened as player `1` and `GET /api/games` returns `[]`
- **THEN** in document order the button `Нова гра` comes before the text `Ще немає ігор. Почни першу.`
