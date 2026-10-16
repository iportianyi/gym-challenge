// UI scenarios from the games spec (add-game-setup, add-game-screen, polish-mvp-screens, telegram-auth, game-invites).
// The player scenarios moved to Login.test.tsx with telegram-auth.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { answerMe, freshTab, jsonResponse, openInTelegram, tma } from "./test/telegram";

/** `GET /api/opponents` as player 1 sees it by default: the known opponents. */
const KNOWN = [{ id: 2, name: "Тренер" }];

const GAME = {
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
};

/** Waiting game 7 of player 1 (game-invites): no opponent, no score yet. */
const WAITING = { ...GAME, id: 7, opponent: null, status: "waiting", score: [] };

type Call = { url: string; method: string; headers: Headers; body: unknown };

/**
 * A fake API: `/api/me` knows the test logins, `GET /api/opponents` answers `opponents` (or `opponentsStatus` with no
 * list), games come from `games`; POST answers `postAnswer`; `GET /api/games/{id}` answers `detail` (404 without it).
 */
function stubApi(
  options: {
    games?: unknown[];
    opponents?: unknown[];
    opponentsStatus?: number;
    postAnswer?: [number, unknown];
    detail?: unknown;
  } = {},
) {
  const games = [...(options.games ?? [])];
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      const method = (init.method ?? "GET").toUpperCase();
      const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      const headers = new Headers(init.headers);
      calls.push({ url, method, headers, body });
      const me = answerMe(url, method, headers, body);
      if (me) return me;
      if (url === "/api/opponents") {
        return options.opponentsStatus === undefined
          ? jsonResponse(200, options.opponents ?? KNOWN)
          : jsonResponse(options.opponentsStatus, null);
      }
      if (url === "/api/games" && method === "GET") return jsonResponse(200, games);
      if (url === "/api/games" && method === "POST") {
        const [status, answer] = options.postAnswer ?? [201, GAME];
        if (status === 201) games.unshift(answer);
        return jsonResponse(status, answer);
      }
      if (/^\/api\/games\/\d+$/.test(url) && options.detail !== undefined) return jsonResponse(200, options.detail);
      return jsonResponse(404, { detail: "Not Found" });
    }),
  );
  return calls;
}

const gameCalls = (calls: Call[], method: string) =>
  calls.filter((call) => call.url === "/api/games" && call.method === method);

async function openForm() {
  fireEvent.click(await screen.findByRole("button", { name: "Нова гра" }));
  await screen.findByRole("heading", { name: "Нова гра" });
}

/** Fills the settings `Присідання`, 10, 5, 30 and, unless `opponent` is null (the invite), chooses that option. */
async function fillAndSubmitForm(opponent: string | null = "Тренер") {
  await openForm();
  if (opponent !== null) {
    const select = screen.getByLabelText("Суперник");
    await within(select).findByRole("option", { name: opponent });
    fireEvent.change(select, { target: { value: within(select).getByRole("option", { name: opponent }).getAttribute("value") } });
  }
  fireEvent.change(screen.getByLabelText("Вправа"), { target: { value: "Присідання" } });
  fireEvent.change(screen.getByLabelText("Повторень за першу поразку"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText("Додати за кожну наступну поразку поспіль"), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Повторень за програну гру"), { target: { value: "30" } });
  fireEvent.click(screen.getByRole("button", { name: "Почати гру" }));
}

beforeEach(() => {
  // jsdom keeps the address and the tab's storage between tests; the game screen tests below move away from "/".
  freshTab();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  freshTab();
  delete (document as { visibilityState?: unknown }).visibilityState;
});

/** Makes `document.visibilityState` report `state` and fires `visibilitychange`. */
function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("games: The app lists my games", () => {
  it("no games yet", async () => {
    stubApi({ games: [] });
    openInTelegram("/", 1);
    render(<App />);

    expect(await screen.findByText("Ще немає ігор. Почни першу.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Нова гра" })).toBeTruthy();
  });

  it("one game against Тренер", async () => {
    stubApi({ games: [GAME] });
    openInTelegram("/", 1);
    render(<App />);

    const list = await screen.findByRole("list", { name: "Мої ігри" });
    expect(within(list).getByText("Тренер")).toBeTruthy();
    expect(within(list).getByText("Присідання")).toBeTruthy();
    expect(screen.queryByText("Ще немає ігор. Почни першу.")).toBeNull();
  });

  it("a waiting game", async () => {
    stubApi({ games: [WAITING] });
    openInTelegram("/", 1);
    render(<App />);

    const list = await screen.findByRole("list", { name: "Мої ігри" });
    expect(within(list).getByText("Чекаємо суперника")).toBeTruthy();
    expect(within(list).getByText("Присідання")).toBeTruthy();
  });
});

describe("games: The app creates a game with the chosen opponent", () => {
  it("successful create sends the body and opens the new game", async () => {
    const created = { ...GAME, id: 7 };
    const calls = stubApi({
      games: [],
      postAnswer: [201, created],
      detail: {
        ...created,
        final_penalty: null,
        rounds: [],
        current_round: {
          number: 1,
          guesses: [
            { player_id: 1, guessed: false, value: null },
            { player_id: 2, guessed: false, value: null },
          ],
        },
      },
    });
    openInTelegram("/", 1);
    render(<App />);

    await fillAndSubmitForm();

    expect(await screen.findByRole("heading", { name: "Гра: Присідання" })).toBeTruthy();
    expect(window.location.pathname).toBe("/games/7");
    const [post] = gameCalls(calls, "POST");
    expect(post.headers.get("Authorization")).toBe(tma(1));
    expect(post.body).toEqual({
      opponent_id: 2,
      exercise: "Присідання",
      base_reps: 10,
      step_reps: 5,
      final_reps: 30,
    });
  });

  it("opponent no longer exists", async () => {
    stubApi({ postAnswer: [422, { detail: "Opponent not found" }] });
    openInTelegram("/", 1);
    render(<App />);

    await fillAndSubmitForm();

    expect(await screen.findByText("Такого гравця немає. Обери іншого.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Нова гра" })).toBeTruthy();
  });

  it("cancel returns to my games without a request", async () => {
    const calls = stubApi();
    openInTelegram("/", 1);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Нова гра" }));
    fireEvent.click(await screen.findByRole("button", { name: "Скасувати" }));

    expect(await screen.findByRole("heading", { name: "Мої ігри" })).toBeTruthy();
    expect(gameCalls(calls, "POST")).toHaveLength(0);
  });
});

describe("games: The form offers an invite and the known opponents", () => {
  const startButton = () => screen.getByRole("button", { name: "Почати гру" }) as HTMLButtonElement;
  const options = (select: HTMLElement) => within(select).getAllByRole("option").map((option) => option.textContent);

  it("Клієнт sees the invite and Тренер", async () => {
    stubApi({ opponents: [{ id: 2, name: "Тренер" }, { id: 3, name: "Гість" }] });
    openInTelegram("/", 1);
    render(<App />);

    await openForm();

    const select = screen.getByLabelText("Суперник") as HTMLSelectElement;
    await within(select).findByRole("option", { name: "Гість" });
    expect(options(select)).toEqual(["Запросити за посиланням", "Тренер", "Гість"]);
    expect(select.selectedOptions[0].textContent).toBe("Запросити за посиланням");
  });

  it("nobody known yet", async () => {
    const calls = stubApi({ opponents: [] });
    openInTelegram("/", 1);
    render(<App />);

    await openForm();
    await waitFor(() => expect(calls.some((call) => call.url === "/api/opponents")).toBe(true));

    expect(options(screen.getByLabelText("Суперник"))).toEqual(["Запросити за посиланням"]);
    expect(startButton().disabled).toBe(false);
  });

  it("known opponents could not be loaded", async () => {
    stubApi({ opponentsStatus: 500 });
    openInTelegram("/", 1);
    render(<App />);

    await openForm();

    expect(await screen.findByText("Не вдалося завантажити знайомих суперників.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Нова гра" })).toBeTruthy();
    expect(options(screen.getByLabelText("Суперник"))).toEqual(["Запросити за посиланням"]);
    expect(startButton().disabled).toBe(false);
  });
});

describe("games: The list shows each game's score and whether it is finished", () => {
  it("active game seen by the opponent", async () => {
    stubApi({
      games: [
        {
          ...GAME,
          score: [
            { player_id: 1, points: 1 },
            { player_id: 2, points: 0 },
          ],
        },
      ],
    });
    openInTelegram("/", 2);
    render(<App />);

    const list = await screen.findByRole("list", { name: "Мої ігри" });
    expect(within(list).getByLabelText("Рахунок").textContent?.replace(/\s+/g, " ").trim()).toBe("0 : 1");
    expect(within(list).queryByText("Завершена")).toBeNull();
  });

  it("finished game", async () => {
    stubApi({
      games: [
        {
          ...GAME,
          status: "finished",
          winner_id: 1,
          score: [
            { player_id: 1, points: 5 },
            { player_id: 2, points: 0 },
          ],
        },
      ],
    });
    openInTelegram("/", 1);
    render(<App />);

    const list = await screen.findByRole("list", { name: "Мої ігри" });
    expect(within(list).getByLabelText("Рахунок").textContent?.replace(/\s+/g, " ").trim()).toBe("5 : 0");
    expect(within(list).getByText("Завершена")).toBeTruthy();
  });

  it("waiting game has no score", async () => {
    stubApi({ games: [WAITING] });
    openInTelegram("/", 1);
    render(<App />);

    const list = await screen.findByRole("list", { name: "Мої ігри" });
    expect(within(list).getByText("Чекаємо суперника")).toBeTruthy();
    expect(within(list).queryByLabelText("Рахунок")).toBeNull();
  });
});

describe("games: The list is reloaded when the player returns to it", () => {
  it("back from a game", async () => {
    const calls = stubApi({
      games: [GAME],
      detail: {
        ...GAME,
        final_penalty: null,
        rounds: [],
        current_round: {
          number: 1,
          guesses: [
            { player_id: 1, guessed: false, value: null },
            { player_id: 2, guessed: false, value: null },
          ],
        },
      },
    });
    openInTelegram("/", 1);
    render(<App />);

    const list = await screen.findByRole("list", { name: "Мої ігри" });
    fireEvent.click(within(list).getByRole("link"));
    await screen.findByRole("heading", { name: "Гра: Присідання" });
    fireEvent.click(screen.getByRole("link", { name: "Мої ігри" }));

    await screen.findByRole("heading", { name: "Мої ігри" });
    await waitFor(() => expect(gameCalls(calls, "GET")).toHaveLength(2));
  });

  it("tab becomes visible again", async () => {
    const calls = stubApi({ games: [GAME] });
    openInTelegram("/", 1);
    render(<App />);
    await screen.findByRole("list", { name: "Мої ігри" });
    await waitFor(() => expect(gameCalls(calls, "GET")).toHaveLength(1));

    setVisibility("hidden");
    setVisibility("visible");

    await waitFor(() => expect(gameCalls(calls, "GET")).toHaveLength(2));
  });
});
