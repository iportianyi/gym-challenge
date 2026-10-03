# Tasks

## 1. Scenario tests (red, committed on their own)

- [x] 1.1 Add backend tests for the new and modified scenarios in `specs/service-health` (`POST /api/health` → 405 JSON `Allow: GET`; `DELETE /api/health` → 405 `Allow: GET`; `POST /api/does-not-exist` → 404 JSON without `Allow`); run `make check` and quote the failing lines
- [x] 1.2 Commit the red tests alone (`test: …`); verify with `git show --stat HEAD` that only `backend/tests/` changed

## 2. Implementation

- [x] 2.1 Make the `/api` catch-all take the `Request`, find routes that partially match it and answer 405 with a sorted `Allow` header, else 404 (implemented differently — per-method full-match probe, `Allow` in `API_METHODS` order; see design.md «Implementation notes»); verify all backend tests pass in `make check`, including the existing `service-health` and `web-shell` ones
- [x] 2.2 Verify against the running app (`docker compose up --build -d`) with `curl`: `POST /api/health` → 405 `allow: GET`, `POST /api/does-not-exist` → 404, `GET /api/health` → 200; quote the output

## 3. Review and verification

- [x] 3.1 Run the change-reviewer subagent on a review packet and save its reply verbatim to docs/reviews/api-method-not-allowed.md
- [x] 3.2 Run the project check command and quote its summary line
