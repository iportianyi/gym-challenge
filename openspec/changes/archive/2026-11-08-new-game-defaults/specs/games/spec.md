# Spec Delta

## MODIFIED Requirements

### Requirement: The app creates a game with the chosen opponent
The form SHALL have the heading `Нова гра`, the select `Суперник`, the fields `Вправа`, `Повторень за першу поразку`,
`Додати за кожну наступну поразку поспіль`, `Повторень за програну гру`, and the buttons `Почати гру` and
`Скасувати`. When the form opens, `Вправа` SHALL be empty and the three number fields SHALL hold `10`, `5` and `30`
in that order; the person MAY change them within the same limits as before. On success the app SHALL open the new
game's screen at `/games/{id}`; on a `422` from the server it SHALL stay on the form and show the error in Ukrainian.

#### Scenario: The form opens with default reps
- **WHEN** the app is opened as player `1` and the person taps `Нова гра`
- **THEN** the field `Вправа` has the value `""`
- **AND** the field `Повторень за першу поразку` has the value `10`
- **AND** the field `Додати за кожну наступну поразку поспіль` has the value `5`
- **AND** the field `Повторень за програну гру` has the value `30`

#### Scenario: Submit keeping the defaults
- **WHEN** on the form the person fills only `Вправа` with `Присідання`, leaves `Суперник` at
  `Запросити за посиланням` and taps `Почати гру`
- **THEN** the app sends `POST /api/games` with body
  `{"exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30}`

#### Scenario: Submit with changed reps
- **WHEN** on the form the person fills `Вправа` with `Віджимання`, changes the three number fields to `12`, `0` and
  `50`, leaves `Суперник` at `Запросити за посиланням` and taps `Почати гру`
- **THEN** the app sends `POST /api/games` with body
  `{"exercise": "Віджимання", "base_reps": 12, "step_reps": 0, "final_reps": 50}`

#### Scenario: Successful create
- **WHEN** the app is opened as player `1`, `GET /api/opponents` answers `[{"id": 2, "name": "Тренер"}]`, and the
  person chooses `Тренер` in `Суперник`, fills `Присідання`, `10`, `5`, `30` and taps `Почати гру`
- **THEN** the app sends `POST /api/games` with header `Authorization: tma <t1>` and body
  `{"opponent_id": 2, "exercise": "Присідання", "base_reps": 10, "step_reps": 5, "final_reps": 30}`
- **AND** after a `201` answer with game id `7` the address is `/games/7`
- **AND** the page shows the heading `Гра: Присідання`

#### Scenario: Opponent no longer exists
- **WHEN** the server answers the form's `POST /api/games` with `422` and `{"detail": "Opponent not found"}`
- **THEN** the page still shows the heading `Нова гра`
- **AND** the page shows the text `Такого гравця немає. Обери іншого.`

#### Scenario: Cancel
- **WHEN** on the form the person taps `Скасувати`
- **THEN** the page shows the heading `Мої ігри`
- **AND** no `POST /api/games` request is sent
