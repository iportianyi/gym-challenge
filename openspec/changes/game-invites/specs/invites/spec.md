# Spec Delta

## Purpose

Lets an organizer start a game with someone they have never played with: the game waits for an opponent, the
organizer sends its one-time Telegram link, and the first other player who opens the link joins the game.

## ADDED Requirements

### Requirement: A game without an opponent waits for one
`POST /api/games` with a valid body without `opponent_id` (or with `"opponent_id": null`) SHALL create a game with
`status` `"waiting"`, `opponent` `null`, `score` `[]`, `winner_id` `null` and no rounds, and answer `201`.

In API scenarios the server also runs with the bot username `gym_test_bot`; "an invite game of player `1`" is a
game created this way by player `1`, and `<token>` is the part of its `invite_url` after `startapp=`.

#### Scenario: Create an invite game
- **WHEN** player `1` sends `POST /api/games` with body
  `{"exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30}`
- **THEN** the response status is `201`
- **AND** the body parsed as JSON equals
  `{"id": 1, "organizer": {"id": 1, "name": "Клієнт"}, "opponent": null, "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30, "status": "waiting", "score": [], "winner_id": null}`

#### Scenario: Explicit null opponent
- **WHEN** player `1` sends the same body with `"opponent_id": null`
- **THEN** the response status is `201`
- **AND** the body's `status` equals `"waiting"`

### Requirement: Only the organizer sees the invite link
`GET /api/games/{id}` and the move endpoints SHALL include `invite_url`: for the organizer of a waiting game the
string `https://t.me/<bot username>?startapp=<token>`, where `<token>` is 22 characters of `A-Z a-z 0-9 _ -`,
different for every game; `null` for every other game and viewer. A waiting game has `current_round` `null`.

#### Scenario: Organizer looks at the waiting game
- **WHEN** player `1` has created invite game `1` and sends `GET /api/games/1`
- **THEN** the response status is `200`
- **AND** the body without `invite_url` parsed as JSON equals
  `{"id": 1, "organizer": {"id": 1, "name": "Клієнт"}, "opponent": null, "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30, "status": "waiting", "score": [], "winner_id": null, "final_penalty": null, "rounds": [], "current_round": null}`
- **AND** the body's `invite_url` matches `^https://t\.me/gym_test_bot\?startapp=[A-Za-z0-9_-]{22}$`

#### Scenario: Two invites, two tokens
- **WHEN** player `1` creates invite games `1` and `2`
- **THEN** the `invite_url` of game `1` differs from the `invite_url` of game `2`

#### Scenario: Nobody else sees a waiting game
- **WHEN** player `1` has created invite game `1` and player `2` sends `GET /api/games/1`
- **THEN** the response status is `404`
- **AND** `GET /api/games` as player `2` answers `[]`

### Requirement: Nothing is played until the opponent joins
In a waiting game `POST /api/games/{id}/guesses` and `POST /api/games/{id}/actual` by the organizer SHALL answer
`409` with `{"detail": "Waiting for opponent"}` and change nothing.

#### Scenario: Guess in a waiting game
- **WHEN** player `1` has created invite game `1` and sends `POST /api/games/1/guesses` with body `{"value": 40}`
- **THEN** the response status is `409`
- **AND** the body parsed as JSON equals `{"detail": "Waiting for opponent"}`

#### Scenario: Actual count in a waiting game
- **WHEN** the same player sends `POST /api/games/1/actual` with body `{"value": 47}`
- **THEN** the response status is `409`
- **AND** the body parsed as JSON equals `{"detail": "Waiting for opponent"}`

### Requirement: The first other player who opens the link joins the game
`POST /api/games/join` with body `{"token": <token>}` by a player other than the organizer SHALL, while the game is
waiting, make that player the opponent, set `status` to `"active"`, open round `1` and answer `200` with the game as
that player sees it. The link SHALL then be used up: `invite_url` is `null` for both players.

#### Scenario: Тренер joins
- **WHEN** player `1` has created invite game `1` and player `2` sends `POST /api/games/join` with body
  `{"token": "<token>"}`
- **THEN** the response status is `200`
- **AND** the body's `status` equals `"active"`, its `opponent` equals `{"id": 2, "name": "Тренер"}`, its
  `invite_url` equals `null` and its `current_round` equals
  `{"number": 1, "guesses": [{"player_id": 1, "guessed": false, "value": null}, {"player_id": 2, "guessed": false, "value": null}]}`
- **AND** `GET /api/games/1` as player `1` has `status` `"active"`, `score`
  `[{"player_id": 1, "points": 0}, {"player_id": 2, "points": 0}]` and `invite_url` `null`

#### Scenario: Play after joining
- **WHEN** player `2` has joined invite game `1` of player `1`, player `1` guesses `40`, player `2` guesses `55` and
  player `1` enters the actual count `47`
- **THEN** each of the three responses has status `200`
- **AND** the last body's `score` equals `[{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]`

### Requirement: A link joins one opponent only
`POST /api/games/join` SHALL answer `409` with `{"detail": "Invite already used"}` when another player has already
joined that game; `200` with the game and no change when the opponent or the organizer of that game sends it; and
`404` with `{"detail": "Invite not found"}` when no game has that token.

#### Scenario: Someone else opens a used link
- **WHEN** player `2` has joined invite game `1` of player `1` and player `3` `Гість` sends `POST /api/games/join`
  with the same token
- **THEN** the response status is `409`
- **AND** the body parsed as JSON equals `{"detail": "Invite already used"}`
- **AND** `GET /api/games/1` as player `1` has `opponent` `{"id": 2, "name": "Тренер"}`

#### Scenario: The opponent opens the link again
- **WHEN** player `2` has joined invite game `1` of player `1` and sends `POST /api/games/join` with the same token
  again
- **THEN** the response status is `200`
- **AND** the body's `id` equals `1` and its `opponent` equals `{"id": 2, "name": "Тренер"}`

#### Scenario: The organizer opens their own link
- **WHEN** player `1` has created invite game `1` and sends `POST /api/games/join` with its token
- **THEN** the response status is `200`
- **AND** the body's `id` equals `1`, its `status` equals `"waiting"` and its `opponent` equals `null`

#### Scenario: Unknown token
- **WHEN** player `2` sends `POST /api/games/join` with body `{"token": "nope"}`
- **THEN** the response status is `404`
- **AND** the body parsed as JSON equals `{"detail": "Invite not found"}`

#### Scenario: Token is not a string
- **WHEN** player `2` sends `POST /api/games/join` with body `{"token": 5}`
- **THEN** the response status is `422`

### Requirement: Games from before invitations keep their opponent
Upgrading a database whose games all have an opponent SHALL keep every game, its opponent, status and rounds, with
`invite_url` `null`.

#### Scenario: Upgrade with a game in progress
- **WHEN** a database file at the previous version holds player `1` `Клієнт` and player `2` `Тренер` with their
  Telegram accounts and one active game between them with one settled round (`40`, `55`, actual `47`), and the system
  is started on it
- **THEN** `GET /api/games/1` as player `2` answers `200` with `status` `"active"`, `opponent`
  `{"id": 2, "name": "Тренер"}`, one item in `rounds` and `invite_url` `null`

### Requirement: The web app joins the game it was launched with
When the page is loaded with `tgWebAppData` whose `start_param` is not empty, the web app SHALL, once the player is
known (at once, or after the name form), send `POST /api/games/join` with `{"token": <start_param>}` and on `200` open
`/games/{id}`. It SHALL NOT join again when the tab is reloaded without the launch parameters.

In web-app scenarios `t2s` is `t2` with `start_param=Abc_123-xyz` before `hash`
(`user=…&start_param=Abc_123-xyz&hash=t2`).

#### Scenario: Registered player opens the link
- **WHEN** the app is loaded at `/#tgWebAppData=<t2s, URL-encoded>`, `GET /api/me` answers
  `200 {"id": 2, "name": "Тренер"}` and `POST /api/games/join` answers `200` with game `7`
- **THEN** the app has sent `POST /api/games/join` with header `Authorization: tma <t2s>` and body
  `{"token": "Abc_123-xyz"}`
- **AND** the address is `/games/7`

#### Scenario: New player opens the link
- **WHEN** the app is loaded with `t2s`, `GET /api/me` answers `404`, and the person taps `Почати` and the server
  answers `201`
- **THEN** no `POST /api/games/join` has been sent before the tap
- **AND** after it the app sends `POST /api/games/join` with body `{"token": "Abc_123-xyz"}` and, on `200` with game
  `7`, the address is `/games/7`

#### Scenario: Reload after joining
- **WHEN** the app has joined game `7` from `t2s` and is loaded again in the same tab at `/games/7` without a fragment
- **THEN** no further `POST /api/games/join` has been sent

#### Scenario: Launch without a start parameter
- **WHEN** the app is opened as player `2` with `t2`
- **THEN** no `POST /api/games/join` has been sent
- **AND** the page shows the heading `Мої ігри`

### Requirement: A link that cannot be joined says why
When `POST /api/games/join` answers `409`, the web app SHALL show `Це запрошення вже прийняв інший гравець.`; on
`404` `Запрошення не знайдено.`; on another failure `Не вдалося приєднатися до гри.` Each SHALL come with the link
`Мої ігри` to `/`.

#### Scenario: Link already used
- **WHEN** the app is loaded with `t2s` as player `2` and `POST /api/games/join` answers `409` with
  `{"detail": "Invite already used"}`
- **THEN** the page shows the text `Це запрошення вже прийняв інший гравець.` and the link `Мої ігри`
- **AND** after tapping `Мої ігри` the page shows the heading `Мої ігри`

#### Scenario: Unknown link
- **WHEN** `POST /api/games/join` answers `404` with `{"detail": "Invite not found"}`
- **THEN** the page shows the text `Запрошення не знайдено.` and the link `Мої ігри`

#### Scenario: No connection while joining
- **WHEN** `POST /api/games/join` fails with a network error
- **THEN** the page shows the text `Не вдалося приєднатися до гри.` and the link `Мої ігри`

### Requirement: The waiting game's screen gives the organizer the link
The screen of a waiting game SHALL show the heading `Гра: <exercise>`, the text
`Чекаємо суперника. Надішли йому посилання.`, the `invite_url` as text, a button `Копіювати посилання` and a link
`Надіслати в Telegram` to `https://t.me/share/url` with `url` the `invite_url` and `text`
`Зіграй зі мною в Gym Challenge`. It SHALL show no region `Рахунок` and no fields for a guess or the actual count.

In the scenarios below game `7` is an invite game of player `1` with exercise `Присідання` and `invite_url`
`https://t.me/gym_dev_bot?startapp=Abc_123-xyz`.

#### Scenario: Organizer opens the waiting game
- **WHEN** the app is opened as player `1` at `/games/7`
- **THEN** the page shows the heading `Гра: Присідання` and the texts `Чекаємо суперника. Надішли йому посилання.`
  and `https://t.me/gym_dev_bot?startapp=Abc_123-xyz`
- **AND** the link `Надіслати в Telegram` has the address
  `https://t.me/share/url?url=https%3A%2F%2Ft.me%2Fgym_dev_bot%3Fstartapp%3DAbc_123-xyz&text=%D0%97%D1%96%D0%B3%D1%80%D0%B0%D0%B9%20%D0%B7%D1%96%20%D0%BC%D0%BD%D0%BE%D1%8E%20%D0%B2%20Gym%20Challenge`
- **AND** the page shows neither the region `Рахунок` nor the field `Твоя здогадка`

#### Scenario: Copy the link
- **WHEN** on that screen the person taps `Копіювати посилання`
- **THEN** the clipboard holds `https://t.me/gym_dev_bot?startapp=Abc_123-xyz`
- **AND** the page shows the text `Скопійовано`

#### Scenario: Clipboard refused
- **WHEN** on that screen the person taps `Копіювати посилання` and writing to the clipboard fails
- **THEN** the page shows the text `Не вдалося скопіювати. Виділи посилання й скопіюй вручну.`

#### Scenario: Opponent joins while the screen is open
- **WHEN** the organizer has the screen of game `7` open and 3 seconds later `GET /api/games/7` answers the game
  `active` against `Тренер` with no guesses in round `1`
- **THEN** the page shows the heading `Раунд 1` and the field `Твоя здогадка`
- **AND** the page does not show `Чекаємо суперника. Надішли йому посилання.`

#### Scenario: Waiting game is polled
- **WHEN** the screen of waiting game `7` is open and 3 seconds pass
- **THEN** the app has sent `GET /api/games/7` twice

### Requirement: A new invite game opens its screen
After `Почати гру` with `Запросити за посиланням`, the app SHALL send `POST /api/games` without `opponent_id` and on
`201` open `/games/{id}`.

#### Scenario: Create an invite from the form
- **WHEN** the app is opened as player `1`, the person opens `Нова гра`, leaves `Запросити за посиланням` in
  `Суперник`, fills `Присідання`, `10`, `5`, `30` and taps `Почати гру`
- **THEN** the app sends `POST /api/games` with body
  `{"exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30}`
- **AND** after a `201` answer with game id `7` and `status` `"waiting"` the address is `/games/7`
