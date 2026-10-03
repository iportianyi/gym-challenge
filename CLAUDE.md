# gym-challenge — правила для агента

Гра «вгадай, скільки людей у спортзалі» для двох гравців (автор і тренер). Що будуємо і чому — `docs/spec.md`.
Стек (деталі й причини — розділ «Стек» у spec): FastAPI + SQLModel + SQLite (uv, ruff, ty, pytest) ·
React + TypeScript + Vite (pnpm, Vitest) · локальний запуск через Docker Compose · FastAPI роздає зібраний фронтенд.
Продуктовий код — лише в межах прийнятої OpenSpec-зміни (див. нижче).

## Команди

- `docker compose up --build` — застосунок на http://localhost:8000 (API під `/api`, фронтенд на `/`).
- `make check` — **definition of done**: ruff, ty, pytest, ESLint, tsc, Vitest у Docker + `pnpm spec:check` на хості;
  успіх закінчується рядком `check: OK (backend, frontend, spec)`. Перед «готово» — запустити й процитувати.
- Інструменти бекенду/фронтенду на хості не встановлені: лише через `make check` або
  `docker compose --profile check run --rm backend-check|frontend-check <команда>`.
- Docker у контейнерах розв'язує DNS лише з увімкненим VPN людини (`/etc/docker/daemon.json`); збій DNS — питати людину.

## Порядок роботи (це докази для capstone — не порушувати)

- **Spec перед кодом (OpenSpec).** Кожна зміна: `/opsx:propose <name>` → людина переглядає proposal/specs/tasks →
  коміт артефактів → `/opsx:apply` → **рев'ю** → `/opsx:archive`. `docs/spec.md` — продукт і правила («навіщо»),
  `openspec/specs/` — прийняті вимоги зі сценаріями («що саме»). Контекст і правила артефактів — `openspec/config.yaml`.
  Якщо реальність розійшлася зі специфікацією — окремий коміт зі зміною spec/change і поясненням чому.
- **Рев'ю (maker ≠ checker).** Після `apply` — субагент `change-reviewer` (інша модель, лише читання). Головна сесія
  готує пакет у scratchpad (`git log --stat` + `git diff` діапазону комітів зміни + вивід `make check`), передає
  назву зміни й шлях до пакета, і зберігає відповідь **дослівно** в `docs/reviews/<change>.md`. Знахідки FAIL —
  виправити або винести людині; REJECT — не архівувати. Промпт рецензента змінює лише людина.
- **Червоний тест окремим комітом**, потім коміт, де він зеленіє. Не видаляти й не послаблювати тести, щоб стало зелено.
- **Журнал довіри `docs/autonomy-log.md`** — новий рядок після кожного значного кроку, одразу, а не заднім числом.
  Обов'язково записувати власні помилки агента й втручання людини (зупинила, відкотила, вирішила інакше).
- Коміти: Conventional Commits англійською (`feat:`, `fix:`, `test:`, `docs:`, `chore:`), одна логічна зміна на коміт.
  На коміти посилатимемося в PR — повідомлення мають бути змістовні.
- **Зміни харнесу — окремим комітом**, не разом із кодом фічі (`.claude/`, `.mcp.json`, `CLAUDE.md`, `openspec/config.yaml`,
  `Makefile`-цілі перевірки). Навіть якщо це задача тієї самої OpenSpec-зміни. Причина: знахідка рецензента
  (`docs/reviews/add-project-skeleton.md`, №6) — у `feat`-коміті змішались код, allow-list і правила.

## Харнес

- Hooks у `.claude/settings.json` пишуть кожен виклик інструмента в `.agent-log/actions.jsonl`; журнал комітимо разом зі зміною.
- `node scripts/agent-log-summary.mjs` — що агент запропонував / виконав / що заблоковано.
- `node scripts/hooks-selftest.mjs` — перевірка hooks без агента.
- OpenSpec — devDependency кореневого `package.json`: лише `pnpm exec openspec …`, ніколи «голий» `openspec` чи `openspec store`.
  `pnpm spec:check` — spec-gate (`validate --all --strict` + архів + «голі» виклики).
  Після `pnpm exec openspec update` — обов'язково `pnpm openspec:pin`; згенеровані `openspec-*` скіли й `/opsx:*` руками не правити.
- Не редагувати `.agent-log/`, `.claude/hooks/`, `.claude/settings.json` без явного прохання людини — це шар спостереження.
- Не вставляти секрети в команди: команди потрапляють у закомічений журнал.
- MCP: **Context7** — актуальна документація бібліотек (правило `.claude/rules/context7.md`);
  **Playwright** — браузер для перевірки UI на `localhost` (скріни в `.playwright-mcp/`, gitignored).
- Skills у `.claude/skills/`: `fastapi` (офіційний), `frontend-design`, `web-design-reviewer`, `context7-mcp`, `openspec-*` (згенеровані).
  Сторонні скіли — дослівні копії з `SOURCE.md`; не редагувати, оновлювати лише новою копією з джерела.
- Усі налаштування Claude — лише на рівні проєкту: `.claude/rules/project-scope.md`.

## Межі

- Питати перед: додаванням залежності, зміною конфігів збірки, `.claude/`, `.mcp.json`, CI, `git push`.
- Ніколи: `.env*` (блокує hook), `git push --force`, `rm -rf`, переписування закоміченої історії.

## Мова

Спілкування й документація — українською; код, ідентифікатори й повідомлення комітів — англійською.
