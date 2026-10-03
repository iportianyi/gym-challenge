import type { GameDetail, Penalty, SettledRound } from "../api/games";

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

export type RoundView = {
  number: number;
  actual: string;
  /** Mine first: "Ти: 40 · відстань 7", then "<name>: 55 · відстань 8". */
  guesses: [string, string];
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
  card: RoundView | null;
  /** Every settled round, newest first. */
  history: RoundView[];
  end: { headline: string; penalty: string | null } | null;
};

export function penaltyText(penalty: Penalty, me: number, exercise: string): string {
  const what = `${exercise} × ${penalty.reps}`;
  return penalty.player_id === me ? `Твоє покарання: ${what}` : `Покарання суперника: ${what}`;
}

export function viewGame(game: GameDetail, me: number): GameView {
  const other = game.creator.id === me ? game.opponent : game.creator;
  const pointsOf = (id: number) => game.score.find((entry) => entry.player_id === id)?.points ?? 0;

  const viewRound = (round: SettledRound): RoundView => {
    const guessOf = (id: number) => round.guesses.find((guess) => guess.player_id === id)?.value ?? 0;
    const line = (label: string, value: number) => `${label}: ${value} · відстань ${Math.abs(value - round.actual)}`;
    return {
      number: round.number,
      actual: `Реальна кількість: ${round.actual}`,
      guesses: [line("Ти", guessOf(me)), line(other.name, guessOf(other.id))],
      outcome:
        round.winner_id === null
          ? "Нічия"
          : round.winner_id === me
            ? "Раунд твій"
            : `Переможець раунду — ${other.name}`,
      penalty: round.penalty === null ? null : penaltyText(round.penalty, me, game.exercise),
    };
  };

  const current = game.status === "finished" ? null : game.current_round;
  const nobodyGuessed = current === null || current.guesses.every((entry) => !entry.guessed);
  const last = game.rounds.at(-1);

  return {
    title: `Гра: ${game.exercise}`,
    otherName: other.name,
    myPoints: pointsOf(me),
    theirPoints: pointsOf(other.id),
    phase: phaseOf(game, me, other.id),
    card: last !== undefined && nobodyGuessed ? viewRound(last) : null,
    history: game.rounds.map(viewRound).reverse(),
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
function phaseOf(game: GameDetail, me: number, otherId: number): Phase {
  const current = game.current_round;
  if (game.status === "finished" || current === null) return { kind: "over" };
  const mine = current.guesses.find((entry) => entry.player_id === me);
  const theirs = current.guesses.find((entry) => entry.player_id === otherId);
  const round = current.number;
  if (!mine?.guessed) return { kind: "guess", round, otherGuessed: theirs?.guessed ?? false };
  if (!theirs?.guessed) return { kind: "wait-guess", round, mine: mine.value ?? 0 };
  const values = { round, mine: mine.value ?? 0, theirs: theirs.value ?? 0 };
  return game.creator.id === me ? { kind: "enter-actual", ...values } : { kind: "wait-actual", ...values };
}
