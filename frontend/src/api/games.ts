// Hand-written to match backend/app/api/games.py (generated types are a follow-up, see add-game-setup design).
export type PlayerRef = { id: number; name: string };

/** Per-player lists have one entry per player, the creator first (add-rounds-and-scoring, D4). */
export type Points = { player_id: number; points: number };
export type Penalty = { player_id: number; reps: number };

export type Game = {
  id: number;
  creator: PlayerRef;
  opponent: PlayerRef;
  exercise: string;
  base_reps: number;
  step_reps: number;
  final_reps: number;
  status: "active" | "finished";
  score: Points[];
  winner_id: number | null;
};

export type SettledRound = {
  number: number;
  guesses: { player_id: number; value: number }[];
  actual: number;
  winner_id: number | null;
  penalty: Penalty | null;
};

/** `value` is null for the other player until both have guessed. */
export type CurrentRound = {
  number: number;
  guesses: { player_id: number; guessed: boolean; value: number | null }[];
};

export type GameDetail = Game & {
  final_penalty: Penalty | null;
  rounds: SettledRound[];
  current_round: CurrentRound | null;
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

/** GET /api/games/{id}: the game as this player sees it, or "not-found" (404, also for someone else's game). */
export async function fetchGame(playerId: number, id: number, signal?: AbortSignal): Promise<GameDetail | "not-found"> {
  const response = await fetch(`/api/games/${id}`, { signal, headers: headers(playerId) });
  if (response.status === 401) throw new UnknownPlayerError();
  if (response.status === 404) return "not-found";
  if (response.status !== 200) throw new Error(`GET /api/games/${id} answered ${response.status}`);
  return (await response.json()) as GameDetail;
}

/** A move answers the new game, or "refused" when the game's state did not allow it (409, 403). */
export type MoveResult = GameDetail | "refused";

async function move(playerId: number, id: number, kind: "guesses" | "actual", value: number): Promise<MoveResult> {
  const response = await fetch(`/api/games/${id}/${kind}`, {
    method: "POST",
    headers: headers(playerId),
    body: JSON.stringify({ value }),
  });
  if (response.status === 401) throw new UnknownPlayerError();
  if (response.status === 409 || response.status === 403) return "refused";
  if (response.status !== 200) throw new Error(`POST /api/games/${id}/${kind} answered ${response.status}`);
  return (await response.json()) as GameDetail;
}

export const sendGuess = (playerId: number, id: number, value: number) => move(playerId, id, "guesses", value);
export const sendActual = (playerId: number, id: number, value: number) => move(playerId, id, "actual", value);
