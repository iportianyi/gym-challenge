# Design

## Context

`add-game-setup` left a `game` table with the settings and `status = "active"`, players identified by `X-Player-Id`
(`CurrentPlayerDep`), SQLite through SQLModel and Alembic migrations run at startup (`app/db.py`). The game API lives
in `app/api/games.py` (`GamePublic`, `to_public`, `players_by_id`). Motivation and scope: proposal.md. Behaviour:
specs `rounds`, `scoring`, `games`.

Decisions taken by the human in explore (2026-10-03, `docs/autonomy-log.md` row 48) that shape this design:
two changes (backend now, game screen next); values 0–500; score in the game list; guesses shown as soon as both
have guessed, before the actual count (as `docs/spec.md` rule 1 says); every settled round in the API; penalties
visible to both; `409`/`403`/`404` for refused moves; "confirming" a guess is a UI dialog — the server has no drafts.

## Goals / Non-Goals

**Goals:**
- The rules live in one pure function that every response goes through, so the score cannot drift from the history.
- The server, not the UI, keeps the opponent's guess hidden.
- Double taps and two phones acting at the same time cannot create two guesses or settle a round twice.

**Non-Goals:**
- Any frontend change, including the hand-written TS type `Game.status: "active"` in `frontend/src/api/games.ts`
  (it does not break at runtime; `add-game-screen` updates the types when it first reads the new fields).
- Undo, editing a guess or the actual count, leaving a game, marking a penalty as done (`docs/spec.md`, MVP).
- Exposing timestamps in the API.
- More than two players (`docs/spec.md`, out of MVP). Two players are built into `game.creator_id`/`opponent_id`
  (since `add-game-setup`) and into `app/rules.py`; `round` and `guess` do not depend on the number of players.
  Going beyond two needs a `game_player` table with a data migration, rules for 3+ players decided by the human
  (who loses on equal distances, who gets a penalty), and a new response shape — a change of its own.

## Decisions

### D1. Store facts, compute the rest in `app/rules.py`

The database holds only guesses and actual counts. `app/rules.py` (no SQLModel, no FastAPI) exposes:

```python
WINNING_SCORE = 5

@dataclass(frozen=True) class Settings:   base_reps: int; step_reps: int; final_reps: int
@dataclass(frozen=True) class Played:     guesses: Mapping[int, int]; actual: int   # player_id -> guess
@dataclass(frozen=True) class Penalty:    player_id: int; reps: int
@dataclass(frozen=True) class Outcome:    winner_id: int | None; penalty: Penalty | None
@dataclass(frozen=True) class Standing:
    outcomes: tuple[Outcome, ...]; points: dict[int, int]; winner_id: int | None; final_penalty: Penalty | None

def settle(players: tuple[int, int], rounds: Sequence[Played], settings: Settings) -> Standing
```

It speaks player ids, like the API (D4), so the endpoint passes results through without translating. `players` is
`(creator_id, opponent_id)`; a round whose `guesses` do not cover exactly these two is a programming error
(`ValueError`). It walks the rounds once, keeping a loss streak per player: the loser's streak grows, the winner's
ends, a draw ends both. The round that brings a player to `WINNING_SCORE` gets no penalty and sets `winner_id` and
`final_penalty`; a round after that is also a `ValueError`.

*Alternative:* `score`/`streak` columns updated on every actual count. Rejected: two sources of truth that a bug can
split, and the rules would be tested only through the database. A game has at most 9 rounds, so recomputing costs
nothing.

The only stored derived value is `game.status`: the actual-count endpoint sets it to `finished` in the same
transaction when `settle(...).winner_id` is not `None`, so list queries and the "game is finished" check do not need
the rounds. Score and winner in responses still come from `settle`.

### D2. Tables: `round` and `guess`, current round always exists

Migration `0002_rounds_and_guesses`:

- `round(id, game_id → game.id, number, actual NULL, settled_at NULL)`, `UNIQUE(game_id, number)`.
- `guess(id, round_id → round.id, player_id → player.id, value, created_at)`, `UNIQUE(round_id, player_id)`.
- Data step: one `round(number = 1)` for every `game` with `status = 'active'` (games created before this change).

`POST /api/games` inserts round 1 together with the game; the actual-count endpoint inserts round `n + 1` in the
same transaction that settles round `n`, unless the game finished. So an active game always has exactly one round
with `actual IS NULL` — the current round — and no request ever has to create it on demand.

*Alternative:* create a round on the first guess. Rejected: two first guesses at the same moment would both try to
create it, needing retry logic for a case that the eager approach does not have.

`settled_at` is not in the API; it is kept because the gym's load over time is a listed next step (`docs/spec.md`).

### D3. Concurrency is the database's job

- Guess: insert and commit; `IntegrityError` on `UNIQUE(round_id, player_id)` → rollback → `409 Already guessed`.
  The endpoint also checks before inserting, so the common case does not rely on the exception.
- Actual count: `UPDATE round SET actual = :v, settled_at = now WHERE id = :current AND actual IS NULL`; if no row
  changed, another request settled it first → `409` from re-reading the state (normally `Waiting for guesses` for the
  new round). The double-tapped second request therefore never settles the next round.

### D4. Per-player values are lists of entries with `player_id` (human's choice)

Every per-player value is a list with one entry per player, the creator first; references to one player are a
`player_id` field. Names are not repeated: they are in the game's `creator` and `opponent` objects.

```
  score              [{"player_id": 1, "points": 1}, {"player_id": 2, "points": 0}]
  winner_id          1 | null                          (round and game)
  penalty            {"player_id": 2, "reps": 10} | null   (also final_penalty)
  settled guesses    [{"player_id": 1, "value": 40}, {"player_id": 2, "value": 55}]
  current guesses    [{"player_id": 1, "guessed": true, "value": 40},
                      {"player_id": 2, "guessed": false, "value": null}]
```

The screen finds "my" entry with `find(e => e.player_id === me)`. "Creator first" is fixed so tests can compare
whole lists and the order never depends on who asks.

*Considered* (in the conversation, 2026-10-03, `docs/autonomy-log.md` row 50): (a) keys by role
`{"creator": …, "opponent": …}` — the agent's first draft, rejected by the human; (b) player ids as object keys —
JSON keys become strings while `winner` stays a number; (c) viewer-relative `me`/`opponent` — the same game looks
different on the two phones and every scenario needs testing from both sides; (d) embedded player objects
`{"player": {"id", "name"}, …}` — self-contained but repeats names in every round. Lists with `player_id` also do
not tie the response shape to two players (see Non-Goals).

### D5. Hiding is done when building the response

One view builder takes the game, its rounds, its guesses and the acting player. For the current round it fills an
entry's `value` only if the entry is the acting player's or both players have guessed; otherwise `null`. `guessed`
is always true/false for both. Settled rounds are always shown in full. There is no other path that
returns guesses, so a test per scenario covers the leak.

Accepted risk (human, explore #5): once both guesses are shown, the creator could enter an actual count that suits
them. The game is played between two people who trust each other; the actual count comes from the gym's app and the
other player can check it.

### D6. Status codes and their order

FastAPI validates the body first: an invalid `value` is `422` before anything else (and with a missing header the
dependency answers `401`). Then, in the handler:

```
  game missing or caller not a player ......... 404 Game not found
  actual by the opponent ...................... 403 Only the creator enters the actual count
  status = finished ........................... 409 Game is finished
  guess: caller already guessed ............... 409 Already guessed
  actual: not both guessed .................... 409 Waiting for guesses
```

Values are `Annotated[int, Field(strict=True, ge=0, le=500)]`, the same strict style as `Reps` in `games.py`, so
`"40"` and `40.5` are refused. Booleans are refused by strict mode too.

### D7. Both POSTs answer `200` with the game

A guess has no URL of its own and the screen needs the new state right away, so both moves answer `200` with the
same body as `GET /api/games/{id}` for the acting player — one request instead of two. `GamePublic` (create, list)
gains `score` and `winner_id`; `GameDetail` extends it with `final_penalty`, `rounds` and `current_round`. The list
endpoint loads rounds and guesses of all listed games in two queries (`IN (...)`), not per game.

### D8. Tests

- `tests/test_rules.py` — one test per `scoring` scenario, calling `settle` directly; plus the "Full game through the
  API" scenario in `tests/test_rounds.py`.
- `tests/test_rounds.py` — one test per `rounds` scenario through `TestClient`; a `play(client, game_id, creator,
  opponent, actual)` helper; `Гість` inserted with stdlib `sqlite3` as in `test_games.py`; the restart scenario uses
  `open_client` twice on the same file.
- `tests/test_games.py` — the exact-JSON assertion of "Клієнт starts a game against Тренер" gains `score` and
  `winner_id`, following the MODIFIED scenario (the check stays an exact equality); a new test for "Score after one
  round".

## Risks / Trade-offs

- [Response shape change breaks a client] → only our frontend calls the API and it ignores unknown fields; Vitest
  stays green in `make check`.
- [`status` column and `settle` disagree] → only the actual-count endpoint writes `status`, from `settle`, in the
  same transaction; the "Fifth point ends the game" and full-game tests check both `status` and `winner_id`.
- [Creator fits the actual count to the guesses] → accepted by the human (D5).
- [Migration on a database that already has games] → `0002` opens round 1 for active games; a pytest test upgrades
  a database stopped at `0001` that holds a game and plays a guess in it, and `docker compose up --build` on the
  existing `gym-data` volume shows the old games with `current_round.number = 1`.

## Migration Plan

Alembic `0002` runs at startup like `0001`. Rollback: `alembic downgrade 0001` drops `guess` and `round` (rounds are
lost, games stay), then deploy the previous image.

## Implementation notes

- **D3, conditional `UPDATE` refreshes the session.** `session.exec(update(Round)...)` synchronises the `Round`
  objects already loaded in the session, so after it the current round already has `actual`. The first version
  built the list of played rounds after the `UPDATE` and then appended the current round again: it was counted
  twice and a game ended at 4 wins. The API tests "Full game through the API" and "… after the end" caught it before
  the commit; the list is now taken before the `UPDATE` (comment in `enter_actual`).
- **Round 1 on create** needs the game id, so `create_game` flushes the game before adding the round; both are in
  one commit.
- **Tests beyond the scenarios:** two guards of `settle` (a round after the win, guesses from other players) and two
  migration tests (a database stopped at `0001` with a game becomes playable; `downgrade 0001` → `upgrade head`).
- **Red run:** `test_rules.py` fails at collection (`No module named 'app.rules'`), which stops pytest; the red run
  was repeated with `--continue-on-collection-errors` to show every failing test.
- **Real volume (task 5.1):** the human's `app` container was already running; `up --build` recreated it and
  `down` stopped it. The volume and its games are intact (`docs/autonomy-log.md` row 54).
