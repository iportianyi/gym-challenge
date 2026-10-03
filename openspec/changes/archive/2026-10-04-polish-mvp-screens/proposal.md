# Proposal

## Why

The MVP review of 2026-10-03 (`docs/autonomy-log.md` row 72) found three rough spots on the phone, and the human
decided to fix them before the real two-phone test: after `Почати гру` the creator lands on the list and needs one
more tap to make the first guess; the skeleton's English greeting and server status take the top of every screen;
the new-game form asks for the opponent's email but never says what it is.

## What Changes

- After a successful `Почати гру` the app opens the new game's screen at `/games/{id}` instead of `Мої ігри`.
- The page's level 1 heading becomes `Gym Challenge` (was `Welcome to Gym Challenge`).
- **BREAKING (UI)**: the server status (`Перевіряємо сервер…` / `Сервер працює` / `Сервер недоступний`) is removed
  from the page, and the page no longer requests `GET /api/health`. The endpoint itself stays (`service-health`).
- The new-game form shows a hint under `Email суперника` with the name and email of every other player, taken from
  `GET /api/players`. The field stays a typed email, as `docs/spec.md` («Обсяг MVP») says.

Frontend only: no backend, API, Docker or dependency changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-shell`: the greeting requirement gets the new heading text and loses its dependency on `/api/health`; the
  requirement "Start page shows whether the API is reachable" is removed.
- `games`: "The app creates a game from a form" opens the created game instead of the list; a new requirement adds
  the opponent email hint.

## Impact

- `frontend/src/App.tsx`, `App.module.css`, `api/health.ts` (deleted, no other user), `components/PlayerSession.tsx`,
  `components/NewGameForm.tsx` (+ its CSS).
- Tests: `frontend/src/App.test.tsx` (the four status tests go with the removed requirement), `Games.test.tsx`.
- `openspec/specs/web-shell/spec.md` Purpose mentions the status signal and is updated at archive.
