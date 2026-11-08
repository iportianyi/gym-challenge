# Гра на Fly.io

Гра для справжніх ігор живе на **https://gym-challenge.fly.dev** і відкривається з бота
[`gym_challenge_iport_bot`](https://t.me/gym_challenge_iport_bot). Ноутбук для цього не потрібен. Локальна розробка
й бот розробки з тунелем ngrok — окремо, у [`telegram-dev.md`](telegram-dev.md).

Як це влаштовано (зміна `deploy-fly`, рішення — у її `design.md`):

- застосунок `gym-challenge`, регіон `fra` (Франкфурт), одна Machine з етапу `runtime` того самого `Dockerfile`;
- SQLite — на Volume `gym_challenge_data` (1 GB), змонтованому в `/app/data`; переживає деплої й перезапуски;
- Machine зупиняється без запитів і запускається першим запитом (кілька секунд);
- усе, крім токена бота, — у `fly.toml` у корені репозиторію;
- **токен бота гри — лише у `fly secrets`**: ні в репозиторії, ні в `.env`, ні в командах, ні в контексті збірки
  (`.dockerignore` відкидає `.env*`, бо `fly deploy` завантажує контекст на збирач Fly).

## flyctl — через Docker

На хості `flyctl` не встановлюємо. Кожна команда нижче — це

```bash
docker compose --profile deploy run --rm fly <команда>
```

Образ `flyio/flyctl` зафіксований у `docker-compose.yml`, логін зберігається в Docker volume `fly-home`
(`docker volume rm gym-challenge_fly-home` — вийти). Нижче для стислості — `fly <команда>`.

## Один раз

Уже зроблено 2026-11-08; повторювати — лише для нового акаунта чи нового застосунку.

1. **Акаунт** на fly.io з карткою.
2. **Логін**: `fly auth login` — друкує посилання, відкрий його в браузері й підтверди. Перевірка: `fly auth whoami`.
3. **Бот гри** у [@BotFather](https://t.me/BotFather): `/newbot` (у нас `gym_challenge_iport_bot`). Токен — секрет.
4. **Застосунок і Volume** (платні ресурси):

   ```bash
   fly apps create gym-challenge
   fly volumes create gym_challenge_data --app gym-challenge --region fra --size 1
   ```

   На попередження про один Volume без резерву — `y` (свідомо прийнято в `docs/spec.md`: щоденні снапшоти).
5. **Токен** — ввести самому, не в команді:

   ```bash
   fly secrets import --app gym-challenge --stage
   ```

   Вставити рядок `TELEGRAM_BOT_TOKEN=<токен>`, Enter, Ctrl-D. `--stage` — поки немає Machine; після першого
   деплою без нього секрет одразу перезапускає Machine. Перевірка (лише назви): `fly secrets list --app gym-challenge`.
6. **Перший деплой** — як у розділі «Кожен деплой».
7. **Mini App у боті**: @BotFather → `/mybots` → `gym_challenge_iport_bot` → **Bot Settings** → **Configure Mini App**
   → **Enable Mini App** з URL `https://gym-challenge.fly.dev`; там же **Menu Button** з тією самою адресою.
   Запрошення `t.me/gym_challenge_iport_bot?startapp=…` працюють лише з Main Mini App.

## Кожен деплой

Після коміту, з чистим робочим деревом:

```bash
fly deploy --remote-only --app gym-challenge
node scripts/hosting-check.mjs
```

`--remote-only` — образ збирає Fly, локальний Docker-демон для цього не потрібен. Міграції бази виконуються самі під
час старту застосунку. `hosting-check.mjs` перевіряє живий застосунок: health по HTTPS, перенаправлення з http, сторінку
застосунку, що вхід, підписаний `local-dev-token`, відхиляється (`401`), і що `fly.toml` не містить токена.
Успіх закінчується рядком `hosting-check: OK (https://gym-challenge.fly.dev)`.

Корисне:

| Що | Команда |
|---|---|
| Стан Machine і перевірки | `fly status --app gym-challenge` |
| Machine й стан | `fly machine list --app gym-challenge` |
| Журнал | `fly logs --app gym-challenge --no-tail` |
| Подивитися базу на Volume | `fly ssh console --app gym-challenge -C "ls -la /app/data"` |
| Зупинити Machine (наступний запит запустить) | `fly machine stop <id> --app gym-challenge` |
| Релізи й образи | `fly releases --app gym-challenge --image` |
| Снапшоти Volume | `fly volumes snapshots list <volume id> --app gym-challenge` |

## Якщо деплой зламав гру

Ще **не запускалось** у `deploy-fly` — перевірити, коли знадобиться:

- **Реліз без нової міграції** — повернути попередній образ (з `fly releases --image`):
  `fly deploy --app gym-challenge --image <docker image попереднього релізу>`.
- **Реліз з міграцією** — старий код може не прочитати нову схему: відновити Volume з останнього снапшота (новий
  Volume з `--snapshot-id`, див. `fly volumes create --help`) і задеплоїти попередній образ.

Снапшоти Fly робить щодня; між ними можна втратити до доби раундів — ризик прийнято в `docs/spec.md`.

## Якщо щось не так

| Симптом | Причина |
|---|---|
| `lookup … i/o timeout` у `fly` | DNS у контейнерах Docker працює лише з увімкненим VPN (`CLAUDE.md`) |
| `no access token available` | немає логіну в volume `fly-home`: `fly auth login` |
| У Telegram «Відкрий Gym Challenge у Telegram» | у @BotFather Mini App не на `https://gym-challenge.fly.dev` |
| Будь-який вхід — «Вхід застарів…» | секрет `TELEGRAM_BOT_TOKEN` не від `gym_challenge_iport_bot` |
| Перше відкриття довге | Machine запускалась після простою, це кілька секунд |
