# Design

## Context

The frontend (`add-game-setup`) is one page: `App` (greeting, health status) → `PlayerSession`, which keeps the
chosen player in `localStorage` and switches `screen: "games" | "new-game"` with `useState`. API calls are
hand-written in `frontend/src/api/*.ts`; `Game` there still says `status: "active"` and has no score. Styles are CSS
modules on the «Табло» tokens in `styles/tokens.css` (navy, amber DSEG7 digits). Tests render `<App/>` against a
stubbed `fetch` (`Games.test.tsx`).

The API is complete (specs `rounds`, `scoring`): `GET /api/games/{id}` returns settings, `score`, `winner_id`,
`final_penalty`, `rounds` and `current_round`, hiding the other player's guess until both have guessed; both POSTs
answer `200` with the same body. The server already returns the start page for `/games/{id}` (`web-shell`).

Decisions taken by the human in explore (`docs/autonomy-log.md` rows 48 and 61): `react-router`; a separate round
result card; gender-neutral copy and the `Завершена` mark in the same list; polling only on an active game screen,
paused while hidden; the confirm step inside the card. Motivation and scope: proposal.md. Behaviour: specs
`game-screen`, `games`.

## Goals / Non-Goals

**Goals:**
- Every screen state is derived from one API answer by a pure function, so the two phones never disagree about
  what happens next and each state is unit-testable without rendering.
- No request races: one game request in flight at a time, and a move's answer always wins over an older poll.
- Existing tests keep passing unchanged, except the `GAME` fixture following the real API shape.

**Non-Goals:**
- Any backend change. Generated API types (still a follow-up from `add-game-setup`).
- Push or WebSocket updates; Telegram notifications (`docs/spec.md`, out of MVP).
- Undo, marking a penalty as done, leaving a game (`docs/spec.md`, MVP).
- Polling the list on a timer (human, explore #4).
- Offline support beyond keeping the last shown state.

## Decisions

### D1. `react-router` 8.4.0 in declarative mode, `BrowserRouter` inside `App`

`react-router` is the current line (v8; the old `react-router-dom` package is not needed). Checked with Context7 and
`npm view` on 2026-10-03: latest `8.4.0`, peers `react >=19.2.7` (we have `19.3.0`), engine `node >=22.22.0` (the
build image is `node:24-slim`). Pinned exactly, like the other packages.

Declarative mode (`<BrowserRouter>`, `<Routes>`, `<Route>`, `useParams`, `<Link>`, `<Navigate>`) only. Data mode's
loaders would load the game once per navigation, while this screen re-reads it every 3 s anyway, and the list
already loads in a component; framework mode changes the Vite build. Neither pays for itself here.

`<BrowserRouter>` goes inside `App` around `PlayerSession`, not in `main.tsx` as said in explore. Reason: the
existing tests render `<App/>` and must stay unchanged; with the router in `App` a test chooses the address by
`window.history.replaceState(null, "", "/games/1")` before `render`, which jsdom supports. `MemoryRouter` is not
needed.

*Alternatives:* manual `history.pushState` + `popstate` (the agent's advice in explore, rejected by the human);
`BrowserRouter` in `main.tsx` (every existing test would need a wrapper).

### D2. Routes live below the player gate

```
 App
  +-- BrowserRouter
       +-- PlayerSession
            |-- no player: PlayerPicker on any address (address is kept; after the pick the same route renders)
            +-- <Routes>
                  "/"           GamesPage   (fetches the list on mount and on visibilitychange -> visible)
                  "/games/new"  NewGameForm (onCreated / onCancel -> navigate("/"))
                  "/games/:id"  GameScreen
                  "*"           <Navigate to="/" replace />
```

The `Ти граєш як …` bar and `Змінити гравця` stay above the routes. `GamesPage` replaces the `screen` state and the
games state of `PlayerSession`; the list is reloaded on each mount, so after creating a game the list shows the new
game from the server rather than from a local `unshift`.

### D3. API client: list type, detail type and three calls

`frontend/src/api/games.ts` stays hand-written and mirrors `backend/app/api/games.py`:

```ts
type Points = { player_id: number; points: number };
type Penalty = { player_id: number; reps: number } | null;
type Game = { ...settings; status: "active" | "finished"; score: Points[]; winner_id: number | null };
type SettledRound = { number; guesses: { player_id; value: number }[]; actual: number; winner_id; penalty: Penalty };
type CurrentRound = { number; guesses: { player_id; guessed: boolean; value: number | null }[] };
type GameDetail = Game & { final_penalty: Penalty; rounds: SettledRound[]; current_round: CurrentRound | null };

fetchGame(playerId, id, signal): Promise<GameDetail | "not-found">        // 401 -> UnknownPlayerError
sendGuess / sendActual(playerId, id, value): Promise<GameDetail | "refused"> // 409/403 -> "refused"
```

Any other status or a network error throws a plain `Error`; the caller decides what to show.

### D4. One pure view function decides the screen

`viewGame(detail, me)` in `frontend/src/game/view.ts` returns everything the screen renders, already from the
viewer's side: `me`/`other` names and points, the round phase, the result card (or none), history items, and the end
of the game. The phase table:

```
 status    my entry   other's entry   I am creator   phase
 -------   --------   -------------   ------------   ----------------------
 finished  -          -               -              finished
 active    no         any             -              guess (+ "Здогадка суперника вже є" if other guessed)
 active    yes        no              -              wait-guess
 active    yes        yes             yes            enter-actual
 active    yes        yes             no             wait-actual
```

The card shows `rounds[last]` when `status = finished` or when no entry of `current_round.guesses` has `guessed`.
Penalty and winner wording (D7) is produced here too, so the card and the history use the same words. Components are
thin and only render this object; `viewGame` gets its own unit tests per phase, beside the scenario tests.

### D5. Polling: one timer chain, aborted by moves

A `useGame(playerId, id)` hook owns the game state:

- After each answer it schedules the next `GET` with `setTimeout(3000)`, not `setInterval`, so requests never
  overlap on a slow network.
- No timer while `document.visibilityState === "hidden"`; on `visibilitychange` to visible it fetches at once.
- No timer once the game is `finished` or `not-found`.
- A move (`send`) aborts the in-flight poll and clears the timer, applies the POST answer, then restarts the chain.
  On `"refused"` it fetches the game once (spec: refused move). This is why a stale poll cannot overwrite a move.
- A failed poll keeps the last game and sets `offline = true` (`Немає зв'язку, пробуємо ще`); the next success
  clears it. The chain continues every 3 s.
- `401` from any call → `onUnknownPlayer` (the existing `forgetPlayer`).

Tests drive it with `vi.useFakeTimers({ shouldAdvanceTime: true })` and set `document.visibilityState` through
`Object.defineProperty` plus a dispatched `visibilitychange` event.

### D6. Confirm step inside the card, one component for both numbers

`NumberEntry({ label, confirmText(value), onSend })` has two states: *edit* (the field, `Далі`) and *confirm*
(`confirmText`, `Надіслати`, `Змінити`). The check before confirming: the field's text must match `^\d+$` and be
≤ 500, otherwise `Введи ціле число від 0 до 500` (role `alert`) stays in *edit*. `Надіслати` is disabled while the
request is in flight; `Змінити` returns to *edit* with the value kept. `inputMode="numeric"` opens the digit keypad.
The guess uses `Твоя здогадка` / `Надіслати здогадку N? Змінити не вийде.`, the actual count uses
`Реальна кількість` / `Реальна кількість N? Це закриє раунд.`

*Alternative:* `<dialog>` with `showModal()` — rejected in explore: jsdom lacks it, the modal jumps with the on-screen
keyboard, and focus trapping is extra work.

### D7. Copy without gender and without declension

Ukrainian past tense and declension depend on gender and on the noun; the app knows neither the viewer's gender nor
how to decline a free-text exercise or a player's name. So the copy uses only possessives, nouns in the nominative
and "label: value" forms:

```
 me won round       Раунд твій                  other won round   Переможець раунду — Тренер
 draw               Нічия
 my penalty         Твоє покарання: Присідання × 10
 other's penalty    Покарання суперника: Присідання × 10
 game won by me     Твоя перемога               won by other      Переможець — Клієнт
 waiting            Чекаємо здогадку суперника · Здогадка суперника вже є
                    Чекаємо реальну кількість від суперника
```

In explore the agent offered «Перемога за Тренером»; while writing the specs it turned out to decline the name
(instrumental case), so the specs use «Переможець — Тренер». Flagged to the human with this proposal.

### D8. Look

The screen reuses the «Табло» tokens: the scoreboard is the biggest element (DSEG7 digits, `Ти` and the other name in
the label style of the list), the current round is one panel with the only primary button, the result card is a
panel with an amber edge, the history is a compact list. Mobile-first at 360–390 px wide, tap targets `--tap`.
Checked with Playwright on `localhost` with two browser contexts (one per player), screenshots in `.playwright-mcp/`.

### D9. Tests

- `frontend/src/GameScreen.test.tsx`: one test per `game-screen` scenario through `<App/>`, with an API stub that
  holds a game per id and answers `GET`/`POST` by a scripted list of answers; a `detail(...)` builder for game `1`.
- `frontend/src/Games.test.tsx`: the `GAME` fixture gains `score` and `winner_id` (the real list answer since
  `add-rounds-and-scoring`; without them the list cannot show the score); new tests for the two ADDED `games`
  requirements. No existing assertion changes.
- `frontend/src/game/view.test.ts`: the phase table of D4 and the wording of D7.

## Risks / Trade-offs

- [The opponent misses the result card when the creator guesses right after settling] → accepted in explore; the
  round stays as the first history item with the same words.
- [Polling 3 s × 2 phones] → two small requests every 3 s per open screen of an active game, none while hidden;
  negligible for a local two-player server.
- [Fake timers with `fetch` promises are flaky] → `shouldAdvanceTime: true` and `waitFor`; the polling hook is also
  covered with timers advanced explicitly by `vi.advanceTimersByTimeAsync`.
- [New dependency needs the network in Docker] → installing `react-router` runs `pnpm` in the `frontend-check`
  container, which resolves DNS only with the human's VPN on (CLAUDE.md); on a DNS failure the agent stops and asks.
- [The hand-written types drift from the backend] → same risk as before; the scenario tests use the exact JSON from
  the `rounds` spec.

## Migration Plan

Frontend only. Rollback: revert the commits of this change; the API and data are untouched.
