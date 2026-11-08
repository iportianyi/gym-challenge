# Spec Delta

## MODIFIED Requirements

### Requirement: The first login asks for the player's name
When `GET /api/me` answers `404`, the web app SHALL show the heading `Як тебе звати?`, a field `Твоє ім'я` filled
with the `first_name` from the launch `initData`, and a button `Почати`. `Почати` SHALL send `POST /api/me` with the
trimmed name and, on `201`, continue to the requested address as that player, with the name in the page header.
A name outside 1–40 characters SHALL show `Ім'я — від 1 до 40 символів` and send nothing.

#### Scenario: Confirm the Telegram name
- **WHEN** the app is loaded with `t1` (first name `Іван`), `GET /api/me` answers `404`, and the person taps `Почати`
- **THEN** before the tap the page shows the heading `Як тебе звати?` and the field `Твоє ім'я` has the value `Іван`
- **AND** the app sends `POST /api/me` with header `Authorization: tma <t1>` and body `{"name": "Іван"}`
- **AND** after a `201` answer `{"id": 1, "name": "Іван"}` the page header contains the text `Іван` and the page
  shows the heading `Мої ігри`

#### Scenario: Correct the name
- **WHEN** on that screen the person replaces the name with `Ваня` and taps `Почати`
- **THEN** the app sends `POST /api/me` with body `{"name": "Ваня"}`

#### Scenario: Empty name
- **WHEN** on that screen the person clears the field and taps `Почати`
- **THEN** the page shows the text `Ім'я — від 1 до 40 символів`
- **AND** no `POST /api/me` has been sent

#### Scenario: The requested address is kept
- **WHEN** the app is loaded at `/games/new` with `t1`, `GET /api/me` answers `404`, and the person taps `Почати`
  and the server answers `201`
- **THEN** the page shows the heading `Нова гра` and the address is `/games/new`

### Requirement: A known player goes straight to their games
When `GET /api/me` answers `200`, the web app SHALL show the player's name in the page header and the requested
screen, without the name form and without any way to switch players. If `GET /api/me` fails for another reason, it
SHALL show `Не вдалося зв'язатися з сервером.` instead.

#### Scenario: Returning player
- **WHEN** the app is opened as player `1`
- **THEN** the page header contains the text `Клієнт` and the page shows the heading `Мої ігри`
- **AND** the page shows neither the field `Твоє ім'я` nor the button `Змінити гравця`

#### Scenario: Server unreachable
- **WHEN** the app is loaded with `t1` and `GET /api/me` fails with a network error
- **THEN** the page shows the text `Не вдалося зв'язатися з сервером.`
- **AND** the page does not show the heading `Мої ігри`
