# Design

## Context

`App.tsx` renders `<main>` with `<header><h1>Gym Challenge</h1></header>` and, below it, `PlayerSession`, which knows
the player and renders `<p class="me">Ти граєш як {name}</p>` above its routes (only in the `ready` state). The header
is already a flex row (`App.module.css`, `justify-content: space-between`) holding only the heading, so the name sits
on a second line, with the page's `1.5rem` gap and the session's `1.25rem` gap in between. `GameList` renders heading,
list (or the empty note), then `Нова гра`. `index.html` has no icon link; `frontend/public/` does not exist yet
(Vite copies it into the build root, which `app.frontend()` serves as built files).

## Goals / Non-Goals

**Goals:**
- One header line with heading and name; screen readers still hear `Ти граєш як <name>`.
- `Нова гра` right under `Мої ігри`.
- An SVG icon, no `/favicon.ico` request.

**Non-Goals:**
- Hiding the header on some screens, a sticky or floating `Нова гра`, a PNG/ICO icon set or a web manifest.
- Telegram theme and safe-area insets (finding 12, a separate change).
- Any change to the name form, the invite screen or the game screen beyond the header above them.

## Decisions

### D1. The session renders the header

`PlayerSession` is the only place that knows the player, so it renders the whole header: a small `AppHeader`
component (`frontend/src/components/AppHeader.tsx`) with an optional `name`. `App.tsx` keeps `<main>` and the router
and no longer renders a header. `PlayerSession` renders `<AppHeader />` in every state (outside Telegram, loading,
name form, invite, messages) and `<AppHeader name={player.name} />` in `ready`. The `<p class="me">` goes.

Alternatives: keep the header in `App` and lift the player into `App` state through a callback (two components own
one line), or a React portal into the header (indirect, hard to read). Rendering the header next to the data is the
plainest.

### D2. Name markup and the one line

```tsx
<header className={styles.header}>
  <h1 className={styles.title}>Gym Challenge</h1>
  {name !== undefined && (
    <p className={styles.me}>
      <span className="visually-hidden">Ти граєш як </span>
      {name}
    </p>
  )}
</header>
```

The header row gets `flex-wrap: nowrap`; the heading `flex: none`; the name `min-width: 0`, `overflow: hidden`,
`text-overflow: ellipsis`, `white-space: nowrap`, muted colour and the heading's small size. A global
`.visually-hidden` class (the usual clip pattern: 1 px, `clip-path: inset(50%)`, `position: absolute`,
`white-space: nowrap`) goes into the global stylesheet; nothing like it exists yet. Text content of the header is then
`Gym ChallengeТи граєш як Клієнт`, which the spec asserts. The page gap stays `1.5rem`; the two-line block it used to
separate is now one line, which is the saving.

### D3. `Нова гра` first

`GameList` moves the button between the heading and the list/empty note. Same button, same handler.

### D4. The icon

`frontend/public/favicon.svg`: a 64×64 viewBox, rounded square in `--navy` (`#0e1a2b`) with the scoreboard amber
(`#ffb23f`) — a simple dumbbell shape (two plates and a bar), no text, so it reads at 16 px. Colours are written as
literal hex (CSS variables do not reach a favicon). `index.html` gets
`<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` after the viewport meta. With an explicit icon link,
Chromium and Firefox do not request `/favicon.ico`; the hosted check is a Playwright console without that `404`.

### D5. Tests

- `App.test.tsx` / `Login.test.tsx`: the header scenarios use `container.querySelector("header")` and its
  `textContent`; the hidden part is checked by `closest(".visually-hidden")` on the text `Ти граєш як `. The two
  `Ти граєш як <name>` assertions in `Login.test.tsx` become header assertions per the modified players scenarios.
- `Games.test.tsx`: document order through `compareDocumentPosition`.
- `indexHtml.test.ts`: the icon link and `public/favicon.svg` starting with `<svg`.
- The "one line at 320 px" and "no `/favicon.ico` request" scenarios need a real layout and a real browser: they are
  checked with Playwright by hand, like the phone-screen scenarios of `clarify-round-and-result`.

## Risks / Trade-offs

- Showing only the name drops the visible words `Ти граєш як`: a first-time player may not at once read it as
  "you". → It is the human's choice; the name next to `Gym Challenge` on every screen and `Ти` in the score give the
  context, and screen readers still get the full phrase.
- A browser that ignores the SVG icon (old Safari) still asks for `/favicon.ico` and gets `404`. → Harmless; the app
  runs inside Telegram's web view, where no tab icon is shown.
