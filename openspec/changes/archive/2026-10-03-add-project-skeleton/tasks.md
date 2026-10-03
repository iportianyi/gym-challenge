# Tasks

> Group 1 is toolchain scaffolding with no product behavior — it exists only so the scenario tests in group 2 can
> run at all. The first behavioral task is 2.1: scenario tests, committed red before any implementation.

## 1. Toolchain scaffolding (no behavior)

- [x] 1.1 Create `backend/pyproject.toml` (Python 3.13, `fastapi[standard]` pinned to the current release with `app.frontend()`; dev group `pytest`, `ruff`, `ty`, `httpx`; ruff/pytest/ty config with caches in `/tmp`) and an empty `backend/app/__init__.py`; generate `backend/uv.lock` in a throwaway container (`docker run … ghcr.io/astral-sh/uv:<pinned> uv lock`) and verify the lock file exists and names the FastAPI version
- [x] 1.2 Create `frontend/` from the Vite `react-ts` template trimmed to one page (`index.html` with `<html lang="uk">` and the viewport meta), add Vitest + `@testing-library/react` + `jsdom` and ESLint, scripts `lint`, `typecheck`, `test`, `build`; generate `frontend/pnpm-lock.yaml` in a throwaway `node:24-slim` container and verify the lock file exists
- [x] 1.3 Add `Dockerfile` stages `frontend-deps`, `backend-deps` and `.dockerignore`; add `docker-compose.yml` services `backend-check` and `frontend-check` in profile `check` (bind-mounted sources, deps outside the mount, host UID/GID); verify `docker compose --profile check build` succeeds
- [x] 1.4 Add `Makefile` target `check` (steps and summary line as in design.md) and verify `make check` runs every step in order — it is expected to fail at pytest/Vitest with "no tests collected"/"No test files found" at this point; quote that line

## 2. Scenario tests (red, committed on their own)

- [x] 2.1 Write backend tests in `backend/tests/` — one per scenario in `specs/service-health` (health check succeeds; API client and browser requesting `/api/does-not-exist`) and per server-side scenario in `specs/web-shell` (`GET /` HTML with `<div id="root">`, `lang="uk"` and viewport meta; deep link `/games/42` equals `/`; `/assets/missing.js` → 404) using `TestClient` with a temporary frontend directory; run `make check` and quote the failing lines
- [x] 2.2 Write frontend tests in `frontend/src/` — one per page scenario in `specs/web-shell` (greeting heading `Welcome to Gym Challenge`, greeting still shown when the API is down, waiting text, `Сервер працює` on 200 `{"status":"ok"}`, `Сервер недоступний` on 503 and on a network error) with `fetch` stubbed; run `make check` and quote the failing lines
- [x] 2.3 Commit the red tests alone (`test: …`), before any implementation; verify with `git show --stat HEAD` that only test files (and nothing under `backend/app/` or `frontend/src/` besides tests) changed

## 3. Backend implementation

- [x] 3.1 Implement `create_app(frontend_dir)` with the `/api` router, `GET /api/health` returning `{"status": "ok"}`, the `/api/{path:path}` catch-all → 404 JSON for all methods, and `app.frontend("/", directory=frontend_dir)`; module-level `app` reads `FRONTEND_DIST`; verify all backend scenario tests from 2.1 pass in `make check`

## 4. Frontend implementation

- [x] 4.1 Implement `src/api/health.ts` `checkHealth()` and the `App` start page with the `Welcome to Gym Challenge` heading and the three Ukrainian status texts; verify all frontend scenario tests from 2.2 pass in `make check`

## 5. Runtime image and local run

- [x] 5.1 Add `Dockerfile` stages `frontend-build` and `runtime` (`fastapi run` on port 8000, built `dist` at `/app/frontend-dist`) and Compose service `app` on `8000:8000`; run `docker compose up --build -d` and verify with `curl`: `/api/health` → 200 `{"status":"ok"}`, `/` and `/games/42` with `Accept: text/html` → identical HTML, `/api/does-not-exist` with `Accept: text/html` → 404 JSON
- [x] 5.2 Open `http://localhost:8000` with Playwright MCP at 375×812 and verify the page shows the heading `Welcome to Gym Challenge` and `Сервер працює`; save the screenshot to `.playwright-mcp/` and attach its description to the autonomy log
- [x] 5.3 Document `docker compose up --build` and `make check` in `CLAUDE.md` (Команди) and verify both commands run as written

## 6. Harness and verification

- [x] 6.1 Add `Bash(make check)` to the allow-list in `.claude/settings.json`; show the diff to the human and commit only after approval
- [x] 6.2 Verify `make check` leaves no new untracked or root-owned files (`git status --short` is clean apart from intended changes)
- [x] 6.3 Run the project check command and quote its summary line
