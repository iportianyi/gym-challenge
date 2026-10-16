# Spec Delta

## ADDED Requirements

### Requirement: A player lists their known opponents
`GET /api/opponents` SHALL answer `200` with every player who shares at least one game with the acting player as
organizer and opponent, each once as `{"id", "name"}`, the one with the most recently created shared game first.
A waiting game makes nobody a known opponent.

In API scenarios "player `1` and player `2` share game `1`" means player `1` created invite game `1` (capability
`invites`) and player `2` joined it.

#### Scenario: Most recent first
- **WHEN** player `1` and player `2` share game `1`, then player `3` `Гість` joins invite game `2` of player `1`, and
  player `1` sends `GET /api/opponents`
- **THEN** the response status is `200`
- **AND** the body parsed as JSON equals `[{"id": 3, "name": "Гість"}, {"id": 2, "name": "Тренер"}]`

#### Scenario: The opponent knows the organizer too
- **WHEN** player `1` and player `2` share game `1` and player `2` sends `GET /api/opponents`
- **THEN** the body parsed as JSON equals `[{"id": 1, "name": "Клієнт"}]`

#### Scenario: Other players are not known opponents
- **WHEN** players `1`, `2` and `3` exist, player `1` and player `2` share game `1`, and player `3` sends
  `GET /api/opponents`
- **THEN** the body parsed as JSON equals `[]`

#### Scenario: A waiting game does not count
- **WHEN** player `1` has created invite game `1` that nobody has joined and sends `GET /api/opponents`
- **THEN** the body parsed as JSON equals `[]`

### Requirement: The opponent must be a known opponent
`POST /api/games` with an `opponent_id` SHALL answer `422` with `{"detail": "Cannot play against yourself"}` when it
is the acting player's own id, and `422` with `{"detail": "Opponent not found"}` when it is not one of the acting
player's known opponents — whether or not such a player exists. No game SHALL be created in either case.

#### Scenario: Unknown opponent
- **WHEN** player `1` sends `POST /api/games` with a valid body whose `opponent_id` is `99`
- **THEN** the response status is `422`
- **AND** the body parsed as JSON equals `{"detail": "Opponent not found"}`
- **AND** `GET /api/games` as player `1` returns `[]`

#### Scenario: A player never played with
- **WHEN** players `1` and `2` exist with no games and player `1` sends `POST /api/games` with a valid body whose
  `opponent_id` is `2`
- **THEN** the response status is `422`
- **AND** the body parsed as JSON equals `{"detail": "Opponent not found"}`
- **AND** `GET /api/games` as player `1` returns `[]`

#### Scenario: Own id
- **WHEN** player `1` sends `POST /api/games` with a valid body whose `opponent_id` is `1`
- **THEN** the response status is `422`
- **AND** the body parsed as JSON equals `{"detail": "Cannot play against yourself"}`

### Requirement: The form offers an invite and the known opponents
The new-game form SHALL have a select `Суперник` whose first option `Запросити за посиланням` is chosen by default,
followed by one option per known opponent from `GET /api/opponents`, labelled with the name, in that order. If the
list could not be loaded it SHALL show `Не вдалося завантажити знайомих суперників.` and offer only the invite.
`Почати гру` SHALL stay enabled.

#### Scenario: Клієнт sees the invite and Тренер
- **WHEN** the app is opened as player `1`, the person opens `Нова гра`, and `GET /api/opponents` answers
  `[{"id": 2, "name": "Тренер"}, {"id": 3, "name": "Гість"}]`
- **THEN** the select `Суперник` has the options `Запросити за посиланням`, `Тренер`, `Гість` in this order
- **AND** `Запросити за посиланням` is selected

#### Scenario: Nobody known yet
- **WHEN** `GET /api/opponents` answers `[]`
- **THEN** the select `Суперник` has the single option `Запросити за посиланням`
- **AND** the button `Почати гру` is enabled

#### Scenario: Known opponents could not be loaded
- **WHEN** `GET /api/opponents` answers `500`
- **THEN** the page shows the heading `Нова гра` and the text `Не вдалося завантажити знайомих суперників.`
- **AND** the select `Суперник` has the single option `Запросити за посиланням`
- **AND** the button `Почати гру` is enabled

## MODIFIED Requirements

### Requirement: Organizer starts a game against a chosen player
`POST /api/games` with the id of a known opponent in `opponent_id` SHALL create an active game in which the acting
player is the organizer and that player is the opponent. It SHALL answer `201` with the game. The opponent does not
need to accept the game.

#### Scenario: Клієнт starts a game against Тренер
- **WHEN** player `1` and player `2` share game `1`, and player `1` sends `POST /api/games` with body
  `{"opponent_id": 2, "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30}`
- **THEN** the response status is `201`
- **AND** the body parsed as JSON equals
  `{"id": 2, "organizer": {"id": 1, "name": "Клієнт"}, "opponent": {"id": 2, "name": "Тренер"}, "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30, "status": "active", "score": [{"player_id": 1, "points": 0}, {"player_id": 2, "points": 0}], "winner_id": null}`

#### Scenario: Тренер starts a game against Клієнт
- **WHEN** player `1` and player `2` share game `1`, and player `2` sends `POST /api/games` with the same body but
  `"opponent_id": 1`
- **THEN** the response status is `201`
- **AND** the body's `organizer` equals `{"id": 2, "name": "Тренер"}` and its `opponent` equals
  `{"id": 1, "name": "Клієнт"}`

### Requirement: Game settings are validated
A game has one penalty exercise, used for both round and final penalties. Its name SHALL be 1–60 characters after
trimming surrounding spaces and SHALL be stored trimmed. `base_reps`
and `final_reps` SHALL be whole numbers from 1 to 1000; `step_reps` a whole number from 0 to 1000. A body that breaks
any of these rules SHALL be answered with `422` and no game is created.

#### Scenario: Exercise is blank
- **WHEN** player `1` sends `POST /api/games` with the valid body from the first scenario of "Organizer starts a game
  against a chosen player" but `"exercise": "   "`
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

#### Scenario: An invite game is validated too
- **WHEN** player `1` sends `POST /api/games` with body
  `{"exercise": "Присідання", "base_reps": 0, "step_reps": 5, "final_reps": 30}`
- **THEN** the response status is `422`
- **AND** `GET /api/games` as player `1` returns `[]`

#### Scenario: Game endpoints require a player
- **WHEN** a client sends `POST /api/games` with the valid body and no `Authorization` header
- **THEN** the response status is `401`
- **AND** the body parsed as JSON equals `{"detail": "Invalid Telegram login"}`

### Requirement: Listed games show their current score
Each game in `GET /api/games` SHALL carry its current `score` — a list of `{"player_id", "points"}`, the organizer
first — and `winner_id` (`null` until someone wins), computed from its settled rounds. A waiting game has `score`
`[]` and `opponent` `null`.

#### Scenario: Score after one round
- **WHEN** player `1` and player `2` share game `1`, one round is settled with guess `40` by player `1`, guess `55`
  by player `2` and actual `47`, and player `2` sends `GET /api/games`
- **THEN** the listed game has `score` equal to `[{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]`
- **AND** `winner_id` equal to `null`

#### Scenario: Waiting game in the list
- **WHEN** player `1` has created invite game `1` and sends `GET /api/games`
- **THEN** the listed game has `status` `"waiting"`, `opponent` `null` and `score` `[]`

### Requirement: The app lists my games
After the player is known, the web app SHALL show the heading `Мої ігри` and the caller's games from
`GET /api/games`. Each game SHALL show the other player's name — or `Чекаємо суперника` while the game is waiting —
and the penalty exercise. With no games it SHALL show `Ще немає ігор. Почни першу.` A button `Нова гра` SHALL open
the new-game form.

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

### Requirement: The list shows each game's score and whether it is finished
Each game in `Мої ігри` SHALL show its score from the viewer's side as `<my points> : <their points>` in an element
named `Рахунок`, and a game whose `status` is `finished` SHALL also show the mark `Завершена`. A waiting game SHALL
show no `Рахунок`. Games keep the server's order, newest first.

#### Scenario: Active game seen by the opponent
- **WHEN** the app is opened as player `2` and `GET /api/games` returns game `1` of `Клієнт` against `Тренер`
  with `status` `"active"` and `score` `[{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]`
- **THEN** that game's `Рахунок` reads `0 : 1`
- **AND** the list does not show the text `Завершена`

#### Scenario: Finished game
- **WHEN** the app is opened as player `1` and `GET /api/games` returns that game with `status` `"finished"`,
  `winner_id` `1` and `score` `[{"player_id": 1, "points": 5}, {"player_id": 2, "points": 0}]`
- **THEN** that game's `Рахунок` reads `5 : 0`
- **AND** the game shows the text `Завершена`

#### Scenario: Waiting game has no score
- **WHEN** the app is opened as player `1` and `GET /api/games` returns only waiting game `7`
- **THEN** the list has no element named `Рахунок`

### Requirement: The app creates a game with the chosen opponent
The form SHALL have the heading `Нова гра`, the select `Суперник`, the fields `Вправа`, `Повторень за першу поразку`,
`Додати за кожну наступну поразку поспіль`, `Повторень за програну гру`, and the buttons `Почати гру` and
`Скасувати`. On success the app SHALL open the new game's screen at `/games/{id}`; on a `422` from the server it
SHALL stay on the form and show the error in Ukrainian.

#### Scenario: Successful create
- **WHEN** the app is opened as player `1`, `GET /api/opponents` answers `[{"id": 2, "name": "Тренер"}]`, and the
  person chooses `Тренер` in `Суперник`, fills `Присідання`, `10`, `5`, `30` and taps `Почати гру`
- **THEN** the app sends `POST /api/games` with header `Authorization: tma <t1>` and body
  `{"opponent_id": 2, "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30}`
- **AND** after a `201` answer with game id `7` the address is `/games/7`
- **AND** the page shows the heading `Гра: Присідання`

#### Scenario: Opponent no longer exists
- **WHEN** the server answers the form's `POST /api/games` with `422` and `{"detail": "Opponent not found"}`
- **THEN** the page still shows the heading `Нова гра`
- **AND** the page shows the text `Такого гравця немає. Обери іншого.`

#### Scenario: Cancel
- **WHEN** on the form the person taps `Скасувати`
- **THEN** the page shows the heading `Мої ігри`
- **AND** no `POST /api/games` request is sent

## REMOVED Requirements

### Requirement: The form offers every other player as the opponent
**Reason**: The temporary list of every registered player (telegram-auth, decision 5) is replaced by known opponents
and invitations (spec v2.0).
**Migration**: "The form offers an invite and the known opponents"; a new opponent joins by the invite link
(capability `invites`).

### Requirement: The opponent must be another registered player
**Reason**: Any registered player is no longer a valid opponent; only a known one is.
**Migration**: "The opponent must be a known opponent" (same `422` details).
