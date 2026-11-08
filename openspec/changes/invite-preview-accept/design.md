# Design

## Context

`POST /api/games/join` (game-invites D4) finds the game by `invite_token`, needs a registered player
(`CurrentPlayerDep`, 403 otherwise) and joins at once. `auth.py` also has `TelegramUserDep`, which needs only a valid
`initData`. In the web app, `PlayerSession` reads `startParam` from the launch, waits for `GET /api/me` (or the name
form) and then joins through a `"joining"` session state; failures go to `"join-failed"` with one of three messages.
`telegram.ts` keeps `initData` for reloads but drops `startParam`, so a reload never joins again (game-invites D7).
See proposal.md (Why) and the audit finding 2.

## Goals / Non-Goals

**Goals:**
- The invited player sees who invites and the penalties before anything changes on the server.
- The rule of who may join stays in one place: `/api/games/join`. The preview only reads.

**Non-Goals:**
- A decline the server knows of (a new game state, the organizer told, the link used up): `Відмовитись` only leaves
  the screen. A server-side decline would let one person in a group chat kill the link for everyone, and needs its
  own design with the game's life cycle (rematch, finding 7).
- Expiring links, showing the settings on the game screen (the human
  chose the invite screen only), changes to the waiting game's screen.

## Decisions

### D1. `POST /api/invites/preview`, token in the body

A new route in `backend/app/api/invites.py`, included before the `/api` fallback in `main.py`. It depends on
`TelegramUserDep` and `SessionDep`, not `CurrentPlayerDep`: a new player must see the invite before choosing a name.
`role` is computed from the viewer's player, looked up through `TelegramAccount` if there is one:
organizer id → `"organizer"`, opponent id → `"opponent"`, otherwise `"invited"` while `opponent_id` is null and `409`
once it is set. The body is a Pydantic model with `organizer` (`PlayerPublic`), the three reps, `exercise` and `role`.

Alternatives: `GET /api/invites/{token}` — more RESTful, but the token, a one-time capability, would land in Fly's
access logs and browser history; join already takes it in the body. Adding a `preview` flag to `/api/games/join` —
one route doing two things, and join needs a player while preview must not.

### D2. Launch flow in `PlayerSession`

The session states become: `loading` → (`register` | known player) and, with a `startParam`, `previewing` →
`invited` (invite screen) | join at once (role organizer/opponent) | `join-failed`. The preview starts in parallel with
`GET /api/me`, since it does not need a player. `Прийняти` on the invite screen goes to `joining` when the player is
known, or to `register` with a remembered "accept" so that `onRegistered` continues to `joining`. `Відмовитись` on the
invite screen sets the session to `ready` (or `register` for a new player, as any first visit, without the
remembered "accept") and navigates to `/`; it sends nothing.
Reloads stay as they are: no `startParam`, no preview.

The invite screen is its own component (`InviteScreen.tsx`); `Відмовитись` and `Прийняти` sit in one row, the
forward action on the right like the confirm step of the number entry (number-entry-thumb-reach D2); its words are built in a small pure function beside it
(`inviteLines`, tested without rendering), like `viewGame` for the game screen.

### D3. Words on the invite screen

`Гра: <exercise>` as the heading (the same as the game screen), `<organizer> кличе тебе в гру` (no grammatical gender,
add-game-screen D7), then the penalty lines with no-break spaces around `×` (as clarify-round-and-result D4),
`+<step> за кожну поразку поспіль` only for a step above `0`, `Гра — до 5 балів` with a no-break space before the
dash. `5` is the backend's `WINNING_SCORE` (`backend/app/rules.py`), kept as a named constant with a pointer, as
`EXACT_MULTIPLIER` is.

### D4. Tests

Backend: one pytest per preview scenario in `test_invites.py`, using the existing `invite`, `join`, `as_player` and
`login` (a Telegram user with no player) helpers. Frontend: `Invites.test.tsx` gets a stub for
`POST /api/invites/preview` and one test per web-app scenario; the modified scenarios are rewritten in place with
their old data. After the code, a check on the hosted app with two Telegram accounts.

## Risks / Trade-offs

- [The preview tells anyone with the link who organized the game] → the link is already a secret shared by the
  organizer; the preview shows nothing the joined opponent would not see.
- [Two requests before the screen for a new player] → `GET /api/me` and the preview run in parallel.
- [A player accepts after someone else did] → join answers `409` as today and the same message is shown (scenario
  "Someone else accepted first").
- [`5` duplicated in the frontend] → named constant with a pointer to `rules.py`; the test with `Гра — до 5 балів`
  and the pytest rule tests fail together if it changes.

## Migration Plan

No database change. Deploy with `fly deploy --remote-only --app gym-challenge` after `make check`, asking first
(`CLAUDE.md`), then `node scripts/hosting-check.mjs` and the human's check with a second Telegram account.
