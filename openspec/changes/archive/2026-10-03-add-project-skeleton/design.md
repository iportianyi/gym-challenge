# Design

## Context

Greenfield: the repo holds only docs, the Claude harness and OpenSpec tooling (root `package.json`, pnpm, Node 22 on
the host). The host has Docker Compose and GNU Make but **no uv and only Python 3.10**; the human chose to run all
backend and frontend checks **inside Docker** rather than install a Python toolchain on the host. Stack choices and
their reasons are in `docs/spec.md` → «Стек». Requirements are in `specs/service-health` and `specs/web-shell`.

## Goals / Non-Goals

**Goals:**
- One command to run the app (`docker compose up --build` → `http://localhost:8000`) and one to verify the tree
  (`make check`), both working on a fresh clone with only Docker, Make, Node and pnpm on the host.
- Backend tests that do not need a frontend build; frontend tests that do not need a running backend.
- A layout every later change can extend without moving files.

**Non-Goals:**
- Database, SQLModel, Alembic, auth, game logic — later changes.
- Hot-reload development inside Compose (`fastapi dev` + Vite dev server). Can be added as a Compose profile later.
- Generating TypeScript types from OpenAPI — first change with a real API contract does it.
- CI workflow, reviewer subagent, agent loop script — separate harness steps.
- Client-side router library — the frontend has one page at `/`; the deep-link fallback is a server behavior.
  The human chose React Router for when routes appear; it is added with the first change that needs a second page.

## Decisions

### Layout
```
backend/   pyproject.toml, uv.lock, app/main.py, app/api/…, tests/
frontend/  package.json, pnpm-lock.yaml, vite/ts/eslint config, src/, index.html
Dockerfile, docker-compose.yml, .dockerignore, Makefile   (repo root)
```
`frontend/` is a standalone pnpm project (no workspace with the root tooling `package.json`), so its lock file and
Docker build context stay independent of OpenSpec.

### Backend: app factory + `/api` router + API catch-all
- `create_app(frontend_dir: Path | None)` builds the app: includes an `APIRouter(prefix="/api")` with `GET /health`
  returning a Pydantic model `{"status": "ok"}` (return type, per the fastapi skill), then mounts the frontend with
  `app.frontend("/", directory=frontend_dir)` when a directory is given. The module-level `app` reads the directory
  from env `FRONTEND_DIST` (default `/app/frontend-dist`, the path in the runtime image).
- **Why a catch-all `/api/{path:path}` → 404 JSON for all methods:** `app.frontend()` falls back to `index.html` for
  any `GET` with `Accept: text/html` that no route matched — including `/api/does-not-exist` from a browser. The
  catch-all is a regular route, so it wins over the low-priority frontend routes and keeps `/api/` API-only
  (scenario «Browser navigates to an unknown API path»). Alternative — mounting the frontend under a sub-path — was
  rejected: the app must live at `/`.
- Tests use FastAPI's `TestClient` with a temporary `frontend_dir` holding a fake `index.html` and `assets/`, so they
  check the serving rules without building the real frontend.
- Versions: Python 3.13; `fastapi[standard]` pinned to the current release with `app.frontend()` (0.142.x at
  planning time); dev group: `pytest`, `ruff`, `ty`, `httpx`. Exact versions land in `uv.lock`.

### Frontend: one page, fetch isolated
- Vite `react-ts` template trimmed to one page. `index.html` sets `<html lang="uk">` and the standard viewport meta.
- `src/api/health.ts` exports `checkHealth(): Promise<boolean>` (true only for 200 + `status === "ok"`; false on any
  other status or a network error). `App` renders the `<h1>Welcome to Gym Challenge</h1>` heading (English by the product owner's
  choice) and a status line from state `"checking" | "up" | "down"`: `Перевіряємо сервер…`, `Сервер працює`,
  `Сервер недоступний`. The heading does not depend on the health request.
- Vitest + `@testing-library/react` in `jsdom`, `fetch` stubbed per test — one test per web-shell page scenario.
- Styling stays minimal here; the visual direction is set later with the `frontend-design` skill.

### Docker: one multi-stage Dockerfile, check services in a Compose profile
- Stages: `frontend-deps` (node:24-slim, pnpm 11.17.0 installed with `npm i -g`, `pnpm install --frozen-lockfile`)
  → `frontend-build` (`pnpm build`); `backend-deps` (python:3.13-slim + `uv` binary copied from a pinned
  `ghcr.io/astral-sh/uv` tag, `uv sync --frozen` into `/opt/venv` via `UV_PROJECT_ENVIRONMENT`);
  `runtime` (backend deps without dev group + `app/` + built `dist` at `/app/frontend-dist`, `fastapi run` on 8000).
- **pnpm via `npm i -g`, not corepack:** corepack in older Node images fails signature checks (`Cannot find matching
  keyid` — hit on this host's Node 22.2).
- Compose: service `app` (target `runtime`, `8000:8000`) is the default. Services `backend-check` and
  `frontend-check` sit in profile `check`; they bind-mount `backend/` or `frontend/` so checks see the working tree
  without a rebuild, while dependencies live outside the mount (`/opt/venv`; an anonymous volume over
  `frontend/node_modules`).
- Check containers run as the host user (`user: "${UID:-1000}:${GID:-1000}"`) and tool caches are pointed to `/tmp`,
  so no root-owned `.pytest_cache`, `.ruff_cache` or `dist/` appear in the working tree.

### `make check`
Sequential, stops at the first failing step, prints which step failed:
1. `docker compose --profile check build backend-check frontend-check`
2. backend: `ruff check` · `ruff format --check` · `ty check` · `pytest`
3. frontend: `pnpm lint` (ESLint) · `pnpm typecheck` (`tsc --noEmit`) · `pnpm test` (Vitest run)
4. host: `pnpm spec:check`

It ends with one summary line `check: OK (backend, frontend, spec)` on success. The allow-list in
`.claude/settings.json` gets `Bash(make check)` (harness change, shown to the human before commit).

## Risks / Trade-offs

- [`app.frontend()` is a new FastAPI API] → pin the FastAPI version in `uv.lock`; behavior covered by backend tests.
- [Checks in Docker are slower than on the host (image build, container start)] → dependency layers are cached and
  sources are bind-mounted, so a code-only change re-runs tools without reinstalling; first build is slow once.
- [No Python venv on the host → the IDE does not resolve backend imports] → configure PyCharm's Docker Compose
  interpreter (`backend-check` service) if needed; not required for `make check`.
- [Bind mounts + container user can create files the host user cannot delete] → host UID/GID in Compose, caches in
  `/tmp`; verified by `git status` showing no new untracked files after `make check`.
- [Generating `uv.lock` / `pnpm-lock.yaml` needs the tools] → generated inside throwaway containers
  (`docker run … uv lock`, `docker run … pnpm install`) and committed; host stays clean.

## Implementation notes (reality vs plan)

Recorded during apply; each item changed how the plan was carried out, not what the specs require.

- **TypeScript 6.0.3, not 7.x** — `typescript-eslint` 8.71 supports `typescript <6.1`.
- **ESLint 10.11.0, not 10.12.0** — pnpm 11 refuses packages younger than its `minimumReleaseAge`; 10.12.0 was a day
  old and pnpm wrote an exclusion into a new `pnpm-workspace.yaml`. The exclusion was dropped in favour of the
  previous release instead of bypassing the supply-chain guard.
- **No `@testing-library/jest-dom`** — `getByText`/`queryByText` assertions cover the scenarios.
- **Backend base image `ghcr.io/astral-sh/uv:0.12.22-python3.13-trixie-slim`** (uv + Python in one official image;
  no bookworm variant for this uv version) instead of `python:3.13-slim` + copied uv binary. The bare uv image has no
  Python, so it cannot run `uv lock`.
- **Frontend dependencies in `/app/node_modules`** (one level above the bind-mounted `/app/frontend`) instead of an
  anonymous volume over `frontend/node_modules`: module resolution walks up, and no 160 MB copy per run.
- **`make check` calls ESLint, `tsc` and Vitest directly**, not `pnpm run …`: pnpm 11 verifies the install before a
  script, finds no `./node_modules` in the bind mount and installs into the working tree.
- **`index.html` content (lang, viewport, `#root`) is tested in the frontend** (`src/indexHtml.test.ts`); the backend
  check container mounts only `backend/`, so backend tests assert that the server delivers the frontend's
  `index.html` and the fallback rules. End-to-end `curl` in 5.1 covers both together.
- **Environment:** containers resolve DNS only with the human's VPN up — `/etc/docker/daemon.json` lists three
  VPN-only nameservers first, and glibc uses only the first three. Not changed in the repo.
