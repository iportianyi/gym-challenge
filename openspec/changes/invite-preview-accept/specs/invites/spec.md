# Spec Delta

## ADDED Requirements

### Requirement: An invite can be read before joining
`POST /api/invites/preview` with body `{"token": <token>}` and a valid Telegram login — with or without a player —
SHALL answer `200` with the organizer, the game's settings and the viewer's `role`: `"organizer"`, `"opponent"` (the
viewer has joined) or `"invited"`. It SHALL change nothing. It SHALL answer `409` `{"detail": "Invite already used"}`
when another player has joined, `404` `{"detail": "Invite not found"}` for an unknown token, `401` without a valid login.

#### Scenario: Тренер reads the invite
- **WHEN** player `1` has created invite game `1` with exercise `Присідання`, base `10`, step `5`, final `30`, and
  player `2` sends `POST /api/invites/preview` with body `{"token": "<token>"}`
- **THEN** the response status is `200`
- **AND** the body parsed as JSON equals
  `{"organizer": {"id": 1, "name": "Клієнт"}, "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30, "role": "invited"}`
- **AND** `GET /api/games` as player `2` answers `[]`, and `GET /api/games/1` as player `1` has `status` `"waiting"`

#### Scenario: Telegram user without a player reads the invite
- **WHEN** a Telegram user `3003` with no player sends the same request
- **THEN** the response status is `200`
- **AND** the body's `role` equals `"invited"`

#### Scenario: Organizer reads their own invite
- **WHEN** player `1` sends `POST /api/invites/preview` with the token of their invite game `1`
- **THEN** the response status is `200`
- **AND** the body's `role` equals `"organizer"`

#### Scenario: Opponent reads the invite again
- **WHEN** player `2` has joined invite game `1` and sends `POST /api/invites/preview` with its token
- **THEN** the response status is `200`
- **AND** the body's `role` equals `"opponent"`

#### Scenario: Someone else reads a used invite
- **WHEN** player `2` has joined invite game `1` and player `3` `Гість` sends `POST /api/invites/preview` with its
  token
- **THEN** the response status is `409`
- **AND** the body parsed as JSON equals `{"detail": "Invite already used"}`

#### Scenario: Unknown invite
- **WHEN** player `2` sends `POST /api/invites/preview` with body `{"token": "nope"}`
- **THEN** the response status is `404`
- **AND** the body parsed as JSON equals `{"detail": "Invite not found"}`

#### Scenario: Preview without a login
- **WHEN** a client sends `POST /api/invites/preview` with body `{"token": "<token>"}` and no `Authorization` header
- **THEN** the response status is `401`

### Requirement: The invite screen shows who invites and the penalties
For an invite whose `role` is `"invited"`, the web app SHALL show the heading `Гра: <exercise>`, the texts
`<organizer> кличе тебе в гру`, `Покарання за раунд: <exercise> × <base>`, `+<step> за кожну поразку поспіль` (only
when the step is not `0`), `Покарання за програну гру: <exercise> × <final>` and `Гра — до 5 балів`, and two
buttons, `Відмовитись` on the left and `Прийняти` on the right. `Відмовитись` SHALL change nothing on the server and
lead to `Мої ігри` (to the name form for a new player). It SHALL show no region `Рахунок` and no field `Твоя здогадка`.

In web-app scenarios `t2s` is `t2` with `start_param=Abc_123-xyz` before `hash`, and the preview of `Abc_123-xyz`
answers `200` with organizer `{"id": 1, "name": "Клієнт"}`, `Присідання`, base `10`, step `5`, final `30` and role
`"invited"` unless the scenario says otherwise.

#### Scenario: Invite screen with the settings
- **WHEN** the app is loaded with `t2s` as registered player `2` `Тренер`
- **THEN** the page shows the heading `Гра: Присідання`
- **AND** the page shows the texts `Клієнт кличе тебе в гру`, `Покарання за раунд: Присідання × 10`,
  `+5 за кожну поразку поспіль`, `Покарання за програну гру: Присідання × 30` and `Гра — до 5 балів`
- **AND** the page's buttons, in reading order, are `Відмовитись`, `Прийняти`
- **AND** the page shows neither the region `Рахунок` nor the field `Твоя здогадка`

#### Scenario: No step, no streak line
- **WHEN** the preview answers step `0` and the app is loaded with `t2s` as player `2`
- **THEN** the page shows the text `Покарання за раунд: Присідання × 10`
- **AND** the page does not show the text `за кожну поразку поспіль`

## MODIFIED Requirements

### Requirement: The web app joins the game it was launched with
When the page is loaded with `tgWebAppData` whose `start_param` is not empty, the web app SHALL send
`POST /api/invites/preview` with `{"token": <start_param>}`. For role `"invited"` it SHALL show the invite screen and
send `POST /api/games/join` only after `Прийняти` — after the name form for a new player — and on `200` open
`/games/{id}`. For role `"organizer"` or `"opponent"` it SHALL join at once and open the game. It SHALL NOT preview or
join again when the tab is reloaded without the launch parameters.

In web-app scenarios `t2s` is `t2` with `start_param=Abc_123-xyz` before `hash`
(`user=…&start_param=Abc_123-xyz&hash=t2`).

#### Scenario: Registered player opens the link
- **WHEN** the app is loaded at `/#tgWebAppData=<t2s, URL-encoded>`, `GET /api/me` answers
  `200 {"id": 2, "name": "Тренер"}` and `POST /api/invites/preview` answers role `"invited"`
- **THEN** the app has sent `POST /api/invites/preview` with header `Authorization: tma <t2s>` and body
  `{"token": "Abc_123-xyz"}`
- **AND** the page shows the text `Клієнт кличе тебе в гру` and no `POST /api/games/join` has been sent
- **AND** after tapping `Прийняти` the app sends `POST /api/games/join` with header `Authorization: tma <t2s>` and
  body `{"token": "Abc_123-xyz"}`, and on `200` with game `7` the address is `/games/7`

#### Scenario: New player opens the link
- **WHEN** the app is loaded with `t2s`, `GET /api/me` answers `404` and the preview answers role `"invited"`
- **THEN** the page shows the text `Клієнт кличе тебе в гру` before the heading `Як тебе звати?`
- **AND** after tapping `Прийняти` the page shows the heading `Як тебе звати?` and no `POST /api/games/join` has been
  sent
- **AND** after tapping `Почати` and the server answering `201`, the app sends `POST /api/games/join` with body
  `{"token": "Abc_123-xyz"}` and, on `200` with game `7`, the address is `/games/7`

#### Scenario: Declining the invite
- **WHEN** the app is loaded with `t2s` as registered player `2` and the person taps `Відмовитись` on the invite
  screen
- **THEN** the page shows the heading `Мої ігри`
- **AND** no `POST /api/games/join` has been sent, and no other request than `GET /api/me`,
  `POST /api/invites/preview` and `GET /api/games`

#### Scenario: A new player declines
- **WHEN** the app is loaded with `t2s`, `GET /api/me` answers `404`, and the person taps `Відмовитись` on the invite
  screen
- **THEN** the page shows the heading `Як тебе звати?`
- **AND** after tapping `Почати` and the server answering `201`, the page shows the heading `Мої ігри` and no
  `POST /api/games/join` has been sent

#### Scenario: The opponent opens the link again
- **WHEN** the app is loaded with `t2s` as player `2`, the preview answers role `"opponent"` and
  `POST /api/games/join` answers `200` with game `7`
- **THEN** the app has sent `POST /api/games/join` without a tap
- **AND** the address is `/games/7` and the page does not show `Клієнт кличе тебе в гру`

#### Scenario: Reload after joining
- **WHEN** the app has joined game `7` from `t2s` and is loaded again in the same tab at `/games/7` without a fragment
- **THEN** no further `POST /api/invites/preview` or `POST /api/games/join` has been sent

#### Scenario: Launch without a start parameter
- **WHEN** the app is opened as player `2` with `t2`
- **THEN** neither `POST /api/invites/preview` nor `POST /api/games/join` has been sent
- **AND** the page shows the heading `Мої ігри`

### Requirement: A link that cannot be joined says why
When `POST /api/invites/preview` or `POST /api/games/join` answers `409`, the web app SHALL show
`Це запрошення вже прийняв інший гравець.`; on `404` `Запрошення не знайдено.`; on another failure
`Не вдалося приєднатися до гри.` Each SHALL come with the link `Мої ігри` to `/`.

#### Scenario: Link already used
- **WHEN** the app is loaded with `t2s` as player `2` and `POST /api/invites/preview` answers `409` with
  `{"detail": "Invite already used"}`
- **THEN** the page shows the text `Це запрошення вже прийняв інший гравець.` and the link `Мої ігри`
- **AND** after tapping `Мої ігри` the page shows the heading `Мої ігри`

#### Scenario: Unknown link
- **WHEN** `POST /api/invites/preview` answers `404` with `{"detail": "Invite not found"}`
- **THEN** the page shows the text `Запрошення не знайдено.` and the link `Мої ігри`

#### Scenario: No connection while reading the invite
- **WHEN** `POST /api/invites/preview` fails with a network error
- **THEN** the page shows the text `Не вдалося приєднатися до гри.` and the link `Мої ігри`

#### Scenario: No connection while joining
- **WHEN** the invite screen is shown to player `2`, the person taps `Прийняти` and `POST /api/games/join` fails with
  a network error
- **THEN** the page shows the text `Не вдалося приєднатися до гри.` and the link `Мої ігри`

#### Scenario: Someone else accepted first
- **WHEN** the invite screen is shown to player `2`, the person taps `Прийняти` and `POST /api/games/join` answers
  `409` with `{"detail": "Invite already used"}`
- **THEN** the page shows the text `Це запрошення вже прийняв інший гравець.` and the link `Мої ігри`
