# Proposal

## Why

Finding 2 of the UX audit (`docs/ux-audit-2026-10-20.md`, P1): a player who opens an invite link becomes the
opponent at once and lands in `Раунд 1`. Nowhere are they told who invited them or what they agree to — the exercise,
the reps for a lost round, the step for a losing streak and the reps for a lost game. The penalty is the point of the
game, so the invited player should see it before they are in. The game is now hosted (`deploy-fly`), so real
invitations go to people who have never seen the app.

## What Changes

- **Preview an invite.** New `POST /api/invites/preview` with `{"token": <token>}`: any valid Telegram login, even
  without a player yet, gets the organizer's name and the game's settings, without joining. The token stays in the
  body, as for `/api/games/join`, so it is never in a URL or an access log. An unknown token answers `404`, a link
  another player has used `409`, with the same details as join.
- **Accept before joining.** Launched from an invite, the web app shows the invite screen first — heading
  `Гра: <exercise>`, `<organizer> кличе тебе в гру`, the round penalty, the step (when not 0), the final penalty and
  `Гра — до 5 балів` — with the buttons `Відмовитись` (left) and `Прийняти` (right). `POST /api/games/join` is sent only after
  `Прийняти`. **BREAKING** for the accepted requirement "The web app joins the game it was launched with", which
  joined at once.
- **New player.** The invite screen comes before the name form: `Прийняти` → `Як тебе звати?` → `Почати` → join →
  the game.
- **Declining.** `Відмовитись` only leaves the invite: it goes to `Мої ігри` (to the name form first for a new
  player), nothing is sent to the server, the game keeps waiting and the link stays valid. The organizer is not told;
  a decline the organizer sees (a new game state, the link used up) is left to a later change, if needed, as the
  human decided.
- **Opening one's own or an already joined game.** When the viewer is the organizer or already the opponent, the app
  goes to the game as today, with no invite screen.
- Settings appear only on the invite screen; the game screen is unchanged (the human's choice).
- No database change: the preview reads the existing game.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `invites`: a new requirement for the preview endpoint, a new requirement for the invite screen, and the modified
  "The web app joins the game it was launched with" (join after `Прийняти`, not at once).

## Impact

- Backend: `backend/app/api/` (new router or route for `/api/invites/preview`, registered before the `/api` fallback),
  tests in `backend/tests/test_invites.py`.
- Frontend: `frontend/src/components/PlayerSession.tsx` (launch flow), a new invite component, `frontend/src/api/`
  (preview client), tests in `frontend/src/Invites.test.tsx`.
- No database migration, no dependency, no harness change. After the change, `fly deploy` (asked first, per
  `CLAUDE.md`) and a check on the phone with a second Telegram account.
