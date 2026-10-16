# Рев'ю: rename-creator-to-organizer

- **Рецензент:** субагент `change-reviewer` (лише читання). Автор коду — головна сесія (Opus).
- **Пакет:** `git log --stat` + `git diff fd8b587^..` (до коміту з tasks 1.1–4.1), повний вивід `make check`,
  нотатки головної сесії (червоні прогони, відхилення від D1, перевірка на томі людини).

## Звіт рецензента (дослівно)

**Вердикт** — ACCEPT
A — PASS — змінено лише backend, frontend, міграцію 0004, docs/spec.md і rounds Purpose; `.claude/`, хуки, `.mcp.json`, `Makefile` не чіпали.
B — PASS — сценарії з `organizer` перевіряють повні тіла відповідей і точний текст 403 («Only the organizer enters the actual count») у test_games.py і test_rounds.py. Сценарій «0004 зберігає гру й раунди» покриває test_0004_renames_creator_to_organizer_and_keeps_games: upgrade, downgrade, збережені рядки. Фронтенд-сценарії покрито 80 тестами Vitest.
C — PASS — жоден тест не видалено, не пропущено і не послаблено; у диффі лише перейменування полів і назв, плюс один новий тест міграції. Було 5 червоних pytest і 55 червоних Vitest до реалізації, після неї 102 і 80 зелених.
D — PASS — відхилення від D1 (`ALTER TABLE … RENAME COLUMN` замість batch mode) записане в design.md окремим комітом 6b46732 з причиною (FOREIGN KEY constraint failed). D2 (старі ревізії зберігають `creator_id`) і D3 (без аліаса в API) дотримано.
E — PASS — коміти за Conventional Commits англійською, `docs/spec.md` піднято до v2.3, секретів у диффі немає. `make check` закінчується рядком `check: OK (backend, frontend, spec, secrets)`.
F — PASS — `organizer_id` замінено послідовно в моделі, `players`, `my_game`, `create_game`, `list_games`, `enter_actual`. Перевірка організатора в `enter_actual` стоїть перед перевіркою завершеної гри, як вимагає spec. Міграція зворотна, а `ALTER … RENAME COLUMN` зберігає рядки, NOT NULL і зовнішній ключ.

**Знахідки**
Знахідок немає. Задачі 5.1 і 5.2 у tasks.md ще не відмічені: це очікуваний стан до збереження рев'ю.

**Не видно в пакеті**
Нічого, що блокує вердикт. Результат `grep -rni creator backend/app frontend/src` (задача 3.2) і ручну перевірку на живому томі пакет подає лише як слова головної сесії, самих виводів немає. Для цього рев'ю достатньо чистих `ruff`, `ty`, `tsc` і повного зеленого `make check`.

**Рішення**
- Червоні запуски до реалізації (задачі 1.1, 1.2) і ручна перевірка тома спираються на нотатки головної сесії в пакеті. Це не змінює вердикт: диффи тестів і зелений `make check` показані.
- Перейменування describe/it у GameScreen.test.tsx узгоджене з новими назвами вимог у дельті game-screen, тож це не втрата покриття.
- Лишкові `creator_id` у тестах ревізій 0001–0003 прийняв як навмисні за design D2.

## Розбір автора (головна сесія)

- Знахідок немає. Вивід `grep` із задачі 3.2 на кінцевому дереві: `creator` лишився тільки в
  `backend/app/migrations/versions/0001_players_and_games.py` (історична колонка) і в самій
  `0004_rename_creator_to_organizer.py`.
- Повторно рецензента не запускали: вердикт ACCEPT без умов.
