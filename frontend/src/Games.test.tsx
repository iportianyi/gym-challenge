// UI scenarios from openspec/changes/add-game-setup/specs/players/spec.md and specs/games/spec.md.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const STORAGE_KEY = "gym-challenge.player-id";

const PLAYERS = [
  { id: 1, name: "Клієнт", email: "client@gym.local" },
  { id: 2, name: "Тренер", email: "coach@gym.local" },
];

const GAME = {
  id: 1,
  creator: { id: 1, name: "Клієнт" },
  opponent: { id: 2, name: "Тренер" },
  exercise: "Присідання",
  base_reps: 10,
  step_reps: 5,
  final_reps: 30,
  status: "active",
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Call = { url: string; method: string; headers: Headers; body: unknown };

/** A fake API: health is up, players are the defaults, games come from `games`; POST answers `postAnswer`. */
function stubApi(options: { games?: unknown[]; gamesStatus?: number; postAnswer?: [number, unknown] } = {}) {
  const games = [...(options.games ?? [])];
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      const method = (init.method ?? "GET").toUpperCase();
      const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ url, method, headers: new Headers(init.headers), body });
      if (url === "/api/health") return jsonResponse(200, { status: "ok" });
      if (url === "/api/players") return jsonResponse(200, PLAYERS);
      if (url === "/api/games" && method === "GET") {
        return jsonResponse(options.gamesStatus ?? 200, options.gamesStatus === 401 ? { detail: "Unknown player" } : games);
      }
      if (url === "/api/games" && method === "POST") {
        const [status, answer] = options.postAnswer ?? [201, GAME];
        if (status === 201) games.unshift(answer);
        return jsonResponse(status, answer);
      }
      return jsonResponse(404, { detail: "Not Found" });
    }),
  );
  return calls;
}

const gameCalls = (calls: Call[], method: string) =>
  calls.filter((call) => call.url === "/api/games" && call.method === method);

async function fillAndSubmitForm() {
  fireEvent.click(await screen.findByRole("button", { name: "Нова гра" }));
  await screen.findByRole("heading", { name: "Нова гра" });
  fireEvent.change(screen.getByLabelText("Email суперника"), { target: { value: "coach@gym.local" } });
  fireEvent.change(screen.getByLabelText("Вправа"), { target: { value: "Присідання" } });
  fireEvent.change(screen.getByLabelText("Повторень за першу поразку"), { target: { value: "10" } });
  fireEvent.change(screen.getByLabelText("Додати за кожну наступну поразку поспіль"), { target: { value: "5" } });
  fireEvent.change(screen.getByLabelText("Повторень за програну гру"), { target: { value: "30" } });
  fireEvent.click(screen.getByRole("button", { name: "Почати гру" }));
}

beforeEach(() => localStorage.clear());

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("players: The browser asks who is using it", () => {
  it("first open shows the picker with both players and their emails, no games", async () => {
    stubApi();
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Хто ти?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Я — Клієнт" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Я — Тренер" })).toBeTruthy();
    expect(screen.getByText("client@gym.local")).toBeTruthy();
    expect(screen.getByText("coach@gym.local")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Мої ігри" })).toBeNull();
  });
});

describe("players: The browser remembers the chosen player", () => {
  it("picking a player shows who I play as, my games, and sends X-Player-Id", async () => {
    const calls = stubApi();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Я — Тренер" }));

    expect(await screen.findByText("Ти граєш як Тренер")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Мої ігри" })).toBeTruthy();
    await waitFor(() => expect(gameCalls(calls, "GET").length).toBeGreaterThan(0));
    expect(gameCalls(calls, "GET")[0].headers.get("X-Player-Id")).toBe("2");
  });

  it("reload keeps the choice", async () => {
    stubApi();
    const first = render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Я — Тренер" }));
    await screen.findByText("Ти граєш як Тренер");
    first.unmount();

    render(<App />);

    expect(await screen.findByText("Ти граєш як Тренер")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Хто ти?" })).toBeNull();
  });

  it("change player returns to the picker, also after a reload", async () => {
    localStorage.setItem(STORAGE_KEY, "2");
    stubApi();
    const first = render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Змінити гравця" }));

    expect(await screen.findByRole("heading", { name: "Хто ти?" })).toBeTruthy();
    first.unmount();
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Хто ти?" })).toBeTruthy();
  });

  it("a remembered player that the server rejects is cleared", async () => {
    localStorage.setItem(STORAGE_KEY, "7");
    stubApi({ gamesStatus: 401 });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Хто ти?" })).toBeTruthy();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe("games: The app lists my games", () => {
  it("no games yet", async () => {
    localStorage.setItem(STORAGE_KEY, "1");
    stubApi({ games: [] });
    render(<App />);

    expect(await screen.findByText("Ще немає ігор. Почни першу.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Нова гра" })).toBeTruthy();
  });

  it("one game against Тренер", async () => {
    localStorage.setItem(STORAGE_KEY, "1");
    stubApi({ games: [GAME] });
    render(<App />);

    const list = await screen.findByRole("list", { name: "Мої ігри" });
    expect(within(list).getByText("Тренер")).toBeTruthy();
    expect(within(list).getByText("Присідання")).toBeTruthy();
    expect(screen.queryByText("Ще немає ігор. Почни першу.")).toBeNull();
  });
});

describe("games: The app creates a game from a form", () => {
  it("successful create sends the body and shows the new game in my games", async () => {
    localStorage.setItem(STORAGE_KEY, "1");
    const calls = stubApi({ games: [] });
    render(<App />);

    await fillAndSubmitForm();

    const list = await screen.findByRole("list", { name: "Мої ігри" });
    expect(within(list).getByText("Тренер")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Мої ігри" })).toBeTruthy();
    const [post] = gameCalls(calls, "POST");
    expect(post.headers.get("X-Player-Id")).toBe("1");
    expect(post.body).toEqual({
      opponent_email: "coach@gym.local",
      exercise: "Присідання",
      base_reps: 10,
      step_reps: 5,
      final_reps: 30,
    });
  });

  it("unknown opponent email keeps the form and explains the error", async () => {
    localStorage.setItem(STORAGE_KEY, "1");
    stubApi({ postAnswer: [422, { detail: "Opponent not found" }] });
    render(<App />);

    await fillAndSubmitForm();

    expect(await screen.findByText("Гравця з таким email немає")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Нова гра" })).toBeTruthy();
  });

  it("own email explains the error", async () => {
    localStorage.setItem(STORAGE_KEY, "1");
    stubApi({ postAnswer: [422, { detail: "Cannot play against yourself" }] });
    render(<App />);

    await fillAndSubmitForm();

    expect(await screen.findByText("Це твій email. Введи email суперника.")).toBeTruthy();
  });

  it("cancel returns to my games without a request", async () => {
    localStorage.setItem(STORAGE_KEY, "1");
    const calls = stubApi();
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Нова гра" }));
    fireEvent.click(await screen.findByRole("button", { name: "Скасувати" }));

    expect(await screen.findByRole("heading", { name: "Мої ігри" })).toBeTruthy();
    expect(gameCalls(calls, "POST")).toHaveLength(0);
  });
});
