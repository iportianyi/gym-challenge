// Web-app scenarios of the telegram-auth and players specs (openspec/changes/telegram-auth/specs/).
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { answerMe, freshTab, jsonResponse, openInTelegram, T1, tma, type MeOptions } from "./test/telegram";

type Call = { url: string; method: string; headers: Headers; body: unknown };

/** A fake API: `/api/me` as in `answerMe`, `GET /api/games` answers `gamesStatus` (200 with no games by default). */
function stubApi(options: MeOptions & { gamesStatus?: number } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      const method = (init.method ?? "GET").toUpperCase();
      const headers = new Headers(init.headers);
      const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      calls.push({ url, method, headers, body });
      const me = answerMe(url, method, headers, body, options);
      if (me) return me;
      if (url === "/api/games") {
        const status = options.gamesStatus ?? 200;
        return jsonResponse(status, status === 401 ? { detail: "Invalid Telegram login" } : []);
      }
      if (url === "/api/players") return jsonResponse(200, []);
      return jsonResponse(404, { detail: "Not Found" });
    }),
  );
  return calls;
}

const callsTo = (calls: Call[], method: string, url: string) =>
  calls.filter((call) => call.method === method && call.url === url);

const REFUSED = "Вхід застарів. Закрий і знову відкрий застосунок у Telegram.";

beforeEach(freshTab);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  freshTab();
});

describe("telegram-auth: The web app takes initData from the Telegram launch parameters", () => {
  it("opened from Telegram", async () => {
    const calls = stubApi();
    openInTelegram("/", 1);
    render(<App />);

    await screen.findByRole("heading", { name: "Мої ігри" });
    const [me] = callsTo(calls, "GET", "/api/me");
    expect(me.headers.get("Authorization")).toBe(`tma ${T1}`);
    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("");
  });

  it("reload in the same tab", async () => {
    const calls = stubApi();
    openInTelegram("/", 1);
    const first = render(<App />);
    await screen.findByRole("heading", { name: "Мої ігри" });
    first.unmount();

    window.history.replaceState(null, "", "/games/1");
    render(<App />);

    await waitFor(() => expect(callsTo(calls, "GET", "/api/me")).toHaveLength(2));
    expect(callsTo(calls, "GET", "/api/me")[1].headers.get("Authorization")).toBe(tma(1));
  });
});

describe("telegram-auth: Outside Telegram the app only says where to open it", () => {
  it("opened in a plain browser", async () => {
    const calls = stubApi();
    render(<App />);

    expect(await screen.findByText("Відкрий Gym Challenge у Telegram")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Мої ігри" })).toBeNull();
    expect(calls.filter((call) => call.url.startsWith("/api/"))).toHaveLength(0);
  });
});

describe("telegram-auth: A refused login asks to reopen the app", () => {
  it("login expired while the list is open", async () => {
    stubApi({ gamesStatus: 401 });
    openInTelegram("/", 1);
    render(<App />);

    expect(await screen.findByText(REFUSED)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Мої ігри" })).toBeNull();
  });

  it("reload after a refused login", async () => {
    stubApi({ gamesStatus: 401 });
    openInTelegram("/", 1);
    const first = render(<App />);
    await screen.findByText(REFUSED);
    first.unmount();

    window.history.replaceState(null, "", "/");
    render(<App />);

    expect(await screen.findByText("Відкрий Gym Challenge у Telegram")).toBeTruthy();
  });
});

describe("players: The first login asks for the player's name", () => {
  const nameField = () => screen.findByLabelText("Твоє ім'я") as Promise<HTMLInputElement>;

  it("confirm the Telegram name", async () => {
    const calls = stubApi({ me: "unregistered" });
    openInTelegram("/", 1);
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Як тебе звати?" })).toBeTruthy();
    expect((await nameField()).value).toBe("Іван");
    fireEvent.click(screen.getByRole("button", { name: "Почати" }));

    expect(await screen.findByText("Ти граєш як Іван")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Мої ігри" })).toBeTruthy();
    const [post] = callsTo(calls, "POST", "/api/me");
    expect(post.headers.get("Authorization")).toBe(tma(1));
    expect(post.body).toEqual({ name: "Іван" });
  });

  it("correct the name", async () => {
    const calls = stubApi({ me: "unregistered" });
    openInTelegram("/", 1);
    render(<App />);

    fireEvent.change(await nameField(), { target: { value: "Ваня" } });
    fireEvent.click(screen.getByRole("button", { name: "Почати" }));

    await waitFor(() => expect(callsTo(calls, "POST", "/api/me")).toHaveLength(1));
    expect(callsTo(calls, "POST", "/api/me")[0].body).toEqual({ name: "Ваня" });
  });

  it("empty name", async () => {
    const calls = stubApi({ me: "unregistered" });
    openInTelegram("/", 1);
    render(<App />);

    fireEvent.change(await nameField(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Почати" }));

    expect(await screen.findByText("Ім'я — від 1 до 40 символів")).toBeTruthy();
    expect(callsTo(calls, "POST", "/api/me")).toHaveLength(0);
  });

  it("the requested address is kept", async () => {
    stubApi({ me: "unregistered" });
    openInTelegram("/games/new", 1);
    render(<App />);

    await nameField();
    fireEvent.click(screen.getByRole("button", { name: "Почати" }));

    expect(await screen.findByRole("heading", { name: "Нова гра" })).toBeTruthy();
    expect(window.location.pathname).toBe("/games/new");
  });
});

describe("players: A known player goes straight to their games", () => {
  it("returning player", async () => {
    stubApi();
    openInTelegram("/", 1);
    render(<App />);

    expect(await screen.findByText("Ти граєш як Клієнт")).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Мої ігри" })).toBeTruthy();
    expect(screen.queryByLabelText("Твоє ім'я")).toBeNull();
    expect(screen.queryByRole("button", { name: "Змінити гравця" })).toBeNull();
  });

  it("server unreachable", async () => {
    stubApi({ me: "network" });
    openInTelegram("/", 1);
    render(<App />);

    expect(await screen.findByText("Не вдалося зв'язатися з сервером.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Мої ігри" })).toBeNull();
  });
});
