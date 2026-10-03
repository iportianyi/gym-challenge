# Tasks

Scope agreed with the human in explore on 2026-10-03 (`docs/autonomy-log.md` row 48): backend only, no new
dependencies, no Docker or frontend changes.

## 1. Red scenario tests

- [x] 1.1 `backend/tests/test_rules.py`: one test per `scoring` scenario calling `app.rules.settle` (design D1;
  import inside each test or at module level — the red run fails with `ModuleNotFoundError: app.rules`)
- [x] 1.2 `backend/tests/test_rounds.py`: one test per `rounds` scenario and the `scoring` "Full game through the API"
  scenario through `TestClient`, with a `play(...)` helper (design D8); plus one migration test: a database upgraded
  only to `0001` with a game inserted by stdlib `sqlite3`, then the app starts on it and `GET /api/games/1` shows
  `current_round.number` `1` and a guess is accepted
- [x] 1.3 `backend/tests/test_games.py`: update the exact JSON of "Клієнт starts a game against Тренер" to the
  MODIFIED scenario (adds `score` and `winner_id`, still an exact equality) and add "Score after one round"
- [x] 1.4 Run `docker compose --profile check run --rm backend-check pytest` and quote the failing lines; all
  previously passing tests other than the updated create scenario still pass
- [x] 1.5 Commit the failing tests on their own (`test: red scenarios for rounds, scoring and game score`)

## 2. Rules module

- [ ] 2.1 `backend/app/rules.py`: `Settings`, `Played`, `Penalty`, `Outcome`, `Standing`, `settle` (design D1),
  no imports from `sqlmodel`, `fastapi` or `app.*`. Verify every test in `tests/test_rules.py` passes and
  `grep -E "sqlmodel|fastapi|from app" backend/app/rules.py` prints nothing
- [ ] 2.2 Commit (`feat(rules): settle rounds into score, streak penalties and game end`)

## 3. Storage

- [ ] 3.1 `backend/app/models.py`: `Round` and `Guess` with the unique constraints of design D2; migration
  `0002_rounds_and_guesses.py` creating both tables and round 1 for every active game, with `downgrade`.
  Verify the migration test from 1.2 passes and `alembic downgrade 0001` followed by `upgrade head` works on a test
  database (run inside the test or by hand in `backend-check`, quote the output)

## 4. API

- [ ] 4.1 `backend/app/api/games.py`: `POST /api/games` also inserts round 1; `GamePublic` gains `score` and
  `winner_id` (from `settle`), list loads rounds and guesses of all listed games in two queries (design D7). Verify the
  `games` tests pass
- [ ] 4.2 `GET /api/games/{id}`, `POST /api/games/{id}/guesses`, `POST /api/games/{id}/actual` with the view builder
  of design D5, the status codes and order of design D6, the `IntegrityError` and conditional `UPDATE` of design D3,
  and `game.status = "finished"` written in the settling transaction. Verify every test in `tests/test_rounds.py`
  passes, and ruff and ty are clean
- [ ] 4.3 Commit (`feat(api): game detail, guesses and actual count with hidden guesses and scoring`)

## 5. Run on the real volume

- [ ] 5.1 `docker compose up --build -d` on the existing `gym-data` volume (the migration upgrades it in place, no
  `down -v`); `curl` with `X-Player-Id: 1`: an old game shows `current_round.number` `1`; play one round on a new
  game with `curl` (two guesses, actual) and quote the `rounds` of the answer; `docker compose down` (without `-v`)

## 6. Journal

- [ ] 6.1 Add rows to `docs/autonomy-log.md` for the red tests, rules, storage, API and the Docker run, including any
  agent mistakes and human interventions; commit with `.agent-log/actions.jsonl`

## 7. Review and check

- [ ] 7.1 Run the change-reviewer subagent on a review packet and save its reply verbatim to
  docs/reviews/add-rounds-and-scoring.md
- [ ] 7.2 Run the project check command and quote its summary line
