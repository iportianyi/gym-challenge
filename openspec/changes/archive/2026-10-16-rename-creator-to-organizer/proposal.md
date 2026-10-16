# Proposal

## Why

Spec v2.0 (`docs/spec.md`) names the player who created a game the **organizer** («організатор») and notes that code
and API still say `creator`. The human chose to rename it in a separate change right after `telegram-auth`
(decision 4 there), before invitations add more code and API around the organizer.

## What Changes

- **BREAKING (API)**: the game object's field `creator` becomes `organizer` in every game response
  (`POST /api/games`, `GET /api/games`, `GET /api/games/{id}`, the move endpoints). The value is unchanged:
  `{"id", "name"}` of the player who created the game.
- **BREAKING (API)**: the `403` detail for the opponent entering the actual count becomes
  `{"detail": "Only the organizer enters the actual count"}`.
- Database: migration `0004` renames `game.creator_id` to `game.organizer_id`; data is kept.
- Code: identifiers, comments and the hand-written TS types use `organizer`; the frontend reads `game.organizer`.
- Specs: every requirement and scenario says "organizer" instead of "creator"; behaviour is otherwise unchanged.
  Requirements whose own name or scenario names contain "creator" are replaced under new names (OpenSpec cannot
  rename a scenario inside a modified requirement).
- `docs/spec.md` drops the note that the code still says `creator` (v2.3).

No UI copy changes: the screens never showed the role's name.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `games`: the create/list responses carry `organizer`; "Creator starts a game against a chosen player" becomes
  "Organizer starts a game against a chosen player".
- `rounds`: the game detail carries `organizer`, per-player lists are "organizer first", the actual count is entered
  by the organizer with the new `403` detail.
- `scoring`: scenario wording ("player `1` (organizer)").
- `game-screen`: scenario fixtures and wording use the organizer; requirements with "creator" in a name or scenario
  name are replaced under new names, same behaviour.

## Impact

- Backend: `app/models.py` (`Game.organizer_id`), `app/api/games.py`, `app/rules.py` (comment), migration
  `0004_rename_creator_to_organizer.py`; tests `test_games.py`, `test_rounds.py`, `test_rules.py`. Tests that build
  databases at revisions `0001`/`0002` keep inserting `creator_id`, the column name of those revisions.
- Frontend: `src/api/games.ts` (`Game.organizer`), `src/game/view.ts`, `src/components/GameList.tsx`; tests
  `view.test.ts`, `Games.test.tsx`, `GameScreen.test.tsx`.
- Docs: `docs/spec.md`; `openspec/specs/rounds/spec.md` Purpose mentions the creator and is edited directly.
- The local database of the human (`gym-data` volume) is migrated in place; no data loss.
- No new dependencies, no Docker or harness changes.
