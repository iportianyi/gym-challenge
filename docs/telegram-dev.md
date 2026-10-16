# Розробка з Telegram

Як відкрити локальний застосунок як Telegram Mini App і як увійти без Telegram. Чому саме так — зміна
`telegram-auth` (`openspec/changes/telegram-auth/design.md`, D8–D9; після архівації — в `openspec/changes/archive/`).

Сервер довіряє лише `initData`, підписаним токеном бота, з яким його запущено (`TELEGRAM_BOT_TOKEN`). Обходу перевірки
в коді немає ні для localhost, ні для розробки.

## Без Telegram: посилання для входу

Без `.env` (або з порожнім `TELEGRAM_BOT_TOKEN`) Compose запускає застосунок з фіксованим несекретним токеном
`local-dev-token`. Скрипт підписує ним `initData` і друкує посилання:

```bash
docker compose up --build
node scripts/dev-login-link.mjs --id 1001 --name Іван
# http://localhost:8000/#tgWebAppData=…&tgWebAppVersion=8.0
```

- Відкрий посилання в браузері: перший вхід попросить ім'я, далі — `Мої ігри`.
- Другий гравець — інший `--id` (наприклад, `1002`) в **іншій вкладці**: вхід зберігається для вкладки
  (`sessionStorage`), тож дві вкладки — два гравці.
- Посилання дійсне 24 години. Звичайний `http://localhost:8000/` у новій вкладці показує лише
  «Відкрий Gym Challenge у Telegram».
- Якщо в `.env` вписано справжній токен бота, посилання не працює (сервер відповідає «Вхід застарів…») — так і задумано.

## У Telegram: бот для розробки й тунель ngrok

Telegram відкриває Mini App лише за HTTPS, тож до ноутбука веде тунель ngrok зі статичною адресою.

### Один раз

1. **Бот для розробки.** У [@BotFather](https://t.me/BotFather): `/newbot`, назва й username (наприклад,
   `gym_challenge_dev_bot`). BotFather дасть токен — це секрет.
2. **ngrok.** Зареєструйся на [ngrok.com](https://ngrok.com). У дашборді візьми **authtoken** (Getting Started →
   Your Authtoken) і свій безкоштовний статичний домен (Domains), вигляду `your-name.ngrok-free.app`.
3. **`.env`** у корені репозиторію — заповни вручну (файл у `.gitignore`, агент його не читає й не редагує):

   ```ini
   TELEGRAM_BOT_TOKEN=<токен бота для розробки>
   NGROK_AUTHTOKEN=<authtoken ngrok>
   NGROK_URL=your-name.ngrok-free.app
   ```

   Назви змінних — у `.env.example`.
4. **Mini App у боті.** У @BotFather: `/mybots` → бот → **Bot Settings** → **Configure Mini App** → **Enable Mini App**
   і URL `https://your-name.ngrok-free.app`. Тоді застосунок відкривається кнопкою **Open** у профілі бота й
   посиланням `t.me/<bot>?startapp`. Кнопку меню в чаті з ботом можна задати там же (**Menu Button**) на ту саму адресу.

### Щоразу

```bash
docker compose --profile tunnel up --build
```

- Відкрий бота в Telegram (на телефоні) і натисни **Open**.
- Перший вхід через ngrok показує сторінку-попередження безкоштовного тарифу — один раз натисни **Visit Site**.
- Інспектор запитів ngrok: <http://127.0.0.1:4040> (лише на цьому комп'ютері).
- Без `NGROK_AUTHTOKEN` чи `NGROK_URL` сервіс `tunnel` не стартує, а застосунок працює як звичайно.

## Якщо щось не так

| Що бачиш | Причина |
|---|---|
| «Відкрий Gym Challenge у Telegram» у Telegram | Telegram не передав `tgWebAppData`: перевір, що URL у BotFather — саме адреса тунелю з `https://` |
| «Вхід застарів…» | `initData` старший за добу або підписаний іншим ботом: токен у `.env` не від цього бота, або посилання з `dev-login-link.mjs` при справжньому токені |
| Застосунок не стартує, у логах `TELEGRAM_BOT_TOKEN is not set` | змінна порожня поза Compose (наприклад, `fastapi run` напряму) |
