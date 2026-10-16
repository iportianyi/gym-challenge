# Design

## Context

The role is stored as `game.creator_id` (migration `0001`), exposed as `creator` in `GamePublic` and `GameDetail`
(`backend/app/api/games.py`), and read as `game.creator` by the frontend (`src/api/games.ts`, `src/game/view.ts`,
`src/components/GameList.tsx`). The `403` detail for the opponent is "Only the creator enters the actual count".
Backend and frontend ship in one image (FastAPI serves the built frontend), so they always change together.

## Goals / Non-Goals

**Goals:** one word, `organizer`, in specs, API, database and code; existing games keep working.

**Non-Goals:** any behaviour change; UI copy (no screen names the role); invitations (next change).

## Decisions

### D1. Migration `0004` renames the column in place

`op.batch_alter_table("game")` with `alter_column("creator_id", new_column_name="organizer_id")`. Batch mode
recreates the table on SQLite, keeping rows, the foreign key to `player.id` and the `NOT NULL`. Downgrade renames it
back. Data survives both ways, which a test asserts.

Alternative: keep the column name and map it in SQLModel (`sa_column=Column("creator_id", …)`). Rejected: the
database would keep the old word, and the next reader of a SQL query would meet both names.

### D2. History stays as it was

Migrations `0001`–`0003` and the tests that build databases at those revisions (`test_migrations.py`, the upgrade
scenario in `test_players.py`) keep `creator_id`: that is the column's name at those revisions. Archived changes and
past reviews are not edited.

### D3. No compatibility alias in the API

The response carries only `organizer`, not both fields. The only client is this frontend, released in the same
image; a duplicate field would have to be removed later anyway.

### D4. Spec deltas: modified where possible, replaced where a name says "creator"

OpenSpec keeps scenario names of a modified requirement and checks them on archive, so a requirement whose name or
scenario name contains "creator" is REMOVED and ADDED under a new name with the same text in the organizer's words
(two game-screen requirements get slightly different names: "The score is shown from the viewer's side", "The round
tells each player who acts next"). The rest are MODIFIED. The `rounds` Purpose mentions the creator and is edited in
the main spec directly, as done for `players` in `telegram-auth`.

## Risks / Trade-offs

- [A tab open across the upgrade] An old page reading `game.creator` gets `undefined` after the server is updated.
  → Reloading the Mini App loads the new frontend; there is one human user and no hosting yet.
- [Missed occurrence] A leftover `creator` in code compiles but reads `undefined`. → `tsc` catches the TS type, the
  scenario tests compare whole response bodies, and a final `grep -ri creator` over `backend/app` and
  `frontend/src` (excluding migrations `0001`–`0003`) must be empty.

## Migration Plan

`docker compose up --build` runs `0004` on the existing volume; games, rounds and players are kept. Rollback: the
previous image with `alembic downgrade 0003` (renames the column back).
