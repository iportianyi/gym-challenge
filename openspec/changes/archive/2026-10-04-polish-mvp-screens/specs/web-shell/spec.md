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
- **WHEN** the request to `GET /api/players` fails with a network error
- **THEN** the page still shows the level 1 heading `Gym Challenge`

#### Scenario: No server status
- **WHEN** the start page has loaded and `GET /api/players` has answered `200`
- **THEN** no request to `GET /api/health` has been sent
- **AND** the page shows none of the texts `Перевіряємо сервер…`, `Сервер працює`, `Сервер недоступний`

## REMOVED Requirements

### Requirement: Start page shows whether the API is reachable
**Reason**: The human decided after the MVP review (2026-10-03) that the status takes the top of every screen on a
phone and tells the player nothing they can act on; a failed request already shows its own message on each screen
(`Не вдалося завантажити …`, `Немає зв'язку, пробуємо ще`).
**Migration**: None for players. `GET /api/health` stays for operators and checks (`service-health`).
