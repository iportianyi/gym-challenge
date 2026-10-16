// Test helpers for the Telegram login (openspec/changes/telegram-auth/specs/telegram-auth/spec.md).

/** The test `initData` of the spec: `t1` is Telegram user 1001 «Іван», `t2` user 1002 «Тренер». Never checked here. */
export const T1 = "user=%7B%22id%22%3A1001%2C%22first_name%22%3A%22%D0%86%D0%B2%D0%B0%D0%BD%22%7D&hash=t1";
export const T2 = "user=%7B%22id%22%3A1002%2C%22first_name%22%3A%22%D0%A2%D1%80%D0%B5%D0%BD%D0%B5%D1%80%22%7D&hash=t2";

/** `t2s` of the invites spec: `t2` launched from an invite link, with `start_param=Abc_123-xyz` before `hash`. */
export const T2S = T2.replace("&hash=t2", "&start_param=Abc_123-xyz&hash=t2");

const INIT_DATA: Record<number, string> = { 1: T1, 2: T2 };
const PLAYER_OF: Record<string, { id: number; name: string }> = {
  [`tma ${T1}`]: { id: 1, name: "Клієнт" },
  [`tma ${T2}`]: { id: 2, name: "Тренер" },
  [`tma ${T2S}`]: { id: 2, name: "Тренер" },
};

/** The `Authorization` header the app sends as player `number`. */
export const tma = (number: number) => `tma ${INIT_DATA[number]}`;

/** Puts the address the Telegram client opens: `path` with the launch parameters of player `number`. */
export function openInTelegram(path: string, number: number) {
  const launch = `tgWebAppData=${encodeURIComponent(INIT_DATA[number])}&tgWebAppVersion=8.0`;
  window.history.replaceState(null, "", `${path}#${launch}`);
}

/** Puts the address Telegram opens for a launch with this raw `initData` (e.g. `T2S` from an invite link). */
export function launchWith(path: string, initData: string) {
  window.history.replaceState(null, "", `${path}#tgWebAppData=${encodeURIComponent(initData)}&tgWebAppVersion=8.0`);
}

/** A fresh browser tab at `/`: nothing kept for the tab, no launch parameters. */
export function freshTab() {
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
}

export const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export type MeOptions = {
  /** `GET /api/me`: the player of the header (default), not registered, or no connection. */
  me?: "known" | "unregistered" | "network";
  /** `POST /api/me` answer; by default `201` with the posted name as player 1. */
  register?: [number, unknown];
};

/**
 * Answers `/api/me` the way the server would for the test logins, or returns `null` for any other URL.
 * Throws a network error for `me: "network"`.
 */
export function answerMe(url: string, method: string, headers: Headers, body: unknown, options: MeOptions = {}) {
  if (url !== "/api/me") return null;
  if (method === "POST") {
    const [status, answer] = options.register ?? [201, { id: 1, name: (body as { name: string }).name }];
    return jsonResponse(status, answer);
  }
  if (options.me === "network") throw new TypeError("Failed to fetch");
  if (options.me === "unregistered") return jsonResponse(404, { detail: "Not registered" });
  const player = PLAYER_OF[headers.get("Authorization") ?? ""];
  return player ? jsonResponse(200, player) : jsonResponse(401, { detail: "Invalid Telegram login" });
}

/** The answer to `POST /api/games/join`: a status and body, or no connection. */
export type JoinAnswer = [number, unknown] | "network";

/** Answers `POST /api/games/join` with `answer`, or returns `null` for any other request. */
export function answerJoin(url: string, method: string, answer: JoinAnswer) {
  if (url !== "/api/games/join" || method !== "POST") return null;
  if (answer === "network") throw new TypeError("Failed to fetch");
  return jsonResponse(answer[0], answer[1]);
}
