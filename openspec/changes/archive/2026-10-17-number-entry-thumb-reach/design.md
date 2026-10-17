# Design

## Context

Both numbers go through one component, `NumberEntry` (add-game-screen, D6): *edit* is a grid of label, field,
optional error and a full-width `Далі`; *confirm* is the text and a two-column `.actions` grid with `Надіслати` first.
The app runs inside the Telegram Mini App webview; on iOS the keypad overlays the page and the webview scrolls only
to the focused field. `inputMode="numeric"` gives a keypad with no Return key, so a submit button hidden under it
cannot be reached without dismissing the keypad. See proposal.md (Why) and the video frames: the field is the last
visible thing above the keypad.

## Goals / Non-Goals

**Goals:**
- `Далі` is visible whenever the field is, with no script and no dependence on how a given webview handles the keypad.
- The forward action is on the right in both steps.

**Non-Goals:**
- Moving or resizing the keypad, Telegram's `MainButton`, `visualViewport` handling or programmatic scrolling.
- Any change to copy, validation or requests.

## Decisions

### D1. `Далі` in a row with the field

Wrap the field and `Далі` in a row: `grid-template-columns: 1fr auto`, same `--tap` height, `Далі` with its own
horizontal padding so the field keeps most of the 360 px width (three digits at 1.6rem fit easily). The label stays
above the row and the error below it, so the DOM order is label → field → `Далі` → error and the form still submits
on Enter for hardware keyboards and desktop.

Alternatives: scroll the form into view on `focus`/`visualViewport.resize` — iOS and Telegram webviews differ in when
they fire and how far they scroll, and it fights the browser's own scroll; Telegram `MainButton` — needs
`telegram-web-app.js` (the app reads launch data itself, telegram-auth D7) and leaves the dev login link without a
button; padding at the bottom of the page so iOS can scroll further — iOS still scrolls only to the field.

### D2. Confirm buttons in DOM order `Змінити`, `Надіслати`

Swap the two buttons in the markup rather than reversing them with CSS (`order`, `direction`), so reading order,
tab order and visual order agree. The two-column `.actions` grid stays.

### D3. How the layout is checked

Vitest (jsdom) has no layout, so it asserts order: button order in the confirm step and field → `Далі` → error in
the edit step (`compareDocumentPosition`). The geometric scenario at 360×640 is checked with Playwright on
`docker compose up --build` using bounding boxes and a screenshot in `.playwright-mcp/`. The iOS keypad itself cannot
be emulated; the human confirms on the phone through the dev bot.

## Risks / Trade-offs

- [The row narrows the field on very small screens] → `Далі` is one short word; at 320 px the field still has about
  200 px for at most three digits.
- [Some webview still hides the row under the keypad] → then the field would be hidden too, which the browser
  prevents by scrolling to the focused field; the row moves with it.
