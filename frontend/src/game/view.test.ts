// The phase table (design D4) and the wording (design D7) of add-game-screen, without rendering.
import { describe, expect, it } from "vitest";

import type { GameDetail } from "../api/games";
import { viewGame } from "./view";

type Entry = number | "hidden" | null;
const entry = (playerId: number, value: Entry) => ({
  player_id: playerId,
  guessed: value !== null,
  value: typeof value === "number" ? value : null,
});

function game(overrides: Partial<GameDetail> = {}): GameDetail {
  return {
    id: 1,
    creator: { id: 1, name: "Клієнт" },
    opponent: { id: 2, name: "Тренер" },
    exercise: "Присідання",
    base_reps: 10,
    step_reps: 5,
    final_reps: 30,
    status: "active",
    score: [
      { player_id: 1, points: 0 },
      { player_id: 2, points: 0 },
    ],
    winner_id: null,
    final_penalty: null,
    rounds: [],
    current_round: { number: 1, guesses: [entry(1, null), entry(2, null)] },
    ...overrides,
  };
}

const inRound = (creator: Entry, opponent: Entry) =>
  game({ current_round: { number: 1, guesses: [entry(1, creator), entry(2, opponent)] } });

const ROUND_1 = {
  number: 1,
  guesses: [
    { player_id: 1, value: 40 },
    { player_id: 2, value: 55 },
  ],
  actual: 47,
  winner_id: 1,
  penalty: { player_id: 2, reps: 10 },
};

describe("phase table", () => {
  it("nobody guessed: guess, the other has not guessed", () => {
    expect(viewGame(inRound(null, null), 1).phase).toEqual({ kind: "guess", round: 1, otherGuessed: false });
  });

  it("only the other guessed: guess, the other has guessed", () => {
    expect(viewGame(inRound(null, "hidden"), 1).phase).toEqual({ kind: "guess", round: 1, otherGuessed: true });
  });

  it("only I guessed: wait for the other's guess", () => {
    expect(viewGame(inRound(47, null), 1).phase).toEqual({ kind: "wait-guess", round: 1, mine: 47 });
  });

  it("both guessed, creator: enter the actual count", () => {
    expect(viewGame(inRound(40, 55), 1).phase).toEqual({ kind: "enter-actual", round: 1, mine: 40, theirs: 55 });
  });

  it("both guessed, opponent: wait for the actual count", () => {
    expect(viewGame(inRound(40, 55), 2).phase).toEqual({ kind: "wait-actual", round: 1, mine: 55, theirs: 40 });
  });

  it("finished: over", () => {
    expect(viewGame(game({ status: "finished", winner_id: 1, current_round: null }), 1).phase).toEqual({
      kind: "over",
    });
  });
});

describe("result card", () => {
  const settled = (round2: [Entry, Entry]) =>
    game({ rounds: [ROUND_1], current_round: { number: 2, guesses: [entry(1, round2[0]), entry(2, round2[1])] } });

  it("is the last round while nobody has guessed in the next one", () => {
    expect(viewGame(settled([null, null]), 1).card?.number).toBe(1);
  });

  it("is gone once anyone has guessed", () => {
    expect(viewGame(settled([null, "hidden"]), 1).card).toBeNull();
    expect(viewGame(settled([47, null]), 1).card).toBeNull();
  });

  it("is the last round of a finished game", () => {
    const over = game({ status: "finished", winner_id: 1, rounds: [ROUND_1], current_round: null });
    expect(viewGame(over, 1).card?.number).toBe(1);
  });

  it("does not exist before the first round is settled", () => {
    expect(viewGame(game(), 1).card).toBeNull();
  });
});

describe("wording without gender or declension", () => {
  const view = (me: number) => viewGame(game({ rounds: [ROUND_1], current_round: null }), me);

  it("the round winner reads their own win", () => {
    expect(view(1).history[0]).toEqual({
      number: 1,
      actual: "Реальна кількість: 47",
      guesses: ["Ти: 40 · відстань 7", "Тренер: 55 · відстань 8"],
      outcome: "Раунд твій",
      penalty: "Покарання суперника: Присідання × 10",
    });
  });

  it("the round loser reads the winner's name and their own penalty", () => {
    expect(view(2).history[0]).toMatchObject({
      guesses: ["Ти: 55 · відстань 8", "Клієнт: 40 · відстань 7"],
      outcome: "Переможець раунду — Клієнт",
      penalty: "Твоє покарання: Присідання × 10",
    });
  });

  it("a draw has no penalty", () => {
    const draw = { ...ROUND_1, guesses: [ROUND_1.guesses[0], { player_id: 2, value: 54 }], winner_id: null, penalty: null };
    expect(viewGame(game({ rounds: [draw] }), 1).history[0]).toMatchObject({ outcome: "Нічия", penalty: null });
  });

  it("the end of the game for the winner and the loser", () => {
    const over = game({
      status: "finished",
      winner_id: 1,
      final_penalty: { player_id: 2, reps: 30 },
      current_round: null,
    });
    expect(viewGame(over, 1).end).toEqual({
      headline: "Твоя перемога",
      penalty: "Покарання суперника: Присідання × 30",
    });
    expect(viewGame(over, 2).end).toEqual({ headline: "Переможець — Клієнт", penalty: "Твоє покарання: Присідання × 30" });
  });

  it("the score and history are from the viewer's side, history newest first", () => {
    const round2 = { ...ROUND_1, number: 2, winner_id: 2, penalty: { player_id: 1, reps: 10 } };
    const both = game({
      score: [
        { player_id: 1, points: 1 },
        { player_id: 2, points: 1 },
      ],
      rounds: [ROUND_1, round2],
    });
    const seen = viewGame(both, 2);
    expect([seen.myPoints, seen.theirPoints, seen.otherName]).toEqual([1, 1, "Клієнт"]);
    expect(seen.history.map((round) => round.number)).toEqual([2, 1]);
  });
});
