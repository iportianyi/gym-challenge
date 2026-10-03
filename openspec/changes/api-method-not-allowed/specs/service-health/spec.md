# Spec Delta

## ADDED Requirements

### Requirement: Known API paths reject unsupported methods with 405
The system SHALL answer a request to an existing API path made with a method that path does not support with HTTP
405, a JSON body, and an `Allow` header that lists the methods the path supports.

#### Scenario: POST to the health endpoint
- **WHEN** a client sends `POST /api/health`
- **THEN** the response status is `405`
- **AND** the `Content-Type` header starts with `application/json`
- **AND** the `Allow` header equals `GET`

#### Scenario: DELETE to the health endpoint
- **WHEN** a client sends `DELETE /api/health`
- **THEN** the response status is `405`
- **AND** the `Allow` header equals `GET`

## MODIFIED Requirements

### Requirement: Unknown API paths return 404
The system SHALL answer any request to a path under `/api/` that has no API route with HTTP 404 and a JSON body,
regardless of the request's `Accept` header. It SHALL NOT answer such a request with the frontend's HTML page.

#### Scenario: API client requests an unknown API path
- **WHEN** a client sends `GET /api/does-not-exist` with header `Accept: application/json`
- **THEN** the response status is `404`
- **AND** the `Content-Type` header starts with `application/json`

#### Scenario: Browser navigates to an unknown API path
- **WHEN** a client sends `GET /api/does-not-exist` with header `Accept: text/html`
- **THEN** the response status is `404`
- **AND** the `Content-Type` header starts with `application/json`
- **AND** the body does not contain `<div id="root">`

#### Scenario: Non-GET request to an unknown API path
- **WHEN** a client sends `POST /api/does-not-exist`
- **THEN** the response status is `404`
- **AND** the `Content-Type` header starts with `application/json`
- **AND** the response has no `Allow` header
