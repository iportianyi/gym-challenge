# Tasks

## 1. Failing scenario tests

- [x] 1.1 Backend: in `test_games.py`, `test_rounds.py` and `test_rules.py` change the expected bodies and texts to
  `organizer` and "Only the organizer enters the actual count", rename tests and section comments after the new
  requirement and scenario names; in `test_migrations.py` add a test that `0004` keeps a game and its rounds while
  renaming the column (and back on downgrade); leave inserts at revisions `0001`/`0002` with `creator_id` (design
  D2); run pytest through `docker compose --profile check run --rm backend-check pytest` and quote the failing lines
- [x] 1.2 Frontend: in `view.test.ts`, `Games.test.tsx` and `GameScreen.test.tsx` use `organizer` in the game
  fixtures and the new requirement and scenario names; run Vitest through `frontend-check` and quote the failing lines

## 2. Backend

- [x] 2.1 Migration `0004_rename_creator_to_organizer.py` (design D1) and `Game.organizer_id` in `app/models.py`;
  verify the migration tests pass
- [x] 2.2 `app/api/games.py` (`organizer` field, `organizer_id`, the `403` detail) and the comment in `app/rules.py`;
  verify all backend tests pass and `ruff`, `ty` are clean

## 3. Frontend

- [x] 3.1 `Game.organizer` in `src/api/games.ts`, `src/game/view.ts`, `src/components/GameList.tsx`; verify the
  Vitest scenarios pass and `tsc`, ESLint are clean
- [x] 3.2 Verify `grep -rni creator backend/app frontend/src` prints only the migrations `0001`–`0003` and `0004`
  itself; run `docker compose up --build` on the existing volume and check with a dev link that a game created before
  the upgrade still opens and shows its rounds

## 4. Docs

- [x] 4.1 `docs/spec.md`: drop "у коді й API поле поки `creator`", bump to v2.3; edit the `rounds` Purpose in
  `openspec/specs/rounds/spec.md` to say organizer; commit as `docs(spec)`; verify with `git show --stat HEAD`

## 5. Review and check

- [ ] 5.1 Run the change-reviewer subagent on a review packet and save its reply verbatim to
  `docs/reviews/rename-creator-to-organizer.md`
- [ ] 5.2 Run the project check command (`make check`) and quote its summary line
