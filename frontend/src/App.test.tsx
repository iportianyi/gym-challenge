// Page scenarios of the web-shell spec (openspec/specs/web-shell/spec.md, as changed by polish-mvp-screens).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const GREETING = "Gym Challenge";
const STATUS_TEXTS = ["Перевіряємо сервер…", "Сервер працює", "Сервер недоступний"];

const PLAYERS = [
  { id: 1, name: "Клієнт", email: "client@gym.local" },
  { id: 2, name: "Тренер", email: "coach@gym.local" },
];

function stubFetch(impl: (url: string) => Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => impl(String(input)));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Start page greets the player", () => {
  it("shows exactly one level 1 heading with the greeting", async () => {
    stubFetch(async () => jsonResponse(200, PLAYERS));
    render(<App />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe(GREETING);
    await screen.findByRole("heading", { name: "Хто ти?" });
  });

  it("still shows the greeting when the API cannot be reached", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    render(<App />);

    await screen.findByText("Не вдалося завантажити гравців.");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(GREETING);
  });

  it("shows no server status and never requests GET /api/health", async () => {
    const fetchMock = stubFetch(async (url) => (url === "/api/players" ? jsonResponse(200, PLAYERS) : jsonResponse(200, { status: "ok" })));
    render(<App />);

    await screen.findByRole("heading", { name: "Хто ти?" });
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain("/api/health");
    for (const text of STATUS_TEXTS) expect(screen.queryByText(text)).toBeNull();
  });
});
