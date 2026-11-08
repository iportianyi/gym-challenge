**Вердикт** — ACCEPT
A — PASS — у diff лише `invites.py`, `main.py`, `PlayerSession` і нові файли екрана запрошення, тести та артефакти зміни. `.claude/`, хуки, `.mcp.json`, `Makefile`, `CLAUDE.md` і залежності не зачеплені.
B — PASS — усі 7 сценаріїв ендпоїнта мають тести з точними статусами й тілами (`test_invites.py`). Усі веб-сценарії покриті в `Invites.test.tsx` та `game/invite.test.ts`. Вимога вносить 7 сценаріїв ендпоїнта й 11 веб-сценаріїв (2 екрана, 7 запуску, 5 помилок, з урахуванням змінених і нових).
C — PASS — тести не видалені й не пропущені. Сценарії «Link already used» та «Unknown link» переписані зі стабу join на стаб preview, як вимагає дельта-специфікація; дані й ролі збережені. Червоний коміт зафіксовано окремо (7 і 12 падінь).
D — PASS — маршрут `POST /api/invites/preview` з токеном у тілі, `TelegramUserDep`, обчислення ролі, `Promise.all` для `/api/me` і preview, окремий `InviteScreen` та чиста `inviteLines` з `WINNING_SCORE` відповідають design D1–D4. Окремого стану `previewing` немає (використано `loading`), але це не суперечить суті D2.
E — PASS — коміти за Conventional Commits англійською, `Co-Authored-By` присутній, UI українською, секретів у diff немає. `make check` закінчується рядком `check: OK (backend, frontend, spec, secrets)`; pytest 136 passed, Vitest 117 passed.
F — PASS — логіка ролей і кодів 404/409/401 відповідає специфікації. Маршрут підключено до fallback `/api`, тож він не перехоплюється. Токен лишається в тілі запиту.

**Знахідки**
- `/home/i.portianyi/study/fwdays-ai-agentic-engineering/gym-challenge/openspec/changes/invite-preview-accept/design.md:39` — D — D2 описує стан `previewing`, а в коді його немає (паралельне читання в `loading` через `Promise.all`). Відхилення згадане лише в tasks.md 3.2, не в design.md. Незначна знахідка.
- `/home/i.portianyi/study/fwdays-ai-agentic-engineering/gym-challenge/frontend/src/components/PlayerSession.tsx:750` — F — ролі `organizer`/`opponent` без гравця (`player === null`) потрапляють на екран запрошення. На практиці це недосяжно, бо бекенд не дає такої ролі без гравця, а тест цього не покриває. Незначна знахідка.

**Не видно в пакеті**
- Тіла тестів у `Invites.test.tsx` для сценаріїв «Registered player opens the link» і «Link already used» видно лише частково (дифф-контекст). Це не блокує вердикт.
- Задачі 5.1 і 5.2 ще не закриті (збереження рев'ю в `docs/reviews/`, цитата рядка `make check`). Це очікувано для цього етапу.

**Рішення**
- Відсутність `previewing` у коді порахував несуттєвим відхиленням від design D2 (поведінка та сама), тому D лишається PASS.
- Ручні перевірки (Playwright, Fly.io, другий акаунт Telegram) прийняв зі слів tasks.md: у пакеті їх немає, а на вердикт вони не впливають.
