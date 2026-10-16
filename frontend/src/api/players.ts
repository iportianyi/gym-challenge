// Hand-written to match backend/app/api/players.py (generated types are a follow-up, see add-game-setup design).
import { headers, LoginRefusedError } from "./http";

export type Player = { id: number; name: string };

/** GET /api/me: the player of this login, or "not-registered" before the first name is chosen. */
export async function fetchMe(initData: string, signal?: AbortSignal): Promise<Player | "not-registered"> {
  const response = await fetch("/api/me", { signal, headers: headers(initData) });
  if (response.status === 401) throw new LoginRefusedError();
  if (response.status === 404) return "not-registered";
  if (response.status !== 200) throw new Error(`GET /api/me answered ${response.status}`);
  return (await response.json()) as Player;
}

/** POST /api/me: the new player, or the status the server refused it with (409 registered, 422 bad name). */
export async function registerMe(initData: string, name: string): Promise<Player | number> {
  const response = await fetch("/api/me", { method: "POST", headers: headers(initData), body: JSON.stringify({ name }) });
  if (response.status === 401) throw new LoginRefusedError();
  if (response.status !== 201) return response.status;
  return (await response.json()) as Player;
}

/** GET /api/players: every other player, for choosing an opponent (temporary until invitations). */
export async function fetchPlayers(initData: string, signal?: AbortSignal): Promise<Player[]> {
  const response = await fetch("/api/players", { signal, headers: headers(initData) });
  if (response.status === 401) throw new LoginRefusedError();
  const body: unknown = response.status === 200 ? await response.json() : null;
  if (!Array.isArray(body)) throw new Error(`GET /api/players answered ${response.status}`);
  return body as Player[];
}
