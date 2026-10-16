# Spec Delta

## ADDED Requirements

### Requirement: Each game has its own address
The web app SHALL show the screen of game `{id}` at the address `/games/{id}`, with the level 2 heading
`Гра: <exercise>`, after requesting `GET /api/games/{id}` with the player's Telegram login. Each game in
`Мої ігри` SHALL be a link to that address. Any other address outside `/games/new` SHALL show `Мої ігри` at `/`.
In the scenarios below, game `1` is `Клієнт` (id `1`, creator) against `Тренер` (id `2`), exercise `Присідання`,
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

### Requirement: A game that cannot be shown leads back to my games or to Telegram
The game screen SHALL have a link `Мої ігри` to `/`. When `GET /api/games/{id}` answers `404`, the screen SHALL show
`Гру не знайдено` and the same link. When it answers `401`, the app SHALL show the refused-login message, as every
screen does (capability `telegram-auth`).

#### Scenario: Back to the list
- **WHEN** on the screen of game `1` the person taps the link `Мої ігри`
- **THEN** the page shows the heading `Мої ігри`
- **AND** the address is `/`

#### Scenario: No such game
- **WHEN** the app is opened as player `1` at `/games/99` and `GET /api/games/99` answers `404` with
  `{"detail": "Game not found"}`
- **THEN** the page shows the text `Гру не знайдено`
- **AND** the page shows the link `Мої ігри`

#### Scenario: Login refused on the game screen
- **WHEN** the app is opened as player `1` at `/games/1` and `GET /api/games/1` answers `401`
- **THEN** the page shows the text `Вхід застарів. Закрий і знову відкрий застосунок у Telegram.`
- **AND** the page does not show the heading `Гра: Присідання`

## MODIFIED Requirements

### Requirement: The scoreboard is shown from the viewer's side
The game screen SHALL show the score in a region named `Рахунок` whose text reads `Ти <my points> : <their points>
<other player's name>`, whatever the viewer's role in the game.

#### Scenario: Opponent looks at the score
- **WHEN** in game `1` the score is `[{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]` and the app is
  opened as player `2` at `/games/1`
- **THEN** the text of the region `Рахунок`, with whitespace collapsed, equals `Ти 0 : 1 Клієнт`

#### Scenario: Creator looks at the score
- **WHEN** the same game is opened as player `1`
- **THEN** the text of the region `Рахунок`, with whitespace collapsed, equals `Ти 1 : 0 Тренер`

### Requirement: A guess is sent only after a confirm step
In an active game where the viewer has not guessed, the screen SHALL show the heading `Раунд <number>`, a number
field `Твоя здогадка` and a button `Далі`. `Далі` SHALL show `Надіслати здогадку <value>? Змінити не вийде.` with
buttons `Надіслати` and `Змінити`, and send nothing. `Надіслати` SHALL send `POST /api/games/{id}/guesses` with
`{"value": <value>}`; `Змінити` SHALL return to the field with the value kept.

#### Scenario: Guess and confirm
- **WHEN** on the screen of game `1` in round `1` with no guesses, player `1` types `47` into `Твоя здогадка` and
  taps `Далі`
- **THEN** the page shows the text `Надіслати здогадку 47? Змінити не вийде.`
- **AND** no `POST /api/games/1/guesses` has been sent
- **AND** after tapping `Надіслати` the app sends `POST /api/games/1/guesses` with header `Authorization: tma <t1>`
  and body `{"value": 47}`

#### Scenario: Change before sending
- **WHEN** player `1` has typed `47`, tapped `Далі`, and taps `Змінити`
- **THEN** the field `Твоя здогадка` has the value `47`
- **AND** no `POST /api/games/1/guesses` has been sent

#### Scenario: Value outside the allowed range
- **WHEN** player `1` types `501` into `Твоя здогадка` and taps `Далі`, then types `4.5` and taps `Далі`
- **THEN** each time the page shows the text `Введи ціле число від 0 до 500`
- **AND** the page does not show `Надіслати здогадку`
- **AND** no `POST /api/games/1/guesses` has been sent

### Requirement: The creator enters the actual count after a confirm step
The creator's field `Реальна кількість` SHALL work like the guess field: the same 0–500 check, `Далі` showing
`Реальна кількість <value>? Це закриє раунд.` with `Надіслати` and `Змінити`, and `Надіслати` sending
`POST /api/games/{id}/actual` with `{"value": <value>}`.

#### Scenario: Enter and confirm the actual count
- **WHEN** in game `1` both have guessed (`40`, `55`), player `1` types `47` into `Реальна кількість` and taps
  `Далі`
- **THEN** the page shows the text `Реальна кількість 47? Це закриє раунд.`
- **AND** after tapping `Надіслати` the app sends `POST /api/games/1/actual` with header `Authorization: tma <t1>`
  and body `{"value": 47}`

## REMOVED Requirements

### Requirement: A game has its own address
**Reason**: Its scenarios used `X-Player-Id` and the player picker, both removed.
**Migration**: "Each game has its own address" (same addresses, Telegram login).

### Requirement: The game screen leads back to my games
**Reason**: On `401` it showed the removed player picker.
**Migration**: "A game that cannot be shown leads back to my games or to Telegram" (`401` shows the refused-login message).
