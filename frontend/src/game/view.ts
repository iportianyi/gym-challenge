import type { Penalty, PlayedGame, SettledRound } from "../api/games";

/**
 * What the game screen shows, from one API answer and the viewer's id (add-game-screen, D4). All words are built
 * here (D7): no grammatical gender and no declined names or exercise — possessives, nominatives, "label: value".
 */
export type Phase =
  | { kind: "guess"; round: number; otherGuessed: boolean }
  | { kind: "wait-guess"; round: number; mine: number }
  | { kind: "enter-actual"; round: number; mine: number; theirs: number }
  | { kind: "wait-actual"; round: number; mine: number; theirs: number }
  | { kind: "over" };

/** One guess in the result card: "Ти: 40 · відстань 7", or "Тренер: 47 · точно" for an exact one. */
export type GuessLine = { text: string; exact: boolean };

/** The round just settled, read outcome first (clarify-round-and-result, D1–D3). */
export type CardView = {
  number: number;
  outcome: string;
  penalty: string | null;
  actual: string;
  /** Mine first. */
  guesses: [GuessLine, GuessLine];
};

/** A settled round in the history, without distances: "Раунд 2 · у залі 47", "Ти 50 · Тренер 47 (точно)". */
export type HistoryItem = {
  number: number;
  title: string;
  guesses: string;
  outcome: string;
  penalty: string | null;
};

export type GameView = {
  title: string;
  otherName: string;
  myPoints: number;
  theirPoints: number;
  phase: Phase;
  /** The round just settled, while nobody has guessed in the next one or the game is over. */
  card: CardView | null;
  /** Every settled round except the card's, newest first. */
  history: HistoryItem[];
  end: { headline: string; penalty: string | null } | null;
};

/** The backend's `EXACT_MULTIPLIER` (backend/app/rules.py): an exact winning guess doubles the penalty. */
const EXACT_MULTIPLIER = 2;

// No-break spaces keep "× 10" with the exercise and the mark in one piece on a narrow phone screen (D4).
const NBSP = "\u00a0";

export function penaltyText(penalty: Penalty, me: number, exercise: string): string {
  const mark = penalty.doubled
    ? ` (${penalty.reps / EXACT_MULTIPLIER}${NBSP}×${EXACT_MULTIPLIER}${NBSP}за точне влучання)`
    : "";
  const what = `${exercise}${NBSP}×${NBSP}${penalty.reps}${mark}`;
  return penalty.player_id === me ? `Твоє покарання: ${what}` : `Покарання суперника: ${what}`;
}

/** Only for a game with both players; the screen of a waiting game is drawn apart (game-invites). */
export function viewGame(game: PlayedGame, me: number): GameView {
  const other = game.organizer.id === me ? game.opponent : game.organizer;
  const pointsOf = (id: number) => game.score.find((entry) => entry.player_id === id)?.points ?? 0;

  const guessOf = (round: SettledRound, id: number) =>
    round.guesses.find((guess) => guess.player_id === id)?.value ?? 0;
  const outcomeOf = (round: SettledRound) =>
    round.winner_id === null ? "Нічия" : round.winner_id === me ? "Раунд твій" : `Переможець раунду — ${other.name}`;
  const penaltyOf = (round: SettledRound) =>
    round.penalty === null ? null : penaltyText(round.penalty, me, game.exercise);

  const cardOf = (round: SettledRound): CardView => {
    const line = (label: string, value: number): GuessLine => {
      const exact = value === round.actual;
      return { text: `${label}: ${value} · ${exact ? "точно" : `відстань ${Math.abs(value - round.actual)}`}`, exact };
    };
    return {
      number: round.number,
      outcome: outcomeOf(round),
      penalty: penaltyOf(round),
      actual: `Реальна кількість: ${round.actual}`,
      guesses: [line("Ти", guessOf(round, me)), line(other.name, guessOf(round, other.id))],
    };
  };

  const historyOf = (round: SettledRound): HistoryItem => {
    const part = (label: string, value: number) => `${label} ${value}${value === round.actual ? " (точно)" : ""}`;
    return {
      number: round.number,
      title: `Раунд ${round.number} · у залі ${round.actual}`,
      guesses: `${part("Ти", guessOf(round, me))} · ${part(other.name, guessOf(round, other.id))}`,
      outcome: outcomeOf(round),
      penalty: penaltyOf(round),
    };
  };

  const current = game.status === "finished" ? null : game.current_round;
  const nobodyGuessed = current === null || current.guesses.every((entry) => !entry.guessed);
  const last = game.rounds.at(-1);
  // One rule decides both: the card shows the last round, and the history leaves it out while it does (D1).
  const card = last !== undefined && nobodyGuessed ? last : null;

  return {
    title: `Гра: ${game.exercise}`,
    otherName: other.name,
    myPoints: pointsOf(me),
    theirPoints: pointsOf(other.id),
    phase: phaseOf(game, me, other.id),
    card: card === null ? null : cardOf(card),
    history: game.rounds
      .filter((round) => round !== card)
      .map(historyOf)
      .reverse(),
    end:
      game.status === "finished" && game.winner_id !== null
        ? {
            headline: game.winner_id === me ? "Твоя перемога" : `Переможець — ${other.name}`,
            penalty: game.final_penalty === null ? null : penaltyText(game.final_penalty, me, game.exercise),
          }
        : null,
  };
}

/** The phase table of design D4. */
function phaseOf(game: PlayedGame, me: number, otherId: number): Phase {
  const current = game.current_round;
  if (game.status === "finished" || current === null) return { kind: "over" };
  const mine = current.guesses.find((entry) => entry.player_id === me);
  const theirs = current.guesses.find((entry) => entry.player_id === otherId);
  const round = current.number;
  if (!mine?.guessed) return { kind: "guess", round, otherGuessed: theirs?.guessed ?? false };
  if (!theirs?.guessed) return { kind: "wait-guess", round, mine: mine.value ?? 0 };
  const values = { round, mine: mine.value ?? 0, theirs: theirs.value ?? 0 };
  return game.organizer.id === me ? { kind: "enter-actual", ...values } : { kind: "wait-actual", ...values };
}
