# Spec Delta

## MODIFIED Requirements

### Requirement: Start page greets the player
The start page SHALL show the heading `Gym Challenge` as its main (level 1) heading. This text is in English by the
product owner's choice, as an exception to the Ukrainian UI copy rule. The page SHALL NOT request `GET /api/health`
and SHALL NOT show a server status.

#### Scenario: Greeting is shown
- **WHEN** the start page has loaded
- **THEN** the page has exactly one level 1 heading
- **AND** its text is `Gym Challenge`

#### Scenario: Greeting does not depend on the API
- **WHEN** the app is loaded with `t1` and the request to `GET /api/me` fails with a network error
- **THEN** the page still shows the level 1 heading `Gym Challenge`

#### Scenario: Greeting outside Telegram
- **WHEN** the app is loaded without launch parameters
- **THEN** the page shows the level 1 heading `Gym Challenge` and the text `Відкрий Gym Challenge у Telegram`

#### Scenario: No server status
- **WHEN** the app has been opened as player `1`
- **THEN** no request to `GET /api/health` has been sent
- **AND** the page shows none of the texts `Перевіряємо сервер…`, `Сервер працює`, `Сервер недоступний`
