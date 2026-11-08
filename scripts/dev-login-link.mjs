#!/usr/bin/env node
// Prints a link that opens the local app as a Telegram user, without Telegram (telegram-auth, design D9).
// The initData is signed with the fixed non-secret token `local-dev-token`, which Compose gives the app when .env
// has no TELEGRAM_BOT_TOKEN. The server has no bypass: with a real bot token the link is refused.
//
//   node scripts/dev-login-link.mjs --id 1001 --name Іван [--start <invite token>] [--base http://localhost:8000]
//
// --start opens the app as Telegram does from an invite link t.me/<bot>?startapp=<token> (game-invites, design D10):
// the token is signed inside initData as start_param and repeated in the query as tgWebAppStartParam.
import { parseArgs } from "node:util";

import { userInitData } from "./telegram-init-data.mjs";

const { values } = parseArgs({
  options: {
    id: { type: "string" },
    name: { type: "string", default: "Тест" },
    start: { type: "string" },
    base: { type: "string", default: "http://localhost:8000" },
  },
});

if (!values.id || !/^\d+$/.test(values.id)) {
  console.error(
    "usage: node scripts/dev-login-link.mjs --id <telegram user id> [--name <first name>] [--start <token>] [--base <url>]",
  );
  process.exit(2);
}
// Telegram's limits for startapp.
if (values.start !== undefined && !/^[A-Za-z0-9_-]{1,512}$/.test(values.start)) {
  console.error("--start: 1-512 characters of A-Z a-z 0-9 _ -");
  process.exit(2);
}

// Signed with LOCAL_TOKEN (telegram-init-data.mjs), shared with hosting-check.mjs.
const initData = userInitData({ id: values.id, name: values.name, start: values.start });

const query = values.start !== undefined ? `?tgWebAppStartParam=${values.start}` : "";
console.log(
  `${values.base.replace(/\/$/, "")}/${query}#tgWebAppData=${encodeURIComponent(initData)}&tgWebAppVersion=8.0`,
);
