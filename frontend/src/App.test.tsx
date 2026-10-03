// Page scenarios from openspec/changes/add-project-skeleton/specs/web-shell/spec.md.
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

const WAITING = "Перевіряємо сервер…";
const UP = "Сервер працює";
const DOWN = "Сервер недоступний";
const GREETING = "Welcome to Gym Challenge";

function stubFetch(impl: () => Promise<Response>) {
  const fetchMock = vi.fn(impl);
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
    stubFetch(async () => jsonResponse(200, { status: "ok" }));
    render(<App />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toBe(GREETING);
    await screen.findByText(UP);
  });

  it("still shows the greeting when the API cannot be reached", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    render(<App />);

    await screen.findByText(DOWN);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(GREETING);
  });
});

describe("Start page shows whether the API is reachable", () => {
  it("requests GET /api/health and shows the waiting text until it answers", () => {
    const fetchMock = stubFetch(() => new Promise<Response>(() => {}));
    render(<App />);

    expect(screen.getByText(WAITING)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/health", expect.anything());
  });

  it("shows that the server works when the API answers 200 ok", async () => {
    stubFetch(async () => jsonResponse(200, { status: "ok" }));
    render(<App />);

    expect(await screen.findByText(UP)).toBeTruthy();
    expect(screen.queryByText(WAITING)).toBeNull();
  });

  it("shows that the server is unavailable when the API answers 503", async () => {
    stubFetch(async () => jsonResponse(503, { status: "down" }));
    render(<App />);

    expect(await screen.findByText(DOWN)).toBeTruthy();
  });

  it("shows that the server is unavailable on a network error", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    render(<App />);

    expect(await screen.findByText(DOWN)).toBeTruthy();
  });
});
