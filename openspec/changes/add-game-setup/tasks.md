# Tasks

Approved by the human on 2026-10-03: visual direction B «Табло» (design.md, D7), the new dependencies, the Docker
changes (proposal.md, Impact) and hand-written TS types instead of generated ones (design.md, Non-Goals).

## 1. Red scenario tests

- [x] 1.1 Backend: one pytest test per `players` and `games` API scenario (`backend/tests/test_players.py`,
  `backend/tests/test_games.py`); `conftest.py` gains a `database_url` fixture on a file in `tmp_path` and passes it to
  `create_app`; restart scenarios start a second app on the same file; the `Гість` player is inserted with the stdlib
  `sqlite3` module so the red run does not depend on new packages. Run
  `docker compose --profile check run --rm backend-check pytest` and quote the failing lines
- [x] 1.2 Frontend: one Vitest test per UI scenario of `players` (picker, remember, change, 401) and `games`
  (list, empty, form success, two 422 texts, cancel) with a mocked `fetch` and jsdom `localStorage`. Run
  `docker compose --profile check run --rm frontend-check pnpm test` and quote the failing lines; existing
  `web-shell` tests still pass
- [x] 1.3 Commit the failing tests on their own (`test: red scenarios for players and games`)

## 2. Dependencies and storage

- [x] 2.1 Add `sqlmodel` and `alembic` with `uv add` in the `backend-check` container; verify `uv.lock` changed and
  `docker compose --profile check build backend-check` succeeds
- [x] 2.2 Add `dseg` with `pnpm add` in the `frontend-check` container; verify `pnpm-lock.yaml` changed and the
  image builds
- [x] 2.3 `app/db.py` (engine per app, SQLite `foreign_keys` pragma, `SessionDep`), `app/models.py` (`Player`,
  `Game`), `app/migrations/` with `0001` creating both tables and the two default players; `create_app` takes
  `database_url` and runs `upgrade head` in the lifespan; `DATABASE_URL` default `sqlite:///./gym.db`, `*.db`
  git-ignored. Verify the `players` "Fresh database" and "Restart keeps two players" tests pass

## 3. Players and games API

- [x] 3.1 `app/api/players.py`: `GET /api/players`, and `current_player` / `CurrentPlayerDep` reading `X-Player-Id`
  as a string (design D3). Verify all `players` API tests pass
- [x] 3.2 `app/api/games.py`: `POST /api/games` (request model with trimming and limits, opponent lookup by
  trimmed lower-cased email, the two `422` details) and `GET /api/games` (creator or opponent, id descending);
  routers included before the `/api` catch-all. Verify all `games` API tests and the existing `service-health`
  tests pass
- [x] 3.3 Commit the backend (`feat(api): players, X-Player-Id identity, create and list games on SQLite`)

## 4. Docker persistence

- [ ] 4.1 `docker-compose.yml`: `DATABASE_URL` and named volume `gym-data:/app/data` for `app`; `Dockerfile`
  runtime: `/app/data` owned by `app`. Verify: `docker compose up --build -d`, create a game with `curl`,
  `docker compose down` (without `-v`), `up -d` again, `GET /api/games` still lists it
- [ ] 4.2 Commit separately (`chore(docker): SQLite volume for the app service`)

## 5. Frontend screens and visual system

- [ ] 5.1 `src/api/players.ts`, `src/api/games.ts` (hand-written types, `X-Player-Id`, `401` → clear the stored
  player), `src/playerStore.ts` (`localStorage` key `gym-challenge.player-id`, `try/catch`). Verify the "remember",
  "change" and "401" tests pass
- [ ] 5.2 Screens `PlayerPicker`, `GameList`, `NewGameForm`, composed in `App.tsx` under the existing greeting and
  status (design D5). Verify all `players` and `games` UI tests and the `web-shell` tests pass
- [ ] 5.3 Visual system «Табло»: CSS custom properties for the palette, DSEG7 for numbers only, system sans for text,
  focus ring, ≥ 48 px tap targets, `prefers-reduced-motion`, contrast ≥ 4.5:1 on navy. Verify with Playwright MCP at
  390×844 on `docker compose up --build`: screenshots of picker, empty list, form with an error, list with a game
  (in `.playwright-mcp/`), no horizontal scroll, text readable
- [ ] 5.4 Commit the frontend (`feat(web): player picker, my games and new game form in the chosen visual style`)

## 6. Journal

- [ ] 6.1 Add rows to `docs/autonomy-log.md` for the red tests, backend, Docker and frontend steps, including any
  agent mistakes and human interventions; commit with `.agent-log/actions.jsonl`

## 7. Review and check

- [ ] 7.1 Run the change-reviewer subagent on a review packet and save its reply verbatim to
  docs/reviews/add-game-setup.md
- [ ] 7.2 Run the project check command and quote its summary line
