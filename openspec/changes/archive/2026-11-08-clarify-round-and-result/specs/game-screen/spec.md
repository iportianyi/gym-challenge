# Spec Delta

## MODIFIED Requirements

### Requirement: The round just settled is shown as a result card
While the game has a settled round and nobody has guessed in the next one, or the game is finished, the screen
SHALL show a card with the heading `Підсумок раунду <number>` above the current round: first the round's winner or a
draw and the penalty, then the actual count and each guess with its distance. Distances are `|guess − actual|`; a
guess equal to the actual count SHALL read `<who>: <value> · точно` instead of a distance.

#### Scenario: Result seen by the round winner
- **WHEN** round `1` of game `1` was settled with guesses `40` (player `1`), `55` (player `2`) and actual `47`,
  round `2` has no guesses, and the screen is opened by player `1`
- **THEN** the page shows the heading `Підсумок раунду 1`
- **AND** the card shows the texts `Реальна кількість: 47`, `Ти: 40 · відстань 7`, `Тренер: 55 · відстань 8`,
  `Раунд твій` and `Покарання суперника: Присідання × 10`

#### Scenario: Result seen by the round loser
- **WHEN** the same game is opened by player `2`
- **THEN** the card shows the texts `Ти: 55 · відстань 8`, `Клієнт: 40 · відстань 7`,
  `Переможець раунду — Клієнт` and `Твоє покарання: Присідання × 10`

#### Scenario: Draw
- **WHEN** round `1` was settled with guesses `40`, `54` and actual `47` and the screen is opened by player `1`
- **THEN** the card shows the text `Нічия`
- **AND** the card does not show the text `Покарання`

#### Scenario: Card leaves once the next round starts
- **WHEN** round `1` was settled as (`40`, `55`, `47`) and player `2` has guessed in round `2`, and the screen is
  opened by player `1`
- **THEN** the page does not show the heading `Підсумок раунду 1`

#### Scenario: Card comes before the next round
- **WHEN** round `1` was settled as (`40`, `55`, `47`), round `2` has no guesses, and the screen is opened by
  player `2`
- **THEN** in reading order the heading `Підсумок раунду 1` comes before the heading `Раунд 2`
- **AND** inside the card the texts come in the order `Переможець раунду — Клієнт`,
  `Твоє покарання: Присідання × 10`, `Реальна кількість: 47`, `Ти: 55 · відстань 8`, `Клієнт: 40 · відстань 7`

#### Scenario: Exact guess in the card
- **WHEN** round `1` was settled with guesses `50` (player `1`), `47` (player `2`) and actual `47`, round `2` has no
  guesses, and the screen is opened by player `1`
- **THEN** the card shows the texts `Ти: 50 · відстань 3` and `Тренер: 47 · точно`
- **AND** the card does not show the text `відстань 0`

### Requirement: The screen shows every settled round
The screen SHALL show the heading `Історія раундів` with one item per settled round that is not in the result card,
newest first. Each item SHALL show `Раунд <number> · у залі <actual>`, then `Ти <mine> · <name> <theirs>` with
` (точно)` after a guess equal to the actual count, then the winner or `Нічия`, and the penalty in the card's words.
With no such round the heading SHALL NOT be shown.

#### Scenario: Two rounds, newest first
- **WHEN** in game `1` round `1` was settled as (`40`, `55`, `47`) and round `2` as (`50`, `47`, `47`), player `2`
  has guessed in round `3`, and the screen is opened by player `1`
- **THEN** the list under `Історія раундів` has two items, the first with the text `Раунд 2 · у залі 47` and the
  second with the text `Раунд 1 · у залі 47`
- **AND** the first item shows the texts `Ти 50 · Тренер 47 (точно)`, `Переможець раунду — Тренер` and
  `Твоє покарання: Присідання × 20 (10 ×2 за точне влучання)`
- **AND** the second item shows the text `Ти 40 · Тренер 55`

#### Scenario: The card's round is not repeated in the history
- **WHEN** the same two rounds were settled, round `3` has no guesses, and the screen is opened by player `1`
- **THEN** the page shows the heading `Підсумок раунду 2`
- **AND** the list under `Історія раундів` has one item, with the text `Раунд 1 · у залі 47`

#### Scenario: One settled round shown in the card has no history
- **WHEN** round `1` was settled as (`40`, `55`, `47`), round `2` has no guesses, and the screen is opened by
  player `1`
- **THEN** the page shows the heading `Підсумок раунду 1`
- **AND** the page does not show the heading `Історія раундів`

#### Scenario: New game has no history
- **WHEN** the screen of a game with no settled rounds is opened
- **THEN** the page does not show the heading `Історія раундів`

### Requirement: A doubled penalty is marked
Wherever the screen shows a penalty whose `doubled` is `true` — the result card, the round history and the finished
game — the penalty text SHALL end with ` (<base> ×2 за точне влучання)` after the reps, where `<base>` is the reps
divided by 2. A penalty with `doubled` `false` SHALL be shown without the mark.

#### Scenario: Doubled round penalty in the result card
- **WHEN** round `1` of game `1` was settled with guesses `50` (player `1`), `47` (player `2`) and actual `47`,
  round `2` has no guesses, and the screen is opened by player `1`
- **THEN** the card under `Підсумок раунду 1` shows the text
  `Твоє покарання: Присідання × 20 (10 ×2 за точне влучання)`

#### Scenario: Doubled round penalty in the history
- **WHEN** in the same game player `1` has guessed in round `2` and the screen is opened by player `2`
- **THEN** the item `Раунд 1 · у залі 47` under `Історія раундів` shows the text
  `Покарання суперника: Присідання × 20 (10 ×2 за точне влучання)`

#### Scenario: Doubled final penalty
- **WHEN** player `1` has won game `1` by `5` to `0`, the last round with an exact guess, and the screen is opened
  by player `2`
- **THEN** the page shows the texts `Переможець — Клієнт` and
  `Твоє покарання: Присідання × 60 (30 ×2 за точне влучання)`

#### Scenario: Penalty that was not doubled has no mark
- **WHEN** round `1` was settled as (`40`, `55`, `47`) and the screen is opened by player `2`
- **THEN** the card shows the text `Твоє покарання: Присідання × 10`
- **AND** the page does not show the text `за точне влучання`

## ADDED Requirements

### Requirement: The round says what is guessed
While the viewer is to guess, the current round SHALL show `Скільки людей зараз у залі?` and
`Ближча здогадка отримує бал. Гра — до 5 балів.` above the field `Твоя здогадка`. While the organizer is to enter
the actual count, the round SHALL show `Скільки людей показує апка залу?` above the field `Реальна кількість`.

#### Scenario: Guess explained
- **WHEN** the screen of game `1` in round `1` with no guesses is opened by player `2`
- **THEN** in reading order the heading `Раунд 1` is followed by the texts `Скільки людей зараз у залі?` and
  `Ближча здогадка отримує бал. Гра — до 5 балів.`, and then by the field `Твоя здогадка`

#### Scenario: Actual count explained
- **WHEN** in game `1` both have guessed (`40`, `55`) and the screen is opened by player `1`
- **THEN** in reading order the text `Скільки людей показує апка залу?` is followed by the field
  `Реальна кількість`
- **AND** the page does not show the text `Скільки людей зараз у залі?`

#### Scenario: Nothing to explain while waiting
- **WHEN** player `1` has guessed `47` in round `1` and player `2` has not, and the screen is opened by player `1`
- **THEN** the page shows neither `Скільки людей зараз у залі?` nor `Скільки людей показує апка залу?`

### Requirement: A penalty keeps its reps with the exercise
Every penalty text on the game screen SHALL join the exercise, `×` and the reps with no-break spaces (U+00A0), and
the `×2` of a doubled penalty with the word after it, so a narrow screen never puts `× <reps>` on a line of its own.

#### Scenario: Round penalty with no-break spaces
- **WHEN** round `1` of game `1` was settled as (`40`, `55`, `47`), round `2` has no guesses, and the screen is
  opened by player `2`
- **THEN** the card contains an element whose text content is exactly
  `Твоє покарання: Присідання × 10`, where ` ` is the character U+00A0

#### Scenario: Doubled penalty with no-break spaces
- **WHEN** round `1` was settled as (`50`, `47`, `47`), round `2` has no guesses, and the screen is opened by
  player `1`
- **THEN** the card contains an element whose text content is exactly
  `Твоє покарання: Присідання × 20 (10 ×2 за точне влучання)`

### Requirement: The score fits a phone screen
In the region `Рахунок` the colon SHALL be centred in the board whatever the names' lengths, each name SHALL be shown
under its points, and a name SHALL break only at a space or a hyphen unless a single word is wider than its half of
the board. The region's text order stays `Ти <mine> : <theirs> <name>`.

#### Scenario: Colon centred with a long name
- **WHEN** the screen of a game against `Олександра-Вікторія`, with the viewer's points `3` and the other
  player's points `1`, is open in a 320×640 viewport
- **THEN** the horizontal middle of the colon is within 1 px of the horizontal middle of the region `Рахунок`
- **AND** the text of the region `Рахунок`, with whitespace collapsed, equals `Ти 3 : 1 Олександра-Вікторія`

#### Scenario: Long name breaks at its hyphen
- **WHEN** the same screen is open in a 320×640 viewport
- **THEN** the name `Олександра-Вікторія` is laid out on at most two lines
- **AND** no line break falls inside the word `Олександра` or the word `Вікторія`

#### Scenario: Names under their points
- **WHEN** the same screen is open in a 375×667 viewport
- **THEN** the top of `Ти` is below the bottom of the viewer's points, and the top of `Олександра-Вікторія` is below
  the bottom of the other player's points
- **AND** the horizontal middle of `Ти` lies within the left half of the region and that of `Олександра-Вікторія`
  within the right half
