# Spec Delta

## ADDED Requirements

### Requirement: The number entry keeps its forward button under the right thumb
In both number entries (`Твоя здогадка` and `Реальна кількість`) the button that moves forward SHALL be on the
right. In the edit step `Далі` SHALL be on the same line as the field, right of it, with the range error below that
line. In the confirm step `Змінити` SHALL be on the left and `Надіслати` on the right.

#### Scenario: Confirm step puts Надіслати on the right
- **WHEN** on the screen of game `1` in round `1` with no guesses, player `1` types `47` into `Твоя здогадка` and
  taps `Далі`
- **THEN** the round panel's buttons, in reading order, are `Змінити`, `Надіслати`

#### Scenario: Confirm step of the actual count puts Надіслати on the right
- **WHEN** in game `1` both have guessed (`40`, `55`), player `1` types `47` into `Реальна кількість` and taps
  `Далі`
- **THEN** the round panel's buttons, in reading order, are `Змінити`, `Надіслати`

#### Scenario: Далі follows the field on its line
- **WHEN** player `1` types `501` into `Твоя здогадка` and taps `Далі`
- **THEN** in reading order the field `Твоя здогадка` is followed directly by the button `Далі`, and then by the text
  `Введи ціле число від 0 до 500`

#### Scenario: Далі stays beside the field on a phone
- **WHEN** the screen of game `1` in round `1` with no guesses is open in a 360×640 viewport
- **THEN** the button `Далі` starts at or right of the right edge of the field `Твоя здогадка`
- **AND** the vertical middle of `Далі` lies between the top and the bottom of the field
- **AND** both the field and `Далі` are at least 44 px tall
