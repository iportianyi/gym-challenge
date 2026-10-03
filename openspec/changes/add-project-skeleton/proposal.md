# Proposal

## Why

The repo has a product spec (`docs/spec.md`) and a harness, but no code. Every later change (game rules,
auth, game flow) needs the same base: a FastAPI backend, a React frontend served from the same origin,
a one-command local run via Docker Compose, and one check command that proves the tree is green.
Building that base first, as its own change, means each feature change only adds behavior.

## What Changes

- New `backend/`: FastAPI app (Python 3.13, managed by uv) with `GET /api/health`; ruff, ty and pytest configured.
- New `frontend/`: React + TypeScript + Vite app (pnpm) with a single start page at `/`: the heading
  `Welcome to Gym Challenge` and a Ukrainian API status line from `/api/health`; ESLint, `tsc` and Vitest configured.
- FastAPI serves the built frontend with `app.frontend()` from the same origin as the API, with client-side
  routing fallback to `index.html`.
- `Dockerfile` (multi-stage: frontend build → Python runtime) and `docker-compose.yml`: `docker compose up --build`
  serves the app on `http://localhost:8000`.
- `Makefile` with `make check`: backend and frontend checks run in Docker containers; the OpenSpec spec gate
  (`pnpm spec:check`) runs on the host. Exit code is non-zero if any step fails.
- No database, auth or game logic yet — those are separate changes.

## Capabilities

### New Capabilities

- `service-health`: the API reports that the service is up, and unknown API paths answer 404 instead of the frontend.
- `web-shell`: the browser gets the frontend app from the same origin as the API, client-side routes fall back to
  `index.html`, and the start page greets the player and shows whether the API is reachable.

### Modified Capabilities

_None — there are no existing specs._

## Impact

- New directories: `backend/`, `frontend/`; new root files: `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `Makefile`.
- New dependencies (exact versions fixed in lock files during apply): backend — fastapi (a release with
  `app.frontend()`), uvicorn via `fastapi[standard]`, ruff, ty, pytest, httpx; frontend — react, react-dom, vite,
  typescript, vitest, @testing-library/react, eslint.
- Docker images: `python:3.13-slim`, `node:24-slim`, and the uv binary from `ghcr.io/astral-sh/uv`.
- `.claude/settings.json` allow-list gains `make check` (harness change — shown to the human before commit).
- Host requirements: Docker with Compose, GNU Make, Node + pnpm (already used for OpenSpec). No uv or Python
  3.13 on the host.
