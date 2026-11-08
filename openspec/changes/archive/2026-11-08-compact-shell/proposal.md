# Proposal

## Why

Findings 13–15 of the UX audit (`docs/ux-audit-2026-10-20.md`, P3), which the human chose to do next (2026-11-08):

- **13.** Above every screen stand two lines, `Gym Challenge` and `Ти граєш як <name>`, with a gap between them and
  the screen: on a phone the game starts a good way down.
- **14.** `Нова гра` comes after the list of games, so with many games it is far below the fold.
- **15.** The page has no icon, so every browser asks for `/favicon.ico` and gets `404` (seen in the console of every
  Playwright check).

## What Changes

- **One header line** (the human's choice among three layouts): `Gym Challenge` on the left and the player's name on
  the right, small, on one line on every screen. A screen reader still hears `Ти граєш як <name>`; the words
  `Ти граєш як` are no longer shown. Before the player is known (name form, invite screen, messages) the line has the
  heading only. A long name is cut with `…` instead of wrapping.
- **`Нова гра` first.** On `Мої ігри` the button stands right under the heading, before the list (or before
  `Ще немає ігор. Почни першу.`).
- **An icon.** `index.html` links an SVG icon `/favicon.svg` (amber on the app's navy), so no request for
  `/favicon.ico` is made and the console has no `404` for it.
- No backend, database or dependency change; no harness change.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `web-shell`: "Start page greets the player" becomes the one-line header with the player's name; a new requirement
  for the page icon.
- `players`: "The first login asks for the player's name" and "A known player goes straight to their games" show the
  name in the header instead of the visible text `Ти граєш як <name>`.
- `games`: "The app lists my games" puts `Нова гра` before the list.

## Impact

- Frontend: `frontend/src/App.tsx` and `App.module.css` (the header moves into the session), `PlayerSession.tsx` and
  its CSS, `GameList.tsx`, `frontend/index.html`, new `frontend/public/favicon.svg`, a visually-hidden helper in the
  global styles; tests in `App.test.tsx`, `Login.test.tsx`, `Games.test.tsx`, `indexHtml.test.ts`.
- After the change, `fly deploy` (asked first, per `CLAUDE.md`).
