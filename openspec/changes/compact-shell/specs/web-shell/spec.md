# Spec Delta

## MODIFIED Requirements

### Requirement: Start page greets the player
The start page SHALL show the heading `Gym Challenge` as its main (level 1) heading. This text is in English by the
product owner's choice, as an exception to the Ukrainian UI copy rule. The page SHALL NOT request `GET /api/health`
and SHALL NOT show a server status. The heading SHALL stand in the page header, a single line above every screen;
once the player is known, the header SHALL also show the player's name on the same line, preceded by the words
`Ти граєш як ` for screen readers only (visually hidden). On a screen 320 px wide the header SHALL stay one line:
a name too long for it is cut with `…`.

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

#### Scenario: The header names the player
- **WHEN** the app is opened as player `1` (`Клієнт`)
- **THEN** the page header contains the level 1 heading `Gym Challenge` and the text `Клієнт`
- **AND** the text content of the page header is `Gym ChallengeТи граєш як Клієнт`
- **AND** the words `Ти граєш як ` are inside an element hidden visually but not from screen readers

#### Scenario: The header before the player is known
- **WHEN** the app is loaded with `t1`, `GET /api/me` answers `404` and the page shows the heading `Як тебе звати?`
- **THEN** the text content of the page header is `Gym Challenge`

#### Scenario: The header is one line on a phone
- **WHEN** the app is opened at 320×640 px as a player named `Олександра-Анастасія Вишнева-Подільська`
  (39 characters) and shows `Мої ігри`
- **THEN** the heading `Gym Challenge` and the name have the same top position on the screen
- **AND** the page has no horizontal scroll
- **AND** the name ends with `…` where it does not fit

## ADDED Requirements

### Requirement: The page has an icon
The page SHALL link an SVG icon at `/favicon.svg`, served from the frontend build, so that a browser does not ask for
`/favicon.ico`.

#### Scenario: The icon is linked
- **WHEN** the frontend's `index.html` is read
- **THEN** it contains `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`
- **AND** the frontend's public directory has a file `favicon.svg` whose content starts with `<svg`

#### Scenario: No request for favicon.ico
- **WHEN** a browser opens the app as a player and shows `Мої ігри`
- **THEN** `GET /favicon.svg` answers `200` with a `Content-Type` starting with `image/svg+xml`
- **AND** no request for `/favicon.ico` has been made
