// Hand-written to match backend/app/api/games.py (generated types are a follow-up, see add-game-setup design).
export type PlayerRef = { id: number; name: string };

export type Game = {
  id: number;
  creator: PlayerRef;
  opponent: PlayerRef;
  exercise: string;
  base_reps: number;
  step_reps: number;
  final_reps: number;
  status: "active";
};

export type NewGame = {
  opponent_email: string;
  exercise: string;
  base_reps: number;
  step_reps: number;
  final_reps: number;
};

/** The server did not accept X-Player-Id (401): the remembered player must be chosen again. */
export class UnknownPlayerError extends Error {}

export type CreateResult = { ok: true; game: Game } | { ok: false; detail: unknown };

function headers(playerId: number): HeadersInit {
  return { Accept: "application/json", "Content-Type": "application/json", "X-Player-Id": String(playerId) };
}

export async function fetchGames(playerId: number, signal?: AbortSignal): Promise<Game[]> {
  const response = await fetch("/api/games", { signal, headers: headers(playerId) });
  if (response.status === 401) throw new UnknownPlayerError();
  if (response.status !== 200) throw new Error(`GET /api/games answered ${response.status}`);
  return (await response.json()) as Game[];
}

export async function createGame(playerId: number, game: NewGame): Promise<CreateResult> {
  const response = await fetch("/api/games", {
    method: "POST",
    headers: headers(playerId),
    body: JSON.stringify(game),
  });
  if (response.status === 401) throw new UnknownPlayerError();
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 201) return { ok: true, game: body as Game };
  return { ok: false, detail: (body as { detail?: unknown } | null)?.detail };
}
