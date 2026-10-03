# web-shell Specification

## Purpose

Delivers the gym-challenge web app to a phone or desktop browser from the same origin as the API, and gives the
start page an honest signal of whether the backend can be reached.

## Requirements

### Requirement: Frontend is served from the same origin as the API
The system SHALL answer `GET /` from a browser with the frontend's HTML page, served by the same server and port
as the API. The page SHALL declare Ukrainian as its language and a mobile viewport.

#### Scenario: Browser opens the start page
- **WHEN** a client sends `GET /` with header `Accept: text/html`
- **THEN** the response status is `200`
- **AND** the `Content-Type` header starts with `text/html`
- **AND** the body contains `<div id="root">`
- **AND** the body contains `<html lang="uk">`
- **AND** the body contains `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`

### Requirement: Client-side routes fall back to the start page
The system SHALL answer a browser navigation (`GET` with `Accept: text/html`) to a path outside `/api/` that is not
a built file with the same HTML page as `GET /`, so the frontend can route it. Missing static asset files SHALL
still return 404.

#### Scenario: Browser opens a deep link
- **WHEN** a client sends `GET /games/42` with header `Accept: text/html`
- **THEN** the response status is `200`
- **AND** the body is identical to the body of `GET /` with header `Accept: text/html`

#### Scenario: Missing asset file
- **WHEN** a client sends `GET /assets/missing.js` with header `Accept: */*`
- **THEN** the response status is `404`

### Requirement: Start page greets the player
The start page SHALL show the heading `Welcome to Gym Challenge` as its main (level 1) heading. This text is in
English by the product owner's choice, as an exception to the Ukrainian UI copy rule.

#### Scenario: Greeting is shown
- **WHEN** the start page has loaded
- **THEN** the page has exactly one level 1 heading
- **AND** its text is `Welcome to Gym Challenge`

#### Scenario: Greeting does not depend on the API
- **WHEN** the request to `GET /api/health` fails with a network error
- **THEN** the page still shows the level 1 heading `Welcome to Gym Challenge`

### Requirement: Start page shows whether the API is reachable
The start page SHALL request `GET /api/health` when it loads and SHALL show exactly one of three Ukrainian status
texts: while waiting, on success, or on failure.

#### Scenario: Waiting for the API
- **WHEN** the start page has loaded and `GET /api/health` has not answered yet
- **THEN** the page shows the text `Перевіряємо сервер…`

#### Scenario: API is up
- **WHEN** `GET /api/health` answers `200` with body `{"status": "ok"}`
- **THEN** the page shows the text `Сервер працює`
- **AND** the page does not show `Перевіряємо сервер…`

#### Scenario: API answers with an error
- **WHEN** `GET /api/health` answers `503`
- **THEN** the page shows the text `Сервер недоступний`

#### Scenario: API cannot be reached
- **WHEN** the request to `GET /api/health` fails with a network error
- **THEN** the page shows the text `Сервер недоступний`
