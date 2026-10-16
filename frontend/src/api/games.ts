// Hand-written to match backend/app/api/games.py (generated types are a follow-up, see add-game-setup design).
import { headers, LoginRefusedError } from "./http";

export type PlayerRef = { id: number; name: string };

/** Per-player lists have one entry per player, the organizer first (add-rounds-and-scoring, D4). */
export type Points = { player_id: number; points: number };
export type Penalty = { player_id: number; reps: number; doubled: boolean };

/** A game waiting for its opponent (game-invites) has `opponent` null, `score` [] and no rounds. */
export type Game = {
  id: number;
  organizer: PlayerRef;
  opponent: PlayerRef | null;
  exercise: string;
  base_reps: number;
  step_reps: number;
  final_reps: number;
  status: "waiting" | "active" | "finished";
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
  /** The invite link, only for the organizer of a waiting game. */
  invite_url: string | null;
};

/** A game with both players: everything but a waiting game. */
export type PlayedGame = GameDetail & { opponent: PlayerRef };

export const hasOpponent = (game: GameDetail): game is PlayedGame => game.opponent !== null;

/** Without `opponent_id` the server creates an invite game. */
export type NewGame = {
  opponent_id?: number;
  exercise: string;
  base_reps: number;
  step_reps: number;
  final_reps: number;
};

export type CreateResult = { ok: true; game: Game } | { ok: false; detail: unknown };

export async function fetchGames(initData: string, signal?: AbortSignal): Promise<Game[]> {
  const response = await fetch("/api/games", { signal, headers: headers(initData) });
  if (response.status === 401) throw new LoginRefusedError();
  if (response.status !== 200) throw new Error(`GET /api/games answered ${response.status}`);
  return (await response.json()) as Game[];
}

export async function createGame(initData: string, game: NewGame): Promise<CreateResult> {
  const response = await fetch("/api/games", {
    method: "POST",
    headers: headers(initData),
    body: JSON.stringify(game),
  });
  if (response.status === 401) throw new LoginRefusedError();
  const body: unknown = await response.json().catch(() => null);
  if (response.status === 201) return { ok: true, game: body as Game };
  return { ok: false, detail: (body as { detail?: unknown } | null)?.detail };
}

/** GET /api/games/{id}: the game as this player sees it, or "not-found" (404, also for someone else's game). */
export async function fetchGame(initData: string, id: number, signal?: AbortSignal): Promise<GameDetail | "not-found"> {
  const response = await fetch(`/api/games/${id}`, { signal, headers: headers(initData) });
  if (response.status === 401) throw new LoginRefusedError();
  if (response.status === 404) return "not-found";
  if (response.status !== 200) throw new Error(`GET /api/games/${id} answered ${response.status}`);
  return (await response.json()) as GameDetail;
}

/** A move answers the new game, or "refused" when the game's state did not allow it (409, 403). */
export type MoveResult = GameDetail | "refused";

async function move(initData: string, id: number, kind: "guesses" | "actual", value: number): Promise<MoveResult> {
  const response = await fetch(`/api/games/${id}/${kind}`, {
    method: "POST",
    headers: headers(initData),
    body: JSON.stringify({ value }),
  });
  if (response.status === 401) throw new LoginRefusedError();
  if (response.status === 409 || response.status === 403) return "refused";
  if (response.status !== 200) throw new Error(`POST /api/games/${id}/${kind} answered ${response.status}`);
  return (await response.json()) as GameDetail;
}

export const sendGuess = (initData: string, id: number, value: number) => move(initData, id, "guesses", value);
export const sendActual = (initData: string, id: number, value: number) => move(initData, id, "actual", value);

/** POST /api/games/join answers the joined game, or why the invite link cannot be joined (409, 404). */
export type JoinResult = GameDetail | "used" | "not-found";

export async function joinGame(initData: string, token: string, signal?: AbortSignal): Promise<JoinResult> {
  const response = await fetch("/api/games/join", {
    method: "POST",
    signal,
    headers: headers(initData),
    body: JSON.stringify({ token }),
  });
  if (response.status === 401) throw new LoginRefusedError();
  if (response.status === 409) return "used";
  if (response.status === 404) return "not-found";
  if (response.status !== 200) throw new Error(`POST /api/games/join answered ${response.status}`);
  return (await response.json()) as GameDetail;
}
