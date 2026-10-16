# Spec Delta

## ADDED Requirements

### Requirement: The score is shown from the viewer's side
The game screen SHALL show the score in a region named `Рахунок` whose text reads `Ти <my points> : <their points>
<other player's name>`, whatever the viewer's role in the game.

#### Scenario: Opponent looks at the score
- **WHEN** in game `1` the score is `[{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]` and the app is
  opened as player `2` at `/games/1`
- **THEN** the text of the region `Рахунок`, with whitespace collapsed, equals `Ти 0 : 1 Клієнт`

#### Scenario: Organizer looks at the score
- **WHEN** the same game is opened as player `1`
- **THEN** the text of the region `Рахунок`, with whitespace collapsed, equals `Ти 1 : 0 Тренер`

### Requirement: The round tells each player who acts next
The current round SHALL tell the viewer what happens next: after the viewer's guess, `Твоя здогадка: <value>` and
`Чекаємо здогадку суперника`; when only the other player has guessed, `Здогадка суперника вже є` above the field;
when both have guessed, both values as `Ти: <value>` and `<name>: <value>`, then the actual count field for the
organizer or `Чекаємо реальну кількість від суперника` for the opponent.

#### Scenario: Waiting for the opponent's guess
- **WHEN** player `1` sends the guess `47` and the server answers `200` with player `1`'s entry `guessed` `true`,
  `value` `47` and player `2`'s entry `guessed` `false`
- **THEN** the page shows the texts `Твоя здогадка: 47` and `Чекаємо здогадку суперника`
- **AND** the page does not show the field `Твоя здогадка`

#### Scenario: The opponent has already guessed
- **WHEN** the screen of game `1` is opened by player `1` and `current_round.guesses` is
  `[{"player_id": 1, "guessed": false, "value": null}, {"player_id": 2, "guessed": true, "value": null}]`
- **THEN** the page shows the text `Здогадка суперника вже є`
- **AND** the page shows the field `Твоя здогадка`

#### Scenario: Both guessed, organizer's view
- **WHEN** the screen of game `1` is opened by player `1` and `current_round.guesses` is
  `[{"player_id": 1, "guessed": true, "value": 40}, {"player_id": 2, "guessed": true, "value": 55}]`
- **THEN** the page shows the texts `Ти: 40` and `Тренер: 55`
- **AND** the page shows the field `Реальна кількість` and not the field `Твоя здогадка`

#### Scenario: Both guessed, opponent's view
- **WHEN** the same round is opened by player `2`
- **THEN** the page shows the texts `Ти: 55` and `Клієнт: 40`
- **AND** the page shows the text `Чекаємо реальну кількість від суперника`
- **AND** the page does not show the field `Реальна кількість`

### Requirement: The organizer enters the actual count after a confirm step
The organizer's field `Реальна кількість` SHALL work like the guess field: the same 0–500 check, `Далі` showing
`Реальна кількість <value>? Це закриє раунд.` with `Надіслати` and `Змінити`, and `Надіслати` sending
`POST /api/games/{id}/actual` with `{"value": <value>}`.

#### Scenario: Enter and confirm the actual count
- **WHEN** in game `1` both have guessed (`40`, `55`), player `1` types `47` into `Реальна кількість` and taps
  `Далі`
- **THEN** the page shows the text `Реальна кількість 47? Це закриє раунд.`
- **AND** after tapping `Надіслати` the app sends `POST /api/games/1/actual` with header `Authorization: tma <t1>`
  and body `{"value": 47}`

## MODIFIED Requirements

### Requirement: Each game has its own address
The web app SHALL show the screen of game `{id}` at the address `/games/{id}`, with the level 2 heading
`Гра: <exercise>`, after requesting `GET /api/games/{id}` with the player's Telegram login. Each game in
`Мої ігри` SHALL be a link to that address. Any other address outside `/games/new` SHALL show `Мої ігри` at `/`.
In the scenarios below, game `1` is `Клієнт` (id `1`, organizer) against `Тренер` (id `2`), exercise `Присідання`,
base `10`, step `5`, final `30`.

#### Scenario: Open from the list
- **WHEN** the app is opened as player `1`, `GET /api/games` returns game `1`, and the person taps the link of that
  game in `Мої ігри`
- **THEN** the address is `/games/1`
- **AND** the page shows the heading `Гра: Присідання`
- **AND** the app has sent `GET /api/games/1` with header `Authorization: tma <t1>`

#### Scenario: Open the address directly
- **WHEN** the app is opened as player `1` at `/games/1`
- **THEN** the page shows the heading `Гра: Присідання`
- **AND** the page does not show the heading `Мої ігри`

#### Scenario: Address opened at the first login
- **WHEN** the app is loaded at `/games/1` with `t1`, `GET /api/me` answers `404`, and the person taps `Почати` and
  the server answers `201` with `{"id": 1, "name": "Клієнт"}`
- **THEN** the page shows the heading `Як тебе звати?` before the tap
- **AND** the page shows the heading `Гра: Присідання` after it, at the address `/games/1`

#### Scenario: Unknown address
- **WHEN** the app is opened as player `1` at `/nope`
- **THEN** the page shows the heading `Мої ігри`
- **AND** the address is `/`

## REMOVED Requirements

### Requirement: The scoreboard is shown from the viewer's side
**Reason**: The game's creator is now called the organizer (spec v2.0); OpenSpec cannot rename a requirement or its scenarios inside a modified requirement.
**Migration**: "The score is shown from the viewer's side" — the same behaviour in the organizer's words.

### Requirement: The round shows who is still expected to act
**Reason**: The game's creator is now called the organizer (spec v2.0); OpenSpec cannot rename a requirement or its scenarios inside a modified requirement.
**Migration**: "The round tells each player who acts next" — the same behaviour in the organizer's words.

### Requirement: The creator enters the actual count after a confirm step
**Reason**: The game's creator is now called the organizer (spec v2.0); OpenSpec cannot rename a requirement or its scenarios inside a modified requirement.
**Migration**: "The organizer enters the actual count after a confirm step" — the same behaviour in the organizer's words.
