# Spec Delta

## MODIFIED Requirements

### Requirement: The waiting game's screen gives the organizer the link
The screen of a waiting game SHALL show the heading `Гра: <exercise>`, the text
`Чекаємо суперника. Надішли посилання на гру.`, the `invite_url` as text, a button `Копіювати посилання` and a link
`Надіслати в Telegram` to `https://t.me/share/url` with `url` the `invite_url` and `text`
`Зіграй зі мною в Gym Challenge`, each of the two on its own full-width line. It SHALL show no region `Рахунок` and
no fields for a guess or the actual count.

In the scenarios below game `7` is an invite game of player `1` with exercise `Присідання` and `invite_url`
`https://t.me/gym_dev_bot?startapp=Abc_123-xyz`.

#### Scenario: Organizer opens the waiting game
- **WHEN** the app is opened as player `1` at `/games/7`
- **THEN** the page shows the heading `Гра: Присідання` and the texts `Чекаємо суперника. Надішли посилання на гру.`
  and `https://t.me/gym_dev_bot?startapp=Abc_123-xyz`
- **AND** the link `Надіслати в Telegram` has the address
  `https://t.me/share/url?url=https%3A%2F%2Ft.me%2Fgym_dev_bot%3Fstartapp%3DAbc_123-xyz&text=%D0%97%D1%96%D0%B3%D1%80%D0%B0%D0%B9%20%D0%B7%D1%96%20%D0%BC%D0%BD%D0%BE%D1%8E%20%D0%B2%20Gym%20Challenge`
- **AND** the page shows neither the region `Рахунок` nor the field `Твоя здогадка`

#### Scenario: Copy the link
- **WHEN** on that screen the person taps `Копіювати посилання`
- **THEN** the clipboard holds `https://t.me/gym_dev_bot?startapp=Abc_123-xyz`
- **AND** the page shows the text `Скопійовано`

#### Scenario: Clipboard refused
- **WHEN** on that screen the person taps `Копіювати посилання` and writing to the clipboard fails
- **THEN** the page shows the text `Не вдалося скопіювати. Виділи посилання й скопіюй вручну.`

#### Scenario: Opponent joins while the screen is open
- **WHEN** the organizer has the screen of game `7` open and 3 seconds later `GET /api/games/7` answers the game
  `active` against `Тренер` with no guesses in round `1`
- **THEN** the page shows the heading `Раунд 1` and the field `Твоя здогадка`
- **AND** the page does not show `Чекаємо суперника. Надішли посилання на гру.`

#### Scenario: Waiting game is polled
- **WHEN** the screen of waiting game `7` is open and 3 seconds pass
- **THEN** the app has sent `GET /api/games/7` twice

#### Scenario: Buttons fit a phone screen
- **WHEN** the screen of waiting game `7` is open in a 320×640 viewport
- **THEN** `Копіювати посилання` and `Надіслати в Telegram` are each at most 48 px tall and as wide as the panel's
  content
- **AND** the top of `Надіслати в Telegram` is below the bottom of `Копіювати посилання`
