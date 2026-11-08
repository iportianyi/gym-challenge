// The phase table (design D4) and the wording (design D7) of add-game-screen, and the card and history of
// clarify-round-and-result (D1, D3, D4), without rendering.
import { describe, expect, it } from "vitest";

import type { PlayedGame } from "../api/games";
import { viewGame } from "./view";

type Entry = number | "hidden" | null;
const entry = (playerId: number, value: Entry) => ({
  player_id: playerId,
  guessed: value !== null,
  value: typeof value === "number" ? value : null,
});

function game(overrides: Partial<PlayedGame> = {}): PlayedGame {
  return {
    id: 1,
    organizer: { id: 1, name: "Клієнт" },
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
    invite_url: null,
    ...overrides,
  };
}

const inRound = (organizer: Entry, opponent: Entry) =>
  game({ current_round: { number: 1, guesses: [entry(1, organizer), entry(2, opponent)] } });

const ROUND_1 = {
  number: 1,
  guesses: [
    { player_id: 1, value: 40 },
    { player_id: 2, value: 55 },
  ],
  actual: 47,
  winner_id: 1,
  penalty: { player_id: 2, reps: 10, doubled: false },
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

  it("both guessed, organizer: enter the actual count", () => {
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

  it("leaves its round out of the history", () => {
    expect(viewGame(settled([null, null]), 1).history).toEqual([]);
    expect(viewGame(settled([null, "hidden"]), 1).history.map((round) => round.number)).toEqual([1]);
  });
});

describe("wording without gender or declension", () => {
  const view = (me: number) => viewGame(game({ rounds: [ROUND_1], current_round: null }), me);

  it("the round winner reads their own win", () => {
    expect(view(1).card).toEqual({
      number: 1,
      outcome: "Раунд твій",
      penalty: "Покарання суперника: Присідання\u00a0×\u00a010",
      actual: "Реальна кількість: 47",
      guesses: [
        { text: "Ти: 40 · відстань 7", exact: false },
        { text: "Тренер: 55 · відстань 8", exact: false },
      ],
    });
  });

  it("the round loser reads the winner's name and their own penalty", () => {
    expect(view(2).card).toMatchObject({
      outcome: "Переможець раунду — Клієнт",
      penalty: "Твоє покарання: Присідання\u00a0×\u00a010",
      guesses: [
        { text: "Ти: 55 · відстань 8", exact: false },
        { text: "Клієнт: 40 · відстань 7", exact: false },
      ],
    });
  });

  it("a draw has no penalty", () => {
    const draw = { ...ROUND_1, guesses: [ROUND_1.guesses[0], { player_id: 2, value: 54 }], winner_id: null, penalty: null };
    expect(viewGame(game({ rounds: [draw] }), 1).card).toMatchObject({ outcome: "Нічия", penalty: null });
  });

  it("an exact guess reads точно in the card and in the history", () => {
    const exact = { ...ROUND_1, guesses: [{ player_id: 1, value: 50 }, { player_id: 2, value: 47 }], winner_id: 2 };
    const seen = viewGame(game({ rounds: [exact] }), 1);
    expect(seen.card?.guesses).toEqual([
      { text: "Ти: 50 · відстань 3", exact: false },
      { text: "Тренер: 47 · точно", exact: true },
    ]);
    const round2 = { number: 2, guesses: [entry(1, 1), entry(2, null)] };
    const later = viewGame(game({ rounds: [exact], current_round: round2 }), 1);
    expect(later.history[0]).toMatchObject({ title: "Раунд 1 · у залі 47", guesses: "Ти 50 · Тренер 47 (точно)" });
  });

  it("the end of the game for the winner and the loser", () => {
    const over = game({
      status: "finished",
      winner_id: 1,
      final_penalty: { player_id: 2, reps: 30, doubled: false },
      current_round: null,
    });
    expect(viewGame(over, 1).end).toEqual({
      headline: "Твоя перемога",
      penalty: "Покарання суперника: Присідання\u00a0×\u00a030",
    });
    expect(viewGame(over, 2).end).toEqual({
      headline: "Переможець — Клієнт",
      penalty: "Твоє покарання: Присідання\u00a0×\u00a030",
    });
  });

  it("a doubled penalty ends with the mark and its base", () => {
    const exact = { ...ROUND_1, penalty: { player_id: 2, reps: 20, doubled: true } };
    expect(viewGame(game({ rounds: [exact] }), 1).card?.penalty).toBe(
      "Покарання суперника: Присідання\u00a0×\u00a020 (10\u00a0×2\u00a0за точне влучання)",
    );
  });

  it("the score and history are from the viewer's side, history newest first", () => {
    const round2 = { ...ROUND_1, number: 2, winner_id: 2, penalty: { player_id: 1, reps: 10, doubled: false } };
    const both = game({
      score: [
        { player_id: 1, points: 1 },
        { player_id: 2, points: 1 },
      ],
      rounds: [ROUND_1, round2],
      current_round: { number: 3, guesses: [entry(1, "hidden"), entry(2, null)] },
    });
    const seen = viewGame(both, 2);
    expect([seen.myPoints, seen.theirPoints, seen.otherName]).toEqual([1, 1, "Клієнт"]);
    expect(seen.history.map((round) => round.number)).toEqual([2, 1]);
    expect(seen.history[1]).toEqual({
      number: 1,
      title: "Раунд 1 · у залі 47",
      guesses: "Ти 55 · Клієнт 40",
      outcome: "Переможець раунду — Клієнт",
      penalty: "Твоє покарання: Присідання\u00a0×\u00a010",
    });
  });
});
