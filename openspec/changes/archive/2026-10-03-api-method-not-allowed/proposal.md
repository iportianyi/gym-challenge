# Proposal

## Why

The review of `add-project-skeleton` (`docs/reviews/add-project-skeleton.md`, finding 3) found that the `/api`
catch-all answers **404** to a known API path called with a method it does not support (`POST /api/health`), where
HTTP expects **405 Method Not Allowed** with an `Allow` header. Every API route added later inherits this: a client
sending the wrong method would be told the endpoint does not exist. Fixing it now, while the API has one route, is
cheap.

## What Changes

- A request to an existing API path with a method that path does not support answers `405` with a JSON body and an
  `Allow` header listing the supported methods.
- Unknown API paths keep answering `404` for **every** method — a probe showed that the obvious fix (catch-all for
  `GET` only) would turn `POST /api/does-not-exist` into a `405`; the requirement gains a scenario that pins this.
- No change to the frontend, the health response, or the start page.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `service-health`: adds the 405 requirement for a known API path with an unsupported method, and a `POST` scenario
  to "Unknown API paths return 404".

## Impact

- `backend/app/main.py` (catch-all handler) and backend tests. No new dependencies, no frontend or Docker changes.
