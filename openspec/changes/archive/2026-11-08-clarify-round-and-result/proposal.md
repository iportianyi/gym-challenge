# Proposal

## Why

The UX audit of 2026-10-20 (`docs/ux-audit-2026-10-20.md`) played a seven-round game with two players and found the
round itself hard to read: a new player is never told what to guess, the result of a round appears under the next
round's field, the last round is shown twice, an exact hit and its doubled penalty are not explained, and on a narrow
phone long names, `× N` and the invite buttons break badly. The human chose groups A (findings 1, 3, 5, 6) and B
(4, 9, 10, 11) as the next change, before the app is hosted for real play.

## What Changes

- **What is guessed (finding 1).** While the viewer guesses, the round says `Скільки людей зараз у залі?` and
  `Ближча здогадка отримує бал. Гра — до 5 балів.` above the field; the organizer's actual count field is preceded by
  `Скільки людей показує апка залу?`. Field labels stay `Твоя здогадка` and `Реальна кількість`.
- **Result first (finding 3).** The card `Підсумок раунду N` moves above the current round, and inside it the outcome
  and the penalty come before the actual count and the guesses.
- **No double round, compact history (finding 5).** While the card shows a round, `Історія раундів` leaves that round
  out. Each history item becomes three or four short lines: `Раунд N · у залі A`, `Ти X · <name> Y`, the outcome, and
  the penalty if any. Distances stay in the card only.
- **Exact hit explained (finding 6).** In the card an exact guess reads `<who>: 47 · точно` instead of
  `відстань 0` and is visually marked; in the history it reads `47 (точно)`. A doubled penalty ends with
  ` (<base> ×2 за точне влучання)` instead of ` (×2 точно)`, e.g. `Присідання × 20 (10 ×2 за точне влучання)`.
  **BREAKING** for the accepted text of "A doubled penalty is marked".
- **Score on a phone (findings 4, 9).** The score's digits and colon are centred in the board with the names under
  them; a long name breaks only at a space or hyphen (`Олександра-` / `Вікторія`), not mid-word. The region's text
  stays `Ти <mine> : <theirs> <name>`.
- **Invite screen (finding 10).** The heading becomes `Чекаємо суперника. Надішли посилання на гру.` (no `йому`), and
  `Копіювати посилання` and `Надіслати в Telegram` each take a full-width line so neither wraps.
- **`× N` stays with the exercise (finding 11).** Every penalty joins the exercise, `×` and the reps with no-break
  spaces.
- No backend, API, dependency or harness change; the wording above is a proposal for the human to adjust in review.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `game-screen`: the result card's place and order, the history without the card's round and in compact form, the
  exact-hit mark, the doubled-penalty text; new requirements on saying what is guessed, on the score's layout on a
  phone and on no-break spaces in penalties.
- `invites`: the waiting game's heading text and the copy/share buttons on separate lines.

## Impact

- Frontend only: `frontend/src/game/view.ts`, `frontend/src/components/GameScreen.tsx`,
  `frontend/src/components/GameScreen.module.css`; tests in `frontend/src/GameScreen.test.tsx`,
  `frontend/src/game/view.test.ts`, `frontend/src/Invites.test.tsx` (scenarios whose accepted text changes are
  rewritten to the new specs, not dropped).
- No API, backend, dependency, Docker or harness changes.
