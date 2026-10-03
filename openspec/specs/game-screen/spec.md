# game-screen Specification

## Purpose
Lets each of the two players play a game from their own phone in the web app: open the game by its address, see the
score, make a guess, enter the actual count, read each round's result and penalty, and see how the game ended.

## Requirements
### Requirement: A game has its own address
The web app SHALL show the screen of game `{id}` at the address `/games/{id}`, with the level 2 heading
`Гра: <exercise>`, after requesting `GET /api/games/{id}` with the chosen player's `X-Player-Id`. Each game in
`Мої ігри` SHALL be a link to that address. Any other address outside `/games/new` SHALL show `Мої ігри` at `/`.
In the scenarios below, game `1` is `Клієнт` (id `1`, creator) against `Тренер` (id `2`), exercise `Присідання`,
base `10`, step `5`, final `30`.

#### Scenario: Open from the list
- **WHEN** player `Клієнт` is chosen, `GET /api/games` returns game `1`, and the person taps the link of that game in
  `Мої ігри`
- **THEN** the address is `/games/1`
- **AND** the page shows the heading `Гра: Присідання`
- **AND** the app has sent `GET /api/games/1` with header `X-Player-Id: 1`

#### Scenario: Open the address directly
- **WHEN** the app is loaded at `/games/1` with remembered player `1`
- **THEN** the page shows the heading `Гра: Присідання`
- **AND** the page does not show the heading `Мої ігри`

#### Scenario: Address opened before choosing a player
- **WHEN** the app is loaded at `/games/1` with no remembered player and the person taps `Я — Клієнт`
- **THEN** the page shows the heading `Хто ти?` before the tap
- **AND** the page shows the heading `Гра: Присідання` after it, at the address `/games/1`

#### Scenario: Unknown address
- **WHEN** the app is loaded at `/nope` with remembered player `1`
- **THEN** the page shows the heading `Мої ігри`
- **AND** the address is `/`

### Requirement: The game screen leads back to my games
The game screen SHALL have a link `Мої ігри` to `/`. When `GET /api/games/{id}` answers `404`, the screen SHALL show
`Гру не знайдено` and the same link. When it answers `401`, the app SHALL forget the remembered player and show the
picker, as the list does.

#### Scenario: Back to the list
- **WHEN** on the screen of game `1` the person taps the link `Мої ігри`
- **THEN** the page shows the heading `Мої ігри`
- **AND** the address is `/`

#### Scenario: No such game
- **WHEN** the app is loaded at `/games/99` with remembered player `1` and `GET /api/games/99` answers `404` with
  `{"detail": "Game not found"}`
- **THEN** the page shows the text `Гру не знайдено`
- **AND** the page shows the link `Мої ігри`

#### Scenario: Remembered player rejected on the game screen
- **WHEN** the app is loaded at `/games/1` with remembered player `7` and `GET /api/games/1` answers `401`
- **THEN** the page shows the heading `Хто ти?`
- **AND** the remembered player is cleared

### Requirement: The scoreboard is shown from the viewer's side
The game screen SHALL show the score in a region named `Рахунок` whose text reads `Ти <my points> : <their points>
<other player's name>`, whatever the viewer's role in the game.

#### Scenario: Opponent looks at the score
- **WHEN** in game `1` the score is `[{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]` and the app is
  loaded at `/games/1` with remembered player `2`
- **THEN** the text of the region `Рахунок`, with whitespace collapsed, equals `Ти 0 : 1 Клієнт`

#### Scenario: Creator looks at the score
- **WHEN** the same game is loaded with remembered player `1`
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
- **AND** after tapping `Надіслати` the app sends `POST /api/games/1/guesses` with header `X-Player-Id: 1` and body
  `{"value": 47}`

#### Scenario: Change before sending
- **WHEN** player `1` has typed `47`, tapped `Далі`, and taps `Змінити`
- **THEN** the field `Твоя здогадка` has the value `47`
- **AND** no `POST /api/games/1/guesses` has been sent

#### Scenario: Value outside the allowed range
- **WHEN** player `1` types `501` into `Твоя здогадка` and taps `Далі`, then types `4.5` and taps `Далі`
- **THEN** each time the page shows the text `Введи ціле число від 0 до 500`
- **AND** the page does not show `Надіслати здогадку`
- **AND** no `POST /api/games/1/guesses` has been sent

### Requirement: The round shows who is still expected to act
The current round SHALL tell the viewer what happens next: after the viewer's guess, `Твоя здогадка: <value>` and
`Чекаємо здогадку суперника`; when only the other player has guessed, `Здогадка суперника вже є` above the field;
when both have guessed, both values as `Ти: <value>` and `<name>: <value>`, then the actual count field for the
creator or `Чекаємо реальну кількість від суперника` for the opponent.

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

#### Scenario: Both guessed, creator's view
- **WHEN** the screen of game `1` is opened by player `1` and `current_round.guesses` is
  `[{"player_id": 1, "guessed": true, "value": 40}, {"player_id": 2, "guessed": true, "value": 55}]`
- **THEN** the page shows the texts `Ти: 40` and `Тренер: 55`
- **AND** the page shows the field `Реальна кількість` and not the field `Твоя здогадка`

#### Scenario: Both guessed, opponent's view
- **WHEN** the same round is opened by player `2`
- **THEN** the page shows the texts `Ти: 55` and `Клієнт: 40`
- **AND** the page shows the text `Чекаємо реальну кількість від суперника`
- **AND** the page does not show the field `Реальна кількість`

### Requirement: The creator enters the actual count after a confirm step
The creator's field `Реальна кількість` SHALL work like the guess field: the same 0–500 check, `Далі` showing
`Реальна кількість <value>? Це закриє раунд.` with `Надіслати` and `Змінити`, and `Надіслати` sending
`POST /api/games/{id}/actual` with `{"value": <value>}`.

#### Scenario: Enter and confirm the actual count
- **WHEN** in game `1` both have guessed (`40`, `55`), player `1` types `47` into `Реальна кількість` and taps
  `Далі`
- **THEN** the page shows the text `Реальна кількість 47? Це закриє раунд.`
- **AND** after tapping `Надіслати` the app sends `POST /api/games/1/actual` with header `X-Player-Id: 1` and body
  `{"value": 47}`

### Requirement: The round just settled is shown as a result card
While the game has a settled round and nobody has guessed in the next one, or the game is finished, the screen
SHALL show a card with the heading `Підсумок раунду <number>`: the actual count, each guess with its distance, the
round's winner or a draw, and the penalty. Distances are `|guess − actual|`.

#### Scenario: Result seen by the round winner
- **WHEN** round `1` of game `1` was settled with guesses `40` (player `1`), `55` (player `2`) and actual `47`,
  round `2` has no guesses, and the screen is opened by player `1`
- **THEN** the page shows the heading `Підсумок раунду 1`
- **AND** the card shows the texts `Реальна кількість: 47`, `Ти: 40 · відстань 7`, `Тренер: 55 · відстань 8`,
  `Раунд твій` and `Покарання суперника: Присідання × 10`

#### Scenario: Result seen by the round loser
- **WHEN** the same game is opened by player `2`
- **THEN** the card shows the texts `Ти: 55 · відстань 8`, `Клієнт: 40 · відстань 7`,
  `Переможець раунду — Клієнт` and `Твоє покарання: Присідання × 10`

#### Scenario: Draw
- **WHEN** round `1` was settled with guesses `40`, `54` and actual `47` and the screen is opened by player `1`
- **THEN** the card shows the text `Нічия`
- **AND** the card does not show the text `Покарання`

#### Scenario: Card leaves once the next round starts
- **WHEN** round `1` was settled as (`40`, `55`, `47`) and player `2` has guessed in round `2`, and the screen is
  opened by player `1`
- **THEN** the page does not show the heading `Підсумок раунду 1`

### Requirement: The screen shows every settled round
The screen SHALL show the heading `Історія раундів` with one item per settled round, newest first. Each item SHALL
show `Раунд <number>`, both guesses, the actual count, the winner or `Нічия`, and the penalty in the card's words.
A game with no settled rounds SHALL NOT show the heading.

#### Scenario: Two rounds, newest first
- **WHEN** in game `1` round `1` was settled as (`40`, `55`, `47`) and round `2` as (`50`, `47`, `47`), and the
  screen is opened by player `1`
- **THEN** the list under `Історія раундів` has two items, the first with the text `Раунд 2` and the second with
  the text `Раунд 1`
- **AND** the first item shows the texts `Переможець раунду — Тренер` and `Твоє покарання: Присідання × 10`

#### Scenario: New game has no history
- **WHEN** the screen of a game with no settled rounds is opened
- **THEN** the page does not show the heading `Історія раундів`

### Requirement: A finished game shows its winner and the final penalty
When the game's `status` is `finished`, the screen SHALL show `Твоя перемога` to the winner or
`Переможець — <name>` to the other player, the final penalty as `Твоє покарання: <exercise> × <reps>` or
`Покарання суперника: <exercise> × <reps>`, and no fields for a guess or the actual count.

#### Scenario: Winner's view
- **WHEN** player `1` has won game `1` by `5` to `0` and the screen is opened by player `1`
- **THEN** the page shows the texts `Твоя перемога` and `Покарання суперника: Присідання × 30`
- **AND** the page shows neither the field `Твоя здогадка` nor the field `Реальна кількість`

#### Scenario: Loser's view
- **WHEN** the same game is opened by player `2`
- **THEN** the page shows the texts `Переможець — Клієнт` and `Твоє покарання: Присідання × 30`

### Requirement: An active game refreshes itself while visible
The screen of an active game SHALL request `GET /api/games/{id}` again 3 seconds after the previous answer while
the page is visible, SHALL NOT request it while the page is hidden, and SHALL request it at once when the page
becomes visible again. A finished game SHALL NOT be requested again. A failed request SHALL keep the shown game and
add the text `Немає зв'язку, пробуємо ще` until a request succeeds.

#### Scenario: Opponent's guess arrives
- **WHEN** player `1` has the screen of game `1` open with no guesses, player `2` guesses, and 3 seconds pass
- **THEN** the app has requested `GET /api/games/1` a second time
- **AND** the page shows the text `Здогадка суперника вже є`

#### Scenario: Hidden page is not polled
- **WHEN** the screen of active game `1` is open, the page becomes hidden and 9 seconds pass
- **THEN** no further `GET /api/games/1` has been sent during those 9 seconds
- **AND** when the page becomes visible again, `GET /api/games/1` is sent before any more time passes

#### Scenario: Finished game is not polled
- **WHEN** the screen of finished game `1` is open and 9 seconds pass
- **THEN** `GET /api/games/1` has been sent exactly once

#### Scenario: Connection lost and back
- **WHEN** the screen of active game `1` is open, the next `GET /api/games/1` fails with a network error, and the
  one after it answers `200`
- **THEN** after the failure the page shows the text `Немає зв'язку, пробуємо ще` and still the heading
  `Гра: Присідання`
- **AND** after the success the page does not show `Немає зв'язку, пробуємо ще`

### Requirement: A refused move shows the real state, not an error
When `POST /api/games/{id}/guesses` or `POST /api/games/{id}/actual` answers `409` or `403`, the app SHALL request
`GET /api/games/{id}` and show that state, without an error message.

#### Scenario: Guess already sent from another tab
- **WHEN** player `1` confirms the guess `47`, the server answers `409` with `{"detail": "Already guessed"}`, and the
  following `GET /api/games/1` shows player `1`'s entry `guessed` `true`, `value` `40`
- **THEN** the page shows the text `Твоя здогадка: 40`
- **AND** the page shows no element with the role `alert`

#### Scenario: Game finished meanwhile
- **WHEN** player `2` confirms a guess, the server answers `409` with `{"detail": "Game is finished"}`, and the
  following `GET /api/games/1` shows the game won by player `1`
- **THEN** the page shows the text `Переможець — Клієнт`
