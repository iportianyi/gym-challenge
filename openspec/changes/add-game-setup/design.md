# Design

## Context

See proposal.md (Why). Current state, observed in the code:

- Backend: `create_app(frontend_dir)` in `backend/app/main.py` builds one `/api` router (`health`) with a catch-all
  fallback that must stay the last `/api` route; `app.frontend()` serves the build. No database, no models.
  Dependencies: only `fastapi[standard]`.
- Tests: `backend/tests/conftest.py` gives a `client` on `create_app(frontend_dir=tmp)`.
- Frontend: one `App.tsx` with the `Welcome to Gym Challenge` heading and the API status (`web-shell` spec), no
  router, no styles, no state library.
- Docker: runtime image copies only `backend/app` and runs as user `app`; no volume. `docs/spec.md` (Стек) fixes
  SQLite through SQLModel with Alembic migrations, the database in a volume.

## Goals / Non-Goals

**Goals:**
- A data layer and migration path the next change (`add-rounds-and-scoring`) extends with one migration.
- One place that resolves the acting player, reused by every game endpoint now and later.
- A visual system (tokens + a few components) the round screens reuse without new design decisions.

**Non-Goals:**
- TS types generated from the OpenAPI schema (`docs/spec.md`, Стек). It needs a new generator dependency and a
  `make check` step; with three endpoints the types are written by hand in `frontend/src/api/`. Follow-up change.
- A client-side router library. Three screens fit in component state; deep links stay served by `web-shell`.
- Any protection of `X-Player-Id` (spec v1.3 accepts that it can be faked).

## Decisions

### D1. SQLModel tables, Alembic migrations run at startup
Tables `player` (id, name, email unique) and `game` (id, creator_id → player, opponent_id → player, exercise,
base_reps, step_reps, final_reps, status, created_at). Migration `0001` creates both and inserts the
two default players with `op.bulk_insert`, so seeding happens exactly once per database by construction.
Migrations live in `app/migrations/` (inside the copied `app/` tree, so the Dockerfile needs no new `COPY`) and are
run from code (`alembic.command.upgrade` with a programmatic `Config`, no `alembic.ini`) in the app lifespan.
SQLite foreign keys are switched on per connection (`PRAGMA foreign_keys=ON`).
- *Alternative:* `SQLModel.metadata.create_all()` plus an idempotent seed — fewer moving parts today, but the next
  change alters tables that already hold games, which `create_all` cannot do; the spec already chose Alembic.

### D2. Database URL injected into `create_app`
`create_app(frontend_dir=None, database_url=...)`; the module-level `app` reads `DATABASE_URL` (default
`sqlite:///./gym.db`, git-ignored). The engine is created once per app and kept on `app.state`; a `SessionDep`
yields a session per request. Tests pass a file in `tmp_path`, which also lets a test start a second app on the same
file to check restarts (players and games scenarios).

### D3. Acting player as a dependency
`CurrentPlayerDep = Annotated[Player, Depends(current_player)]` reads the `X-Player-Id` header as an optional string
and answers `401 {"detail": "Unknown player"}` for missing, non-numeric or unknown ids. Read as a string, not `int`,
so a bad value gives the spec's `401`, not FastAPI's `422`. `401` without `WWW-Authenticate` is a knowing shortcut:
there is no auth scheme to name.

### D4. Business errors as 422 with a fixed string detail
"Opponent not found" and "Cannot play against yourself" are `HTTPException(422, detail=<string>)`, while field
validation keeps FastAPI's list-shaped `detail`. The frontend maps the two known strings to Ukrainian text and shows
a generic `Не вдалося створити гру. Перевір поля.` otherwise. Request model: Pydantic `Field` limits
(`min_length`/`max_length` after a trimming validator, `ge`/`le` for reps).

### D5. Frontend: state machine in `App`, API clients per resource, plain CSS
`App` keeps `screen: "pick" | "games" | "new-game"` and `playerId`. The id is stored in `localStorage` under
`gym-challenge.player-id`; reads and writes are wrapped in `try/catch` (private mode). `src/api/players.ts` and
`src/api/games.ts` add the header; a `401` from a game call clears the stored id and returns to the picker.
The greeting and API status stay above the screen area, so `web-shell` scenarios are untouched.
Styles: one global `src/styles/tokens.css` (palette custom properties, DSEG7 `@font-face`, focus ring) and a CSS
Module per component (`*.module.css`, built into Vite, no dependency). Own components, no component library.
- *Alternative:* Tailwind CSS — rejected by the human (2026-10-03): a few screens, the palette is already a handful
  of custom properties, it would add a dependency and a Vite plugin (build config) a day before the deadline, and
  utility strings in JSX are harder to review. Can come later as its own change if screens multiply.

### D6. Docker: named volume for the database
`docker-compose.yml`: service `app` gets `DATABASE_URL=sqlite:////app/data/gym.db` and volume `gym-data:/app/data`.
`Dockerfile` runtime stage: `mkdir -p /app/data && chown app /app/data` before `USER app`, so a fresh named volume
inherits a writable directory.

### D7. Visual direction — **chosen: B «Табло»** (human, 2026-10-03)

The human compared the three options rendered with real fonts and colours (two phone screens each) and picked B.
Applied as: navy background, amber DSEG7 digits for every number (reps now; guesses and score next change),
system sans for all text, red only for errors. DSEG7 covers digits and a few symbols only, so it is never used for
words. Font from the `dseg` npm package (SIL OFL 1.1), only the `DSEG7-Classic` bold woff2 is imported.
A and C are kept below as the rejected alternatives.

Brief: two people at the end of a workout, phone in a sweaty hand, glancing between sets under harsh gym light.
Big tap targets (≥ 48 px), short Ukrainian copy, numbers large. Each option below is a palette, type, the one
memorable element, and the games-list wireframe. All three: single column, max width 28 rem, left-aligned text,
visible focus ring, `prefers-reduced-motion` respected.

**A. «Диски» — colours of competition weight plates (rejected).**
Each player owns a plate colour, the way 20 kg is blue and 25 kg red on every platform.
- Palette: concrete `#E7E8E4` (background), rubber `#232528` (text, primary button), plate blue `#1F4FBF` (Клієнт),
  plate red `#C8102E` (Тренер), plate yellow `#F2B705` (focus and the "Нова гра" action), steel `#8A8F96` (secondary).
- Type: Barlow Condensed 700 for headings and numbers, Barlow 400/600 for body — narrow, sporty, readable at a glance.
  Self-hosted via `@fontsource/barlow` and `@fontsource/barlow-condensed` (two new frontend dependencies).
- Memorable element: a round "plate" badge with the player's initial in their colour; a game row carries the
  opponent's plate. Everything else is flat and quiet.
```
 Welcome to Gym Challenge        ● Сервер працює
 Ти граєш як (К) Клієнт           [Змінити гравця]
 Мої ігри
 ┌───────────────────────────────────────────┐
 │ (Т)  Тренер                               │
 │      Присідання 10 +5 · фінал Віджимання 30│
 └───────────────────────────────────────────┘
 [██████████ Нова гра ██████████]
```

**B. «Табло» — the gym's LED scoreboard (chosen).**
- Palette: night navy `#0E1A2B`, LED amber `#FFB23F`, signal white `#F1F4F8`, steel `#5B6B80`, alert red `#E5484D`.
- Type: DSEG7 (seven-segment) only for numbers, system sans for text. Adds `dseg` font package.
- Memorable element: every number (reps now, guesses and score next change) looks like a lit scoreboard digit.
- Dark screen is easy on the eyes in a dim corner, harder to read in direct sunlight.
```
 ▓ Мої ігри ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
   ТРЕНЕР        Присідання   [1][0] +[5]
 [ НОВА ГРА ]
```

**C. «Крейда» — chalkboard by the squat rack (rejected).**
- Palette: graphite `#2E3234`, chalk white `#F4F4F0`, chalk blue `#8EC5E8` (Клієнт), chalk pink `#F4A6B6` (Тренер),
  chalk yellow `#F6E27A` (actions).
- Type: Caveat for headings and numbers (hand-written), Nunito for body. Two new font packages.
- Memorable element: hand-written numbers and a subtle chalk-dust texture. Riskiest for legibility.
```
 ~ Мої ігри ~
   проти Тренера — присідання 10 (+5)
 ( Нова гра )
```

Zero-dependency fallback for any option: system font stack instead of the named faces (loses most of the character).

## Risks / Trade-offs

- [Anyone can act as any player by setting `X-Player-Id`] → accepted by spec v1.3; isolated in one dependency
  (D3), so real sign-in later replaces one function.
- [Migrations at startup with several workers could race] → the app runs one `fastapi run` process; noted for later.
- [SQLite file in a named volume is lost by `docker compose down -v`] → documented in the Migration Plan.
- [Hand-written TS types drift from the API] → Vitest scenarios assert the exact request bodies; generated types
  are a follow-up (Non-Goals).
- [DSEG7 adds a package] → one ~5 KB woff2 imported; numbers fall back to `monospace` if it fails to load.
- [Dark screen is harder to read in direct sunlight] → contrast of text and amber on navy checked ≥ 4.5:1 in task 5.3.

## Migration Plan

First start on an empty volume runs migration `0001` and creates the two players. Rollback of this change: revert
the commits and drop the volume with `docker compose down -v` (no data worth keeping exists before this change).

## Implementation notes

What the code does beyond or differently from the decisions above, recorded during `/opsx:apply`:

- **D2.** `database_url` is a required keyword argument of `create_app`, with no default, so no test or caller can
  silently write `./gym.db`. The shared `client` test fixture now runs on a temp file (`open_client`). The red tests
  used a separate `api` fixture, which was folded into `client` after the red commit (rename only).
- **D4, stricter input.** Reps use Pydantic `strict=True`, so JSON `true` or `10.0` is a `422`, not silently `1`/`10`.
  `opponent_email` is capped at 254 characters (`422` above that). The spec says "whole numbers" and does not
  name these cases; they follow from it.
- **D5, extra 401 path.** A `401` on `POST /api/games` (the player vanished between load and submit) also clears the
  remembered player and returns to the picker, the same as the specified `401` on `GET /api/games`.
- **D5, players always loaded.** `GET /api/players` runs on every load, not only for the picker, to show
  `Ти граєш як <name>`. While it loads the name shows `…`.
- **D5, CSS.** `.field .reps` repeats the DSEG7 face and amber colour of the global `.digits` class, because
  `.field input` is more specific. Found in the Playwright check, where the numbers were white.
- **D6.** `.dockerignore` also skips `**/*.db`, so a local database never enters the image.
- **Task 5.3.** There is no screenshot of the empty list: the database already held games from the Docker check.
  The empty state is covered by the Vitest scenario "No games yet".
