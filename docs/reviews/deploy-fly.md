1. **Вердикт** — ACCEPT
- A — PASS — у діапазоні лише `fly.toml`, `.dockerignore`, сервіс `fly` у compose, скрипти, документація, `design.md` і `tasks.md`. Зміни харнесу (`CLAUDE.md`, `openspec/config.yaml`) лежать в окремому коміті 3203683 за задачею 5.3 і з підтвердженням людини.
- B — PASS — п'ять сценаріїв перевіряє `scripts/hosting-check.mjs` з точними значеннями: 200 і `{"status":"ok"}`, 301/302/307/308 з точним `Location`, `<div id="root">`, 401, відсутність `TELEGRAM_BOT_TOKEN` і ім'я бота в `[env]`. Решта сценаріїв ручні, як запланував design D6, і їхні результати процитовано в `tasks.md`: `.env` (`NONE`), секрет, пробудження Machine, сценарії Telegram. Самих запусків пакет не показує.
- C — PASS — жоден тест не видалено й не послаблено. Рефакторинг `dev-login-link.mjs` підтверджено порівнянням виводу до і після (`cmp`: IDENTICAL), це записано в `tasks.md`.
- D — PASS — реалізація відповідає D1–D5. Відхилення записано в «Implementation notes»: регіон `fra`, непотрібний entrypoint з D4, `flyctl` від root, один збій health-check після холодного старту. Є дрібна розбіжність у D6, див. знахідку 1.
- E — PASS — коміти за Conventional Commits англійською, документація українською, токена бота ніде немає, `.env*` винесено з контексту збірки, образ `flyctl` зафіксовано. `make check` закінчується рядком `check: OK (backend, frontend, spec, secrets)`.
- F — PASS — логіка `hosting-check.mjs` і `fly.toml` відповідає вимогам. Редирект перевіряється з `redirect: "manual"`, виняток `JSON.parse` перехоплюється, `force_https` і auto-stop налаштовано.

2. **Знахідки**
- `/home/i.portianyi/study/fwdays-ai-agentic-engineering/gym-challenge/openspec/changes/deploy-fly/design.md` (D6) — D — D6 каже перевіряти сценарії через `curl`, а реально це `scripts/hosting-check.mjs`. Ця розбіжність не записана в «Implementation notes» (сам скрипт описано в proposal і tasks).
- `/home/i.portianyi/study/fwdays-ai-agentic-engineering/gym-challenge/openspec/changes/deploy-fly/tasks.md` (5.2) — A — пункт 5.2 залишився `[ ]`, хоча коміт `docs: deploying the game to Fly.io` (679e403) уже існує. Позначка 5.3 лежить у робочому дереві без коміту. Це лише облік.
- `/home/i.portianyi/study/fwdays-ai-agentic-engineering/gym-challenge/openspec/changes/deploy-fly/tasks.md` (1.1) — A — до тексту задачі 1.1 дописано результати виконання, і місцями вони склеєні з вимогами («not in `make check` — signing in …»). Читати важко, але змісту це не змінює.
- `/home/i.portianyi/study/fwdays-ai-agentic-engineering/gym-challenge/docs/fly-deploy.md` (розділ про відкат) — F — дві команди відкату не запускалися. Це чесно позначено в документі, але відкат не перевірено.

3. **Не видно в пакеті**
- Реальні виводи ручних сценаріїв (пробудження Machine, `fly secrets list`, збірка з `.env`, відповіді людини про Telegram). Є лише переказ у `tasks.md`.
- Поточний вміст `docs/reviews/deploy-fly.md`: задача 6.1 ще відкрита.

4. **Рішення**
- Ручні сценарії (Telegram, пробудження, секрет, `.env`) зарахував як покриті, бо design D6 заздалегідь віддав їх ручній перевірці, а результати задокументовано в `tasks.md`.
- Відсутність `5.2` у відмітках і дрібну розбіжність D6 не вважав FAIL: поведінка від них не залежить, а ризик нульовий.
- Непідтверджені команди відкату не вважав порушенням: вони позначені «ще не запускалось» і не входять до сценаріїв специфікації.
