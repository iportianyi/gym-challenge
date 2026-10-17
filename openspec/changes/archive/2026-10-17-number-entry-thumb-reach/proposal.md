# Proposal

## Why

The human played round 1 on an iPhone inside Telegram (video of 2026-10-17) and hit two thumb problems in the number
entry, the one place every round needs. The digit keypad covers `Далі`: iOS scrolls only far enough to show the field,
the page is too short to scroll further, and the keypad has no Return key, so the player has to dismiss the keypad
before they can go on. On the confirm step `Надіслати` is on the left, away from the right thumb, while the
irreversible action is the one the player wants to reach. Both are worth fixing before the app is hosted for real
play.

## What Changes

- On the confirm step the buttons swap places: `Змінити` on the left, `Надіслати` on the right.
- In the edit step `Далі` sits on the same line as the number field, to its right, so it stays visible whenever the
  field is visible, including above the iOS keypad. The range error stays below that line.
- Both apply to the guess (`Твоя здогадка`) and to the organizer's actual count (`Реальна кількість`), which share
  one entry.
- No change to texts, the 0–500 check, the requests or the backend. The keypad's position is not controllable from a
  web page, so no attempt is made to move it.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `game-screen`: a new requirement on where the number entry puts `Далі`, `Змінити` and `Надіслати`.

## Impact

- Frontend only: `frontend/src/components/NumberEntry.tsx`, `frontend/src/components/GameScreen.module.css`,
  tests in `frontend/src/GameScreen.test.tsx`.
- No API, backend, dependency, Docker or harness changes.
