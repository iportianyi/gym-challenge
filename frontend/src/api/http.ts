/** The server refused the Telegram login (401): it is missing, forged or older than a day. */
export class LoginRefusedError extends Error {}

/** Every API request except the health check carries the Telegram login (telegram-auth). */
export function headers(initData: string): HeadersInit {
  return { Accept: "application/json", "Content-Type": "application/json", Authorization: `tma ${initData}` };
}
