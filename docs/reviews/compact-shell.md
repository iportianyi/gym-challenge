## Перше рев'ю (на `9bb312c`)

**Вердикт** — CONDITIONAL

- A — PASS — змінено лише фронтенд (шапка, `GameList`, іконка), тести й артефакти зміни. `.claude/`, хуки, `.mcp.json` і бекенд не чіпали. Деплой дозволила людина (задача 3.1).
- B — NOT VISIBLE — сценарії шапки, порядку «Нова гра» та посилання на іконку мають тести з конкретними значеннями. Сценарії «The header is one line on a phone» і «No request for favicon.ico» перевірено лише вручну в Playwright. design D5 це допускає, але в пакеті є тільки текст із tasks.md, без скріншотів і логів.
- C — PASS — тести не видалено і не пропущено. Перероблені в `Login.test.tsx` твердження відповідають зміненим сценаріям players. Червоні тести закомічено окремо (8fd0a61).
- D — PASS — код відповідає D1–D4. Два відхилення записано в design.md, розділ «Notes from implementation»: `minmax(0, 1fr)` і переформулювання сценарію про «top».
- E — PASS — коміти за Conventional Commits англійською, `make check` закінчується `check: OK (backend, frontend, spec, secrets)`. Секретів немає.
- F — PASS — суперечностей коду зі специфікацією не знайдено. Одне спірне місце описано в розділі «Рішення».

**Знахідки**
- `/home/i.portianyi/study/fwdays-ai-agentic-engineering/gym-challenge/frontend/src/components/PlayerSession.tsx:137` — F — ім'я передається в `AppHeader` лише при `session.status === "ready"`. На екранах `invited` і `join-failed` відомий гравець бачить шапку без імені, хоча spec каже «once the player is known». Це відповідає D1, але спека це не уточнює, а автоматичного тесту немає.
- `/home/i.portianyi/study/fwdays-ai-agentic-engineering/gym-challenge/openspec/changes/compact-shell/tasks.md:948` — B — результати ручних перевірок (23 px, `…` на x 304, відсутність горизонтального скролу, `/favicon.ico` не запитувався) не підтверджені артефактами в пакеті. Скріншоти лежать у `.playwright-mcp/`, який у gitignore.
- `/home/i.portianyi/study/fwdays-ai-agentic-engineering/gym-challenge/openspec/changes/compact-shell/tasks.md:951` — D — текст задачі 2.4 досі містить «same top for heading and name», хоча сценарій змінено на «within top and bottom». Невідповідність косметична, але в тексті задачі лишилося старе формулювання.

**Не видно в пакеті**
- Доказ сценарію «No request for favicon.ico»: мережевий лог або скріншот, `GET /favicon.svg` → `200` з `image/svg+xml`, відсутність запиту `/favicon.ico`.
- Доказ сценарію «The header is one line on a phone»: скріншот `compact-shell-games-320.png` або виміри.
- pytest-тест, що бекенд роздає `favicon.svg` із зібраного фронтенду. У `test_web_shell.py` його немає, доказ лише ручний.

**Рішення**
- Ручні Playwright-сценарії не вважаю відсутніми тестами, бо design D5 прямо виносить їх за межі Vitest. Через це B лишається NOT VISIBLE, а не FAIL.
- «Once the player is known» у spec трактую за D1 (ім'я лише в стані `ready`), тому відсутність імені в `invited` і `join-failed` не вважаю FAIL.
- Сценарій «Greeting outside Telegram» залишився без змін у тестах, а AppHeader там рендериться з `initData === null`. Існуючі тести зелені, тому окремого перегляду цього тесту я не робив.

## Друге рев'ю (після виправлень `d1e7e6e`…`a20d475`)

**Вердикт** — ACCEPT

- A — PASS — з першого рев'ю змінено лише `PlayerSession.tsx`, `Invites.test.tsx` і артефакти зміни. `.claude/`, хуки, `.mcp.json` не чіпали. Другий деплой людина дозволила (задача 2.8).
- B — PASS — два нові сценарії шапки на запрошенні мають тести в `Invites.test.tsx` з точним текстом `Gym ChallengeТи граєш як Тренер`, а сценарій з відмовою перевіряє ще й `Це запрошення вже прийняв інший гравець.`. Сценарії «одна лінія на телефоні» та «без запиту favicon.ico» лишаються ручними за design D5. Це рішення людини після першого рев'ю, тому не вважаю їх прогалиною.
- C — PASS — тести не видалено і не послаблено. Червоні тести закомічено окремо (202cd22, `2 failed | 125 passed`), потім `127 passed (127)`.
- D — PASS — відхилення від першої редакції D1 записано в design.md. Там сказано, що ім'я виводиться з будь-якого стану сесії з гравцем, а новий гравець на запрошенні бачить лише `Gym Challenge`.
- E — PASS — коміти за Conventional Commits англійською, `make check` закінчується `check: OK (backend, frontend, spec, secrets)`, секретів немає.
- F — PASS — `"player" in session ? session.player?.name` дає ім'я для станів `invited`, `joining`, `join-failed` і `ready`. Для `invited` і `join-failed` з `player: null` ім'я не показується, як вимагає spec. Для станів `register`, `loading`, `refused` і `unreachable` поля `player` немає, тому там теж лише `Gym Challenge`.

**Знахідки**
- Знахідок немає. Усі три знахідки першого рев'ю закрито: №1 виправлено кодом і тестами, №3 виправлено в тексті задачі 2.4, №2 лишено за рішенням людини (design D5).

**Не видно в пакеті**
- Нічого, що блокує вердикт. Ручні докази Playwright для сценаріїв «одна лінія на телефоні» та «без запиту favicon.ico» (скріншоти, мережевий лог) досі в пакеті відсутні, лише цитати в tasks.md. Це ризик, який людина прийняла за D5.
- Задачі 4.1 і 4.2 відкриті за задумом.

**Рішення**
- Знахідку №2 першого рев'ю (ручні перевірки) не повертаю як NOT VISIBLE, бо людина свідомо лишила її за D5. B ставлю PASS для автоматизованих сценаріїв.
- Сценарій з `player: null` на запрошенні («новий гравець бачить лише Gym Challenge») окремого тесту не має. Код його покриває, а лише-стан `register` перевіряє існуючий тест «header before the player is known». Тому FAIL не ставлю.
