// Page scenarios of the web-shell spec (openspec/specs/web-shell/spec.md, as changed by telegram-auth and compact-shell).
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { answerMe, freshTab, jsonResponse, openInTelegram, type MeOptions } from "./test/telegram";

const GREETING = "Gym Challenge";
const STATUS_TEXTS = ["Перевіряємо сервер…", "Сервер працює", "Сервер недоступний"];

function stubFetch(me: MeOptions = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const answer = answerMe(url, (init.method ?? "GET").toUpperCase(), new Headers(init.headers), undefined, me);
    if (answer) return answer;
    if (url === "/api/games") return jsonResponse(200, []);
    return jsonResponse(200, { status: "ok" });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(freshTab);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  freshTab();
});

describe("Start page greets the player", () => {
  it("shows exactly one level 1 heading with the greeting", async () => {
    stubFetch();
    openInTelegram("/", 1);
    render(<App />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe(GREETING);
    await screen.findByRole("heading", { name: "Мої ігри" });
  });

  it("still shows the greeting when the API cannot be reached", async () => {
    stubFetch({ me: "network" });
    openInTelegram("/", 1);
    render(<App />);

    await screen.findByText("Не вдалося зв'язатися з сервером.");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(GREETING);
  });

  it("shows the greeting outside Telegram", () => {
    stubFetch();
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(GREETING);
    expect(screen.getByText("Відкрий Gym Challenge у Telegram")).toBeTruthy();
  });

  it("shows no server status and never requests GET /api/health", async () => {
    const fetchMock = stubFetch();
    openInTelegram("/", 1);
    render(<App />);

    await screen.findByRole("heading", { name: "Мої ігри" });
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain("/api/health");
    for (const text of STATUS_TEXTS) expect(screen.queryByText(text)).toBeNull();
  });
});

/** The page header: the one line above every screen (compact-shell). */
const pageHeader = () => document.querySelector("header");

describe("Start page greets the player: the one-line header (compact-shell)", () => {
  it("the header names the player", async () => {
    stubFetch();
    openInTelegram("/", 1);
    render(<App />);

    await screen.findByRole("heading", { name: "Мої ігри" });
    const header = pageHeader();
    expect(header).not.toBeNull();
    expect(within(header!).getByRole("heading", { level: 1, name: GREETING })).toBeTruthy();
    expect(within(header!).getByText("Клієнт", { exact: false })).toBeTruthy();
    expect(header!.textContent).toBe("Gym ChallengeТи граєш як Клієнт");
    const hidden = within(header!).getByText("Ти граєш як", { exact: false });
    expect(hidden.textContent).toBe("Ти граєш як ");
    expect(hidden.closest(".visually-hidden")).not.toBeNull();
  });

  it("the header before the player is known", async () => {
    stubFetch({ me: "unregistered" });
    openInTelegram("/", 1);
    render(<App />);

    await screen.findByRole("heading", { name: "Як тебе звати?" });
    expect(pageHeader()?.textContent).toBe("Gym Challenge");
  });
});
