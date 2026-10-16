# telegram-auth Specification

## Purpose

Lets the server know which person makes a request only from Telegram Mini App `initData` whose signature it has
checked with the bot token, and lets the web app obtain that `initData` from Telegram, keep it and send it.

## Requirements

### Requirement: A request proves its person with signed Telegram initData
Every endpoint except `GET /api/health` SHALL take the person from the header `Authorization: tma <initData>`, where
`<initData>` is the raw query string Telegram gave the Mini App. The server SHALL accept it only when its `hash` equals
the hex HMAC-SHA-256 of the data-check-string (every other field as `key=value`, sorted by key, joined by `\n`)
under the key HMAC-SHA-256(key `WebAppData`, message bot token). Otherwise `401 {"detail": "Invalid Telegram login"}`.

In API scenarios the server runs with the bot token `123456:TEST-TOKEN`; "a valid login for Telegram user `U`"
is `initData` with `auth_date` 60 seconds ago and `user` `{"id": U, "first_name": "Іван"}`, signed with that token.
"As player `N`" means a valid login for the Telegram account of player `N`; test players are `1` `Клієнт`
(Telegram user `1001`), `2` `Тренер` (`1002`) and, where named, `3` `Гість` (`1003`), registered by the test.

#### Scenario: Valid login
- **WHEN** a client sends `GET /api/me` with `Authorization: tma <a valid login for Telegram user 1001>`
- **THEN** the response status is `200`

#### Scenario: No Authorization header
- **WHEN** a client sends `GET /api/games` without the `Authorization` header
- **THEN** the response status is `401`
- **AND** the body parsed as JSON equals `{"detail": "Invalid Telegram login"}`

#### Scenario: Other scheme
- **WHEN** a client sends `GET /api/me` with `Authorization: Bearer <a valid login for Telegram user 1001>`
- **THEN** the response status is `401`
- **AND** the body parsed as JSON equals `{"detail": "Invalid Telegram login"}`

#### Scenario: Signed with another bot's token
- **WHEN** a client sends `GET /api/me` with `Authorization: tma <initData>` signed with the token
  `654321:OTHER-TOKEN` instead
- **THEN** the response status is `401`

#### Scenario: User changed after signing
- **WHEN** a valid login for Telegram user `1001` has its `user` field replaced by `{"id": 1002, "first_name": "Іван"}`
  while keeping its `hash`, and is sent to `GET /api/me`
- **THEN** the response status is `401`

#### Scenario: The signature field is part of the checked data
- **WHEN** a valid login for Telegram user `1001` also contains the field `signature=abc`, included in the
  data-check-string when it was signed, and is sent to `GET /api/me`
- **THEN** the response status is `200`

#### Scenario: Login without a user
- **WHEN** a client sends `GET /api/me` with `initData` holding only `auth_date` 60 seconds ago, correctly signed
- **THEN** the response status is `401`

### Requirement: A login is accepted for 24 hours
The server SHALL accept `initData` only while `now − auth_date` is at most 86400 seconds; an older one, or one without
a whole-number `auth_date`, SHALL be answered `401 {"detail": "Invalid Telegram login"}`. Telegram issues fresh
`initData` each time the Mini App is opened.

#### Scenario: A login from this morning
- **WHEN** a client sends `GET /api/me` with a login for Telegram user `1001` signed correctly with `auth_date`
  86000 seconds ago
- **THEN** the response status is `200`

#### Scenario: A login from yesterday
- **WHEN** the same request is sent with `auth_date` 86401 seconds ago
- **THEN** the response status is `401`
- **AND** the body parsed as JSON equals `{"detail": "Invalid Telegram login"}`

### Requirement: The server needs a bot token to start
The server SHALL read the bot token from the environment variable `TELEGRAM_BOT_TOKEN` and the bot's username, used in
invite links, from `TELEGRAM_BOT_USERNAME`, and SHALL refuse to start when either is unset or empty, naming the
variable in the error. The token SHALL NOT be sent in any response.

#### Scenario: Token missing
- **WHEN** the app is started with `TELEGRAM_BOT_TOKEN` unset
- **THEN** startup fails with an error whose message contains `TELEGRAM_BOT_TOKEN`

#### Scenario: Username missing
- **WHEN** the app is started with a token and `TELEGRAM_BOT_USERNAME` unset
- **THEN** startup fails with an error whose message contains `TELEGRAM_BOT_USERNAME`

#### Scenario: Health check does not need a login
- **WHEN** the server runs with a token and a client sends `GET /api/health` without the `Authorization` header
- **THEN** the response status is `200`

### Requirement: The web app takes initData from the Telegram launch parameters
When the page is loaded with `tgWebAppData` in the URL fragment, the web app SHALL use its value as `initData`, keep
it for the browser tab (so a reload in the same tab keeps it), remove the fragment from the address, and send
`Authorization: tma <initData>` with every API request except `GET /api/health`.

In web-app scenarios `t1` is the test `initData`
`user=%7B%22id%22%3A1001%2C%22first_name%22%3A%22%D0%86%D0%B2%D0%B0%D0%BD%22%7D&hash=t1` (the web app never checks
it), and "opened as player `1`" means the app was loaded with `#tgWebAppData=<t1, URL-encoded>` and `GET /api/me`
answered `200 {"id": 1, "name": "Клієнт"}`; likewise `t2` and player `2` `Тренер`.

#### Scenario: Opened from Telegram
- **WHEN** the app is loaded at `/#tgWebAppData=<t1, URL-encoded>&tgWebAppVersion=8.0`
- **THEN** the app sends `GET /api/me` with header `Authorization: tma <t1>`
- **AND** the address is `/` with no fragment

#### Scenario: Reload in the same tab
- **WHEN** the app has been opened as player `1` and is loaded again at `/games/1` in the same tab, without a fragment
- **THEN** the app sends `GET /api/me` with header `Authorization: tma <t1>`

### Requirement: Outside Telegram the app only says where to open it
When the page has no `tgWebAppData` in the URL fragment and none is kept for the tab, the web app SHALL show the text
`Відкрий Gym Challenge у Telegram` under the main heading and nothing else, and SHALL NOT send any API request.

#### Scenario: Opened in a plain browser
- **WHEN** the app is loaded at `/` in a fresh tab without a fragment
- **THEN** the page shows the text `Відкрий Gym Challenge у Telegram`
- **AND** the page does not show the heading `Мої ігри`
- **AND** no request to `/api/` has been sent

### Requirement: A refused login asks to reopen the app
When any API request answers `401`, the web app SHALL forget the kept `initData` and show only the text
`Вхід застарів. Закрий і знову відкрий застосунок у Telegram.` under the main heading.

#### Scenario: Login expired while the list is open
- **WHEN** the app has been opened as player `1` and `GET /api/games` answers `401` with
  `{"detail": "Invalid Telegram login"}`
- **THEN** the page shows the text `Вхід застарів. Закрий і знову відкрий застосунок у Telegram.`
- **AND** the page does not show the heading `Мої ігри`

#### Scenario: Reload after a refused login
- **WHEN** after that the app is loaded again in the same tab without a fragment
- **THEN** the page shows the text `Відкрий Gym Challenge у Telegram`
