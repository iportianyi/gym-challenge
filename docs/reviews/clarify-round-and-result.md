1. **Вердикт** — CONDITIONAL
A — PASS — змінені лише view.ts, GameScreen.tsx/.module.css, їхні тести й артефакти зміни; харнес не чіпали.
B — NOT VISIBLE — сценарії з текстами й порядком читання покриті Vitest. Чотири layout-сценарії (три в "The score fits a phone screen" і "Buttons fit a phone screen") не мають закоміченого тесту. Їх перевірено вручну через Playwright, цифри лише в tasks.md 3.2. Design D7 це допускає, але самих перевірок у пакеті немає.
C — PASS — жоден тест не видалено й не пропущено. Переписані сценарії лишили ті самі дані й ролі, змінився тільки очікуваний текст, як у delta. Хелпер `follows` лише винесено вгору файлу.
D — PASS — код іде за D1–D6. Відхилення (NBSP у рядку правила, класи grid-area, поле нижче першого екрана на 320×640) записані в "Implementation notes".
E — PASS — коміти англійською за Conventional Commits, секретів немає, `openspec` без `pnpm exec` не викликається. `make check` у пакеті закінчується `check: OK (backend, frontend, spec, secrets)` (Vitest 108 passed).
F — PASS — правило "картка = останній раунд, поки ніхто не вгадав у наступному" лишилося одним для картки й історії. Фільтр `round !== card` коректний і для завершеної гри (`current` = null). Суперечностей зі специфікацією не знайдено.

2. **Знахідки**
openspec/changes/clarify-round-and-result/specs/game-screen/spec.md:141 — B — три сценарії "The score fits a phone screen" і сценарій "Buttons fit a phone screen" (invites/spec.md:42) не мають автоматичного тесту. Лише ручні вимірювання в tasks.md 3.2, тож регресію розмітки CSS ніщо не зловить.
frontend/src/components/GameScreen.tsx:127 — F — на 320×640 після картки поле здогадки й `Далі` починаються з y 848, тобто нижче першого екрана. Це записано в Risks і Implementation notes, але перевірка людиною (задача 3.4) ще відкрита.
openspec/changes/clarify-round-and-result/tasks.md:67 — E — задачі 3.4 (iPhone), 4.1 і 4.2 не закриті. Це очікувано до збереження рев'ю, але зміну не можна архівувати.

3. **Не видно в пакеті**
- Закомічені Playwright-скрипти або тести чотирьох layout-сценаріїв. Без них B лишається NOT VISIBLE. Зараз є лише числа в tasks.md та скріншоти в `.playwright-mcp/` (gitignored).
- Відповідь людини з iPhone (задача 3.4).
- Другий `make check` після коміту 1fb8d74. Він змінив лише design.md і tasks.md, тож ризик мінімальний.
- Перша частина design.md (D1–D3) прочитана з файлу. Сторінка пакета після рядка 968 (решта diff артефактів і вивід `make check`) не читалась, крім рядків пошуку `check: OK`, `passed` і `failed`.

4. **Рішення**
- Layout-сценарії без закоміченого тесту я оцінив як NOT VISIBLE, а не FAIL. Design D7 прямо визначає перевірку через Playwright, а цифри є в tasks.md. Через це вердикт CONDITIONAL.
- NBSP у рядку правила (`Гра — до`) я вважаю задокументованим відхиленням, не порушенням. Текст специфікації не змінюється, бо матчер Testing Library зводить U+00A0 до пробілу.
- Тести пишуть `current_round(3, null, "hidden")` та подібні виклики, щоб історія містила потрібні раунди. Я вважаю це відповідністю WHEN-умовам специфікації ("player 2 has guessed in round 3"), а не послабленням тесту.
