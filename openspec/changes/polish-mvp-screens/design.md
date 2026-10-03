# Design

## Context

See proposal.md — Why. Relevant current state:

- `App` checks `GET /api/health` on mount and shows the status under the `h1`; `api/health.ts` has no other user.
- `PlayerSession` already loads `GET /api/players` once (for the picker and `Ти граєш як …`) and renders the routes.
- `NewGameForm` calls `onCreated(game)` with the created game; `PlayerSession` ignores the game and navigates to `/`.
- Test stubs in `Games.test.tsx` and `GameScreen.test.tsx` answer `/api/health`; nothing asserts it there.

## Goals / Non-Goals

**Goals:** the three UI changes of the specs, with no new request to the server.

**Non-Goals:** a "your turn" mark in `Мої ігри` (finding 1 of the review, the human said not now); a tappable hint
that fills the field (the human asked for a hint; typing stays as in `docs/spec.md`); any backend change.

## Decisions

### D1. The hint reuses the players `PlayerSession` already has

`PlayerSession` passes the other players (`players.value` without `playerId`) to `NewGameForm` as a prop; an empty
list when the players are still loading or failed. Alternative: `NewGameForm` fetches `GET /api/players` itself —
a second identical request and a second loading state for the same data. Rejected.

The hint is a `<ul>` of `<li>` lines `<name>: <email>` under the field, with an id that the input references in
`aria-describedby`. No list when it is empty, so the form looks as today.

### D2. Open the created game with the id from the `201` answer

`onCreated={(game) => navigate(`/games/${game.id}`, { replace: true })}`: the game replaces the form in the
history, so Back goes to `Мої ігри`. Alternative: a plain push — Back would return to the form of a game that
already exists, inviting a duplicate. Rejected. The game screen then loads the game itself (`useGame`), as when opened from the list.

### D3. Remove the status and its client code, keep the endpoint

`App` loses the effect, `STATUS_TEXT`, the `<p role="status">` and its CSS (`.status*`); `api/health.ts` is deleted.
Backend `/api/health` and `test_service_health.py` stay unchanged (`service-health` spec). The test stubs keep their
`/api/health` branch out of scope — harmless, and removing it is churn in files this change does not otherwise need.

### D4. Tests that leave with the removed requirement

`App.test.tsx` has four tests for "Start page shows whether the API is reachable". The requirement is REMOVED by the
human's decision, so these tests are deleted in the red-tests commit, in the same commit as the new scenario tests,
and the commit message says why. This is not weakening a test to turn green: the behavior they assert is no longer
wanted. The two greeting tests change their text and their failing request (`/api/players` instead of `/api/health`).

## Risks / Trade-offs

- [Without the status a dead server is less visible on the first screen] → the picker already shows
  `Не вдалося завантажити гравців.`, the list `Не вдалося завантажити ігри.`, the game `Немає зв'язку, пробуємо ще`.
- [The hint shows emails on screen] → they are already shown on the picker (`players` spec); two default players.
