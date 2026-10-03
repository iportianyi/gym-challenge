# Proposal

## Why

The app shows only a greeting and a server status, so nobody can play yet. Spec v1.3 (`docs/spec.md`) sets the MVP
flow: no sign-in, two default players, the creator starts a game by the opponent's email and sets the penalties.
This change delivers that first part — who I am and which games I have — so the next change
(`add-rounds-and-scoring`) can add rounds to a game that already exists. It is also the first change with real
screens, so the visual direction of the app is chosen here, once, instead of restyling every screen later.

## What Changes

- Persistent storage: SQLite through SQLModel with Alembic migrations, run when the app starts; in Docker the
  database file lives in a named volume, so games survive `docker compose down` / `up`.
- Two default players, «Клієнт» and «Тренер», each with an email, created by a migration.
- `GET /api/players` — the list of players, for the "who am I" screen.
- Player identity without a password: the browser asks which player is using it, remembers the choice in its local storage, and sends it with every
  API request in the `X-Player-Id` header. Game endpoints answer `401` without a valid one.
  This is easy to fake on purpose (spec v1.3 accepts it for two people and a local run).
- `POST /api/games` — the caller becomes the creator; the body names the opponent by email and the game settings
  (one penalty exercise, base reps, step for losses in a row, reps for losing the game). Unknown email or the caller's own email → `422`.
  Several active games are allowed, also with the same opponent.
- `GET /api/games` — the caller's games (as creator or opponent), newest first.
- Frontend screens: "who am I" picker, "my games" list, "new game" form, "change player". The existing greeting and
  API status stay at the top of every screen.
- The visual direction «Табло» (navy, amber scoreboard digits; chosen by the human from three options in design.md)
  applied to all screens.

Out of scope: rounds, guesses, scores, penalties shown during play, finishing a game (`add-rounds-and-scoring`);
sign-in with a password (spec: after MVP); TS types generated from OpenAPI (see design.md, Non-Goals).

## Capabilities

### New Capabilities
- `players`: the default players, listing them, and how a request says which player makes it (`X-Player-Id`).
- `games`: creating a game with an opponent and settings, listing the caller's games, keeping them across restarts.

### Modified Capabilities
None. `web-shell` requirements (greeting, API status, same origin, deep links) stay as they are; the new screens
render below the greeting and status.

## Impact

- **New backend dependencies** (approved by the human): `sqlmodel`, `alembic`.
- **Frontend font**: `dseg` package for the DSEG7 scoreboard digits (visual direction B «Табло», design.md D7).
- **Build config** (approved by the human): `docker-compose.yml` gains a named volume and `DATABASE_URL` for `app`;
  `Dockerfile` creates `/app/data` owned by the runtime user.
- Backend: `app/db.py`, `app/models.py`, `app/migrations/`, `app/api/players.py`, `app/api/games.py`,
  `create_app()` gets a database URL; tests get a temporary database fixture.
- Frontend: `src/api/` clients, new screen components, styles; `App.tsx` composes them.
- API: three new endpoints under `/api`; existing endpoints unchanged.
