// UI scenarios from openspec/changes/add-game-screen/specs/game-screen/spec.md.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const STORAGE_KEY = "gym-challenge.player-id";

const PLAYERS = [
  { id: 1, name: "Клієнт", email: "client@gym.local" },
  { id: 2, name: "Тренер", email: "coach@gym.local" },
];

// Game 1 of the spec: Клієнт (1, creator) against Тренер (2), Присідання, base 10, step 5, final 30.
const SETTINGS = {
  id: 1,
  creator: { id: 1, name: "Клієнт" },
  opponent: { id: 2, name: "Тренер" },
  exercise: "Присідання",
  base_reps: 10,
  step_reps: 5,
  final_reps: 30,
};

const points = (creator: number, opponent: number) => [
  { player_id: 1, points: creator },
  { player_id: 2, points: opponent },
];

/** A current-round entry: `null` not guessed, `"hidden"` guessed but not shown to this viewer, a number shown. */
type Entry = number | "hidden" | null;
const entry = (playerId: number, value: Entry) => ({
  player_id: playerId,
  guessed: value !== null,
  value: typeof value === "number" ? value : null,
});
const current = (number: number, creator: Entry = null, opponent: Entry = null) => ({
  number,
  guesses: [entry(1, creator), entry(2, opponent)],
});

const settled = (
  number: number,
  creator: number,
  opponent: number,
  actual: number,
  winnerId: number | null,
  penalty: { player_id: number; reps: number } | null,
) => ({
  number,
  guesses: [
    { player_id: 1, value: creator },
    { player_id: 2, value: opponent },
  ],
  actual,
  winner_id: winnerId,
  penalty,
});

/** `GET /api/games/1` as the API answers it; a new game in round 1 unless overridden. */
const detail = (overrides: Record<string, unknown> = {}) => ({
  ...SETTINGS,
  status: "active",
  score: points(0, 0),
  winner_id: null,
  final_penalty: null,
  rounds: [],
  current_round: current(1),
  ...overrides,
});

// Player 1 has won 5:0 — rounds 1–5 settled as (40, 60, 45).
const WON_BY_CLIENT = detail({
  status: "finished",
  score: points(5, 0),
  winner_id: 1,
  final_penalty: { player_id: 2, reps: 30 },
  rounds: [10, 15, 20, 25, null].map((reps, index) =>
    settled(index + 1, 40, 60, 45, 1, reps === null ? null : { player_id: 2, reps }),
  ),
  current_round: null,
});

/** Game 1 as `GET /api/games` lists it. */
const LISTED = { ...SETTINGS, status: "active", score: points(0, 0), winner_id: null };

const ROUND_1_SETTLED = {
  score: points(1, 0),
  rounds: [settled(1, 40, 55, 47, 1, { player_id: 2, reps: 10 })],
  current_round: current(2),
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Answer = { status: number; body: unknown; next?: unknown } | "network";
const ok = (body: unknown): Answer => ({ status: 200, body });
type Call = { url: string; method: string; headers: Headers; body: unknown };

/**
 * A fake API. `GET /api/games/{id}` answers from `gets[id]` in order and repeats the last one. A `POST` to
 * `.../guesses` or `.../actual` takes the next answer of `posts`; a `200` body, or a refusal's `next`, becomes what
 * the following `GET` returns.
 */
function stubApi(options: { gets?: Record<number, Answer[]>; posts?: Answer[]; games?: unknown[] } = {}) {
  const gets: Record<number, Answer[]> = { 1: [ok(detail())], ...options.gets };
  const posts = [...(options.posts ?? [])];
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      const method = (init.method ?? "GET").toUpperCase();
      const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ url, method, headers: new Headers(init.headers), body });
      const reply = (answer: Answer) => {
        if (answer === "network") throw new TypeError("Failed to fetch");
        return jsonResponse(answer.status, answer.body);
      };
      if (url === "/api/health") return jsonResponse(200, { status: "ok" });
      if (url === "/api/players") return jsonResponse(200, PLAYERS);
      if (url === "/api/games" && method === "GET") return jsonResponse(200, options.games ?? [LISTED]);
      const game = /^\/api\/games\/(\d+)$/.exec(url);
      if (game && method === "GET") {
        const queue = gets[Number(game[1])] ?? [{ status: 404, body: { detail: "Game not found" } }];
        return reply(queue.length > 1 ? queue.shift()! : queue[0]);
      }
      const move = /^\/api\/games\/(\d+)\/(guesses|actual)$/.exec(url);
      if (move && method === "POST") {
        const answer = posts.shift() ?? ok(detail());
        if (answer !== "network") {
          const after = answer.status === 200 ? answer.body : answer.next;
          if (after !== undefined) gets[Number(move[1])] = [ok(after)];
        }
        return reply(answer);
      }
      return jsonResponse(404, { detail: "Not Found" });
    }),
  );
  return calls;
}

const callsTo = (calls: Call[], method: string, url: string) =>
  calls.filter((call) => call.method === method && call.url === url);

const collapse = (text: string | null) => (text ?? "").replace(/\s+/g, " ").trim();

/** Matches the innermost element whose whole text, whitespace collapsed, equals `wanted`. */
const text = (wanted: string) => (_: string, element: Element | null) =>
  element !== null &&
  collapse(element.textContent) === wanted &&
  Array.from(element.children).every((child) => collapse(child.textContent) !== wanted);

/** Loads the app at `path` as `player` (or with nobody remembered). */
function openApp(path: string, player: number | null) {
  window.history.replaceState(null, "", path);
  if (player !== null) localStorage.setItem(STORAGE_KEY, String(player));
  return render(<App />);
}

const heading = (name: string) => screen.findByRole("heading", { name });

let visibility: DocumentVisibilityState = "visible";
function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

async function typeAndNext(label: string, value: string) {
  fireEvent.change(await screen.findByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "Далі" }));
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
  delete (document as { visibilityState?: unknown }).visibilityState;
});

describe("game-screen: A game has its own address", () => {
  it("open from the list", async () => {
    const calls = stubApi();
    openApp("/", 1);

    const list = await screen.findByRole("list", { name: "Мої ігри" });
    fireEvent.click(within(list).getByRole("link"));

    expect(await heading("Гра: Присідання")).toBeTruthy();
    expect(window.location.pathname).toBe("/games/1");
    const [get] = callsTo(calls, "GET", "/api/games/1");
    expect(get.headers.get("X-Player-Id")).toBe("1");
  });

  it("open the address directly", async () => {
    stubApi();
    openApp("/games/1", 1);

    expect(await heading("Гра: Присідання")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Мої ігри" })).toBeNull();
  });

  it("address opened before choosing a player", async () => {
    stubApi();
    openApp("/games/1", null);

    expect(await heading("Хто ти?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Я — Клієнт" }));

    expect(await heading("Гра: Присідання")).toBeTruthy();
    expect(window.location.pathname).toBe("/games/1");
  });

  it("unknown address", async () => {
    stubApi();
    openApp("/nope", 1);

    expect(await heading("Мої ігри")).toBeTruthy();
    expect(window.location.pathname).toBe("/");
  });
});

describe("game-screen: The game screen leads back to my games", () => {
  it("back to the list", async () => {
    stubApi();
    openApp("/games/1", 1);
    await heading("Гра: Присідання");

    fireEvent.click(screen.getByRole("link", { name: "Мої ігри" }));

    expect(await heading("Мої ігри")).toBeTruthy();
    expect(window.location.pathname).toBe("/");
  });

  it("no such game", async () => {
    stubApi();
    openApp("/games/99", 1);

    expect(await screen.findByText("Гру не знайдено")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Мої ігри" })).toBeTruthy();
  });

  it("remembered player rejected on the game screen", async () => {
    stubApi({ gets: { 1: [{ status: 401, body: { detail: "Unknown player" } }] } });
    openApp("/games/1", 7);

    expect(await heading("Хто ти?")).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("game-screen: The scoreboard is shown from the viewer's side", () => {
  it("opponent looks at the score", async () => {
    stubApi({ gets: { 1: [ok(detail(ROUND_1_SETTLED))] } });
    openApp("/games/1", 2);

    const board = await screen.findByRole("region", { name: "Рахунок" });
    await waitFor(() => expect(collapse(board.textContent)).toBe("Ти 0 : 1 Клієнт"));
  });

  it("creator looks at the score", async () => {
    stubApi({ gets: { 1: [ok(detail(ROUND_1_SETTLED))] } });
    openApp("/games/1", 1);

    const board = await screen.findByRole("region", { name: "Рахунок" });
    await waitFor(() => expect(collapse(board.textContent)).toBe("Ти 1 : 0 Тренер"));
  });
});

describe("game-screen: A guess is sent only after a confirm step", () => {
  it("guess and confirm", async () => {
    const calls = stubApi({ posts: [ok(detail({ current_round: current(1, 47, null) }))] });
    openApp("/games/1", 1);
    expect(await heading("Раунд 1")).toBeTruthy();

    await typeAndNext("Твоя здогадка", "47");

    expect(await screen.findByText(text("Надіслати здогадку 47? Змінити не вийде."))).toBeTruthy();
    expect(callsTo(calls, "POST", "/api/games/1/guesses")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Надіслати" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/api/games/1/guesses")).toHaveLength(1));
    const [post] = callsTo(calls, "POST", "/api/games/1/guesses");
    expect(post.headers.get("X-Player-Id")).toBe("1");
    expect(post.body).toEqual({ value: 47 });
  });

  it("change before sending", async () => {
    const calls = stubApi();
    openApp("/games/1", 1);

    await typeAndNext("Твоя здогадка", "47");
    fireEvent.click(await screen.findByRole("button", { name: "Змінити" }));

    expect((await screen.findByLabelText<HTMLInputElement>("Твоя здогадка")).value).toBe("47");
    expect(callsTo(calls, "POST", "/api/games/1/guesses")).toHaveLength(0);
  });

  it("value outside the allowed range", async () => {
    const calls = stubApi();
    openApp("/games/1", 1);

    for (const value of ["501", "4.5"]) {
      await typeAndNext("Твоя здогадка", value);
      expect(await screen.findByText("Введи ціле число від 0 до 500")).toBeTruthy();
      expect(screen.queryByText(/Надіслати здогадку/)).toBeNull();
    }
    expect(callsTo(calls, "POST", "/api/games/1/guesses")).toHaveLength(0);
  });
});

describe("game-screen: The round shows who is still expected to act", () => {
  it("waiting for the opponent's guess", async () => {
    stubApi({ posts: [ok(detail({ current_round: current(1, 47, null) }))] });
    openApp("/games/1", 1);

    await typeAndNext("Твоя здогадка", "47");
    fireEvent.click(await screen.findByRole("button", { name: "Надіслати" }));

    expect(await screen.findByText(text("Твоя здогадка: 47"))).toBeTruthy();
    expect(screen.getByText(text("Чекаємо здогадку суперника"))).toBeTruthy();
    expect(screen.queryByLabelText("Твоя здогадка")).toBeNull();
  });

  it("the opponent has already guessed", async () => {
    stubApi({ gets: { 1: [ok(detail({ current_round: current(1, null, "hidden") }))] } });
    openApp("/games/1", 1);

    expect(await screen.findByText(text("Здогадка суперника вже є"))).toBeTruthy();
    expect(screen.getByLabelText("Твоя здогадка")).toBeTruthy();
  });

  it("both guessed, creator's view", async () => {
    stubApi({ gets: { 1: [ok(detail({ current_round: current(1, 40, 55) }))] } });
    openApp("/games/1", 1);

    expect(await screen.findByText(text("Ти: 40"))).toBeTruthy();
    expect(screen.getByText(text("Тренер: 55"))).toBeTruthy();
    expect(screen.getByLabelText("Реальна кількість")).toBeTruthy();
    expect(screen.queryByLabelText("Твоя здогадка")).toBeNull();
  });

  it("both guessed, opponent's view", async () => {
    stubApi({ gets: { 1: [ok(detail({ current_round: current(1, 40, 55) }))] } });
    openApp("/games/1", 2);

    expect(await screen.findByText(text("Ти: 55"))).toBeTruthy();
    expect(screen.getByText(text("Клієнт: 40"))).toBeTruthy();
    expect(screen.getByText(text("Чекаємо реальну кількість від суперника"))).toBeTruthy();
    expect(screen.queryByLabelText("Реальна кількість")).toBeNull();
  });
});

describe("game-screen: The creator enters the actual count after a confirm step", () => {
  it("enter and confirm the actual count", async () => {
    const calls = stubApi({
      gets: { 1: [ok(detail({ current_round: current(1, 40, 55) }))] },
      posts: [ok(detail(ROUND_1_SETTLED))],
    });
    openApp("/games/1", 1);

    await typeAndNext("Реальна кількість", "47");

    expect(await screen.findByText(text("Реальна кількість 47? Це закриє раунд."))).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Надіслати" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/api/games/1/actual")).toHaveLength(1));
    const [post] = callsTo(calls, "POST", "/api/games/1/actual");
    expect(post.headers.get("X-Player-Id")).toBe("1");
    expect(post.body).toEqual({ value: 47 });
  });
});

describe("game-screen: The round just settled is shown as a result card", () => {
  it("result seen by the round winner", async () => {
    stubApi({ gets: { 1: [ok(detail(ROUND_1_SETTLED))] } });
    openApp("/games/1", 1);

    const card = await screen.findByRole("region", { name: "Підсумок раунду 1" });
    for (const line of [
      "Реальна кількість: 47",
      "Ти: 40 · відстань 7",
      "Тренер: 55 · відстань 8",
      "Раунд твій",
      "Покарання суперника: Присідання × 10",
    ]) {
      expect(within(card).getByText(text(line))).toBeTruthy();
    }
  });

  it("result seen by the round loser", async () => {
    stubApi({ gets: { 1: [ok(detail(ROUND_1_SETTLED))] } });
    openApp("/games/1", 2);

    const card = await screen.findByRole("region", { name: "Підсумок раунду 1" });
    for (const line of [
      "Ти: 55 · відстань 8",
      "Клієнт: 40 · відстань 7",
      "Переможець раунду — Клієнт",
      "Твоє покарання: Присідання × 10",
    ]) {
      expect(within(card).getByText(text(line))).toBeTruthy();
    }
  });

  it("draw", async () => {
    stubApi({ gets: { 1: [ok(detail({ rounds: [settled(1, 40, 54, 47, null, null)], current_round: current(2) }))] } });
    openApp("/games/1", 1);

    const card = await screen.findByRole("region", { name: "Підсумок раунду 1" });
    expect(within(card).getByText(text("Нічия"))).toBeTruthy();
    expect(card.textContent).not.toContain("Покарання");
  });

  it("card leaves once the next round starts", async () => {
    stubApi({ gets: { 1: [ok(detail({ ...ROUND_1_SETTLED, current_round: current(2, null, "hidden") }))] } });
    openApp("/games/1", 1);

    expect(await heading("Раунд 2")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Підсумок раунду 1" })).toBeNull();
  });
});

describe("game-screen: The screen shows every settled round", () => {
  it("two rounds, newest first", async () => {
    stubApi({
      gets: {
        1: [
          ok(
            detail({
              score: points(1, 1),
              rounds: [
                settled(1, 40, 55, 47, 1, { player_id: 2, reps: 10 }),
                settled(2, 50, 47, 47, 2, { player_id: 1, reps: 10 }),
              ],
              current_round: current(3),
            }),
          ),
        ],
      },
    });
    openApp("/games/1", 1);

    const history = await screen.findByRole("list", { name: "Історія раундів" });
    const items = within(history).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText(text("Раунд 2"))).toBeTruthy();
    expect(within(items[1]).getByText(text("Раунд 1"))).toBeTruthy();
    expect(within(items[0]).getByText(text("Переможець раунду — Тренер"))).toBeTruthy();
    expect(within(items[0]).getByText(text("Твоє покарання: Присідання × 10"))).toBeTruthy();
  });

  it("new game has no history", async () => {
    stubApi();
    openApp("/games/1", 1);

    expect(await heading("Раунд 1")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Історія раундів" })).toBeNull();
  });
});

describe("game-screen: A finished game shows its winner and the final penalty", () => {
  it("winner's view", async () => {
    stubApi({ gets: { 1: [ok(WON_BY_CLIENT)] } });
    openApp("/games/1", 1);

    expect(await screen.findByText(text("Твоя перемога"))).toBeTruthy();
    expect(screen.getByText(text("Покарання суперника: Присідання × 30"))).toBeTruthy();
    expect(screen.queryByLabelText("Твоя здогадка")).toBeNull();
    expect(screen.queryByLabelText("Реальна кількість")).toBeNull();
  });

  it("loser's view", async () => {
    stubApi({ gets: { 1: [ok(WON_BY_CLIENT)] } });
    openApp("/games/1", 2);

    expect(await screen.findByText(text("Переможець — Клієнт"))).toBeTruthy();
    expect(screen.getByText(text("Твоє покарання: Присідання × 30"))).toBeTruthy();
  });
});

describe("game-screen: An active game refreshes itself while visible", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  it("opponent's guess arrives", async () => {
    const calls = stubApi({ gets: { 1: [ok(detail()), ok(detail({ current_round: current(1, null, "hidden") }))] } });
    openApp("/games/1", 1);
    await heading("Раунд 1");
    await waitFor(() => expect(callsTo(calls, "GET", "/api/games/1")).toHaveLength(1));

    await vi.advanceTimersByTimeAsync(3000);

    await waitFor(() => expect(callsTo(calls, "GET", "/api/games/1")).toHaveLength(2));
    expect(await screen.findByText(text("Здогадка суперника вже є"))).toBeTruthy();
  });

  it("hidden page is not polled", async () => {
    const calls = stubApi();
    openApp("/games/1", 1);
    await heading("Раунд 1");
    await waitFor(() => expect(callsTo(calls, "GET", "/api/games/1")).toHaveLength(1));

    setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(9000);
    expect(callsTo(calls, "GET", "/api/games/1")).toHaveLength(1);

    setVisibility("visible");
    await waitFor(() => expect(callsTo(calls, "GET", "/api/games/1")).toHaveLength(2), { timeout: 1000 });
  });

  it("finished game is not polled", async () => {
    const calls = stubApi({ gets: { 1: [ok(WON_BY_CLIENT)] } });
    openApp("/games/1", 1);
    await screen.findByText(text("Твоя перемога"));

    await vi.advanceTimersByTimeAsync(9000);

    expect(callsTo(calls, "GET", "/api/games/1")).toHaveLength(1);
  });

  it("connection lost and back", async () => {
    stubApi({ gets: { 1: [ok(detail()), "network", ok(detail())] } });
    openApp("/games/1", 1);
    await heading("Раунд 1");

    await vi.advanceTimersByTimeAsync(3000);
    expect(await screen.findByText("Немає зв'язку, пробуємо ще")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Гра: Присідання" })).toBeTruthy();

    await vi.advanceTimersByTimeAsync(3000);
    await waitFor(() => expect(screen.queryByText("Немає зв'язку, пробуємо ще")).toBeNull());
  });
});

describe("game-screen: A refused move shows the real state, not an error", () => {
  it("guess already sent from another tab", async () => {
    stubApi({
      posts: [{ status: 409, body: { detail: "Already guessed" }, next: detail({ current_round: current(1, 40, null) }) }],
    });
    openApp("/games/1", 1);

    await typeAndNext("Твоя здогадка", "47");
    fireEvent.click(await screen.findByRole("button", { name: "Надіслати" }));

    expect(await screen.findByText(text("Твоя здогадка: 40"))).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("game finished meanwhile", async () => {
    stubApi({ posts: [{ status: 409, body: { detail: "Game is finished" }, next: WON_BY_CLIENT }] });
    openApp("/games/1", 2);

    await typeAndNext("Твоя здогадка", "47");
    fireEvent.click(await screen.findByRole("button", { name: "Надіслати" }));

    expect(await screen.findByText(text("Переможець — Клієнт"))).toBeTruthy();
  });
});
