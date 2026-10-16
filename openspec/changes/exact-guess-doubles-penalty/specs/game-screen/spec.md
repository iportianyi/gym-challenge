# Spec Delta

## ADDED Requirements

### Requirement: A doubled penalty is marked
Wherever the screen shows a penalty whose `doubled` is `true` — the result card, the round history and the finished
game — the penalty text SHALL end with ` (×2 точно)` after the reps. A penalty with `doubled` `false` SHALL be shown
without the mark.

#### Scenario: Doubled round penalty in the result card
- **WHEN** round `1` of game `1` was settled with guesses `50` (player `1`), `47` (player `2`) and actual `47`,
  round `2` has no guesses, and the screen is opened by player `1`
- **THEN** the card under `Підсумок раунду 1` shows the text `Твоє покарання: Присідання × 20 (×2 точно)`

#### Scenario: Doubled round penalty in the history
- **WHEN** the same game is opened by player `2`
- **THEN** the item `Раунд 1` under `Історія раундів` shows the text `Покарання суперника: Присідання × 20 (×2 точно)`

#### Scenario: Doubled final penalty
- **WHEN** player `1` has won game `1` by `5` to `0`, the last round with an exact guess, and the screen is opened
  by player `2`
- **THEN** the page shows the texts `Переможець — Клієнт` and `Твоє покарання: Присідання × 60 (×2 точно)`

#### Scenario: Penalty that was not doubled has no mark
- **WHEN** round `1` was settled as (`40`, `55`, `47`) and the screen is opened by player `2`
- **THEN** the card shows the text `Твоє покарання: Присідання × 10`
- **AND** the page does not show the text `×2 точно`
