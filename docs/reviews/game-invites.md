# Рев'ю: game-invites

- **Рецензент:** субагент `change-reviewer` (лише читання). Автор коду — головна сесія (Opus).
- **Пакет:** `git log --stat` + `git diff 309a58e..449fdd7` (від останнього коміту перед зміною до коміту з 6.2),
  повний вивід `make check`, нотатки головної сесії (червоні прогони, відхилення від D1, Playwright, перевірка
  людини в Telegram).

## Звіт рецензента (дослівно)

**Вердикт** — ACCEPT
A — PASS — зміни лише за design і tasks: docker-compose (4.1), `dev-login-link.mjs`, docs, `CLAUDE.md` окремим комітом 449fdd7 (6.2). `.claude/`, hooks і `.mcp.json` не чіпали; `.env.example` змінила людина і не закомітила.
B — PASS — у специфікаціях invites, games, players, rounds і telegram-auth кожен сценарій має тест із конкретними значеннями (статуси, тексти, тіла, URL share-посилання, 22 символи токена, гонка join). Сценарії games, які не змінювались ("Opponent no longer exists", "Cancel"), лишились у `Games.test.tsx` (рядки 193, 203).
C — PASS — видалені тести (`test_three_players`, `test_alone_in_the_app`, "no opponent chosen", "players could not be loaded") відповідають REMOVED/MODIFIED вимогам. Перейменовані й переписані тести стали суворішими або рівними. Скіпів немає, асерти в `test_rounds` не послаблені.
D — PASS — відхилення D1 (міграції з вимкненими foreign keys), D3 (збір у Python) і D4 (детермінований тест гонки) записані в Implementation notes. Є два дрібні незаписані розходження, див. Знахідки.
E — PASS — коміти Conventional, англійською, UI українською, `pnpm exec openspec` без порушень, секретів у diff немає (`local-dev-token` і `local_dev_bot` публічні плейсхолдери). Харнес (`CLAUDE.md`) окремим комітом.
F — PASS — логіка join (404, 409, 200 для організатора й суперника, захищений UPDATE з rollback), 409 на guesses/actual у waiting-грі, `my_game` ховає waiting-гру від інших (404), `GET /api/players` стає 404, а `/join` оголошено перед `/{game_id}`. Розбіжностей зі специфікацією немає.

**Знахідки**
`/home/i.portianyi/study/fwdays-ai-agentic-engineering/gym-challenge/backend/app/api/games.py:~118` — D — design D5 каже, що `GameState.players` повертає `()` для waiting-гри, а код робить `assert opponent_id is not None`; розходження не записане в Implementation notes (поведінка за специфікацією коректна, бо waiting-гілки обробляються раніше).
`/home/i.portianyi/study/fwdays-ai-agentic-engineering/gym-challenge/frontend/src/components/GameScreen.tsx:~207` — D — design D8 каже `rel="noopener"`, код ставить `noopener noreferrer`; дрібне незаписане розходження.
`frontend/tsconfig.tsbuildinfo` (коміти 9eb2d14 і eb102cc) — E — build-артефакт потрапив у feat-коміт і був прибраний наступним комітом; історію не переписували за правилом, у підсумковому diff слід відсутній.

**Не видно в пакеті**
Явне «так» людини на зміну `CLAUDE.md` (6.2) і на `docker-compose.yml` (4.1) видно лише з позначок у tasks.md, а не з самого діалогу.
Результати Playwright (4.3) і перевірки в Telegram (5.1) наведені лише як нотатки головної сесії; самих скріншотів і логів у пакеті немає. На оцінку кодових критеріїв це не впливає.

**Рішення**
Розходження D5 (`assert` замість `()`) і D8 (`noopener noreferrer`) не вважаю FAIL за D: поведінка збігається зі специфікацією, а відхилення мінімальні й безпечніші за задумане. Перелічив їх як знахідки.
Прямі правки `openspec/specs/players/spec.md` і `docs/spec.md` не вважаю порушенням scope: їх прямо вимагає завдання 6.1.
Видалення тестів "no opponent chosen" і "players could not be loaded" не вважаю послабленням: відповідні вимоги REMOVED або MODIFIED у делті games.
