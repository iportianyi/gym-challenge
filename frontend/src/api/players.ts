// Hand-written to match backend/app/api/players.py (generated types are a follow-up, see add-game-setup design).
export type Player = { id: number; name: string; email: string };

/** GET /api/players; throws on any non-200 answer or a body that is not a list. */
export async function fetchPlayers(signal?: AbortSignal): Promise<Player[]> {
  const response = await fetch("/api/players", { signal, headers: { Accept: "application/json" } });
  const body: unknown = response.status === 200 ? await response.json() : null;
  if (!Array.isArray(body)) throw new Error(`GET /api/players answered ${response.status}`);
  return body as Player[];
}
