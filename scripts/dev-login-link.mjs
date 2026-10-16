#!/usr/bin/env node
// Prints a link that opens the local app as a Telegram user, without Telegram (telegram-auth, design D9).
// The initData is signed with the fixed non-secret token `local-dev-token`, which Compose gives the app when .env
// has no TELEGRAM_BOT_TOKEN. The server has no bypass: with a real bot token the link is refused.
//
//   node scripts/dev-login-link.mjs --id 1001 --name Іван [--base http://localhost:8000]
import { createHmac } from "node:crypto";
import { parseArgs } from "node:util";

const LOCAL_TOKEN = "local-dev-token";

const { values } = parseArgs({
  options: {
    id: { type: "string" },
    name: { type: "string", default: "Тест" },
    base: { type: "string", default: "http://localhost:8000" },
  },
});

if (!values.id || !/^\d+$/.test(values.id)) {
  console.error("usage: node scripts/dev-login-link.mjs --id <telegram user id> [--name <first name>] [--base <url>]");
  process.exit(2);
}

// Telegram's algorithm: hash = hex HMAC-SHA-256(data-check-string) keyed with HMAC-SHA-256("WebAppData", token).
const fields = {
  auth_date: String(Math.floor(Date.now() / 1000)),
  user: JSON.stringify({ id: Number(values.id), first_name: values.name }),
};
const dataCheckString = Object.keys(fields)
  .sort()
  .map((key) => `${key}=${fields[key]}`)
  .join("\n");
const secret = createHmac("sha256", "WebAppData").update(LOCAL_TOKEN).digest();
const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
const initData = new URLSearchParams({ ...fields, hash }).toString();

console.log(`${values.base.replace(/\/$/, "")}/#tgWebAppData=${encodeURIComponent(initData)}&tgWebAppVersion=8.0`);
