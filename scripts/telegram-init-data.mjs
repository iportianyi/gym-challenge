// Signs Telegram Mini App initData the way Telegram does, for scripts that log in without Telegram:
// dev-login-link.mjs (telegram-auth, design D9) and hosting-check.mjs (deploy-fly).
import { createHmac } from "node:crypto";

/** The fixed non-secret token Compose gives the local app when .env has no TELEGRAM_BOT_TOKEN. */
export const LOCAL_TOKEN = "local-dev-token";

/**
 * Returns initData as a query string: the given fields plus `hash`.
 * Telegram's algorithm: hash = hex HMAC-SHA-256(data-check-string) keyed with HMAC-SHA-256("WebAppData", token),
 * where the data-check-string is the fields sorted by key as `key=value` lines.
 */
export function signInitData(fields, token = LOCAL_TOKEN) {
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

/** initData for a user `{id, first_name}` at the current time, optionally with a start_param. */
export function userInitData({ id, name, start }, token = LOCAL_TOKEN) {
  return signInitData(
    {
      auth_date: String(Math.floor(Date.now() / 1000)),
      user: JSON.stringify({ id: Number(id), first_name: name }),
      ...(start !== undefined && { start_param: start }),
    },
    token,
  );
}
