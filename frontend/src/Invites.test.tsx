// Web-app scenarios of the invites spec (openspec/specs/invites/spec.md: game-invites and invite-preview-accept).
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import {
  answerJoin,
  answerMe,
  freshTab,
  jsonResponse,
  launchWith,
  openInTelegram,
  T2S,
  type JoinAnswer,
  type MeOptions,
} from "./test/telegram";

const INVITE_URL = "https://t.me/gym_dev_bot?startapp=Abc_123-xyz";

const SETTINGS = {
  id: 7,
  organizer: { id: 1, name: "Клієнт" },
  exercise: "Присідання",
  base_reps: 10,
  step_reps: 5,
  final_reps: 30,
};

/** Game 7 as its organizer sees it while it waits for an opponent. */
const WAITING = {
  ...SETTINGS,
  opponent: null,
  status: "waiting",
  score: [],
  winner_id: null,
  final_penalty: null,
  rounds: [],
  current_round: null,
  invite_url: INVITE_URL,
};

/** The create answer for game 7: the list shape, without the detail fields. */
const CREATED = { ...SETTINGS, opponent: null, status: "waiting", score: [], winner_id: null };

/** Game 7 after Тренер joined: round 1, no guesses. */
const JOINED = {
  ...SETTINGS,
  opponent: { id: 2, name: "Тренер" },
  status: "active",
  score: [
    { player_id: 1, points: 0 },
    { player_id: 2, points: 0 },
  ],
  winner_id: null,
  final_penalty: null,
  rounds: [],
  current_round: {
    number: 1,
    guesses: [
      { player_id: 1, guessed: false, value: null },
      { player_id: 2, guessed: false, value: null },
    ],
  },
  invite_url: null,
};

/** `POST /api/invites/preview` of `Abc_123-xyz` as an invited player reads it. */
const PREVIEW = {
  organizer: { id: 1, name: "Клієнт" },
  exercise: "Присідання",
  base_reps: 10,
  step_reps: 5,
  final_reps: 30,
  role: "invited",
};

type Call = { url: string; method: string; headers: Headers; body: unknown };

/**
 * A fake API: `/api/me` as in `answerMe`; `POST /api/invites/preview` answers `preview`; `POST /api/games/join`
 * answers `join`; `GET /api/games/7` answers from `gets` in order and repeats the last one; `POST /api/games` answers
 * `201` with the waiting game 7.
 */
function stubApi(options: { me?: MeOptions; preview?: JoinAnswer; join?: JoinAnswer; gets?: unknown[] } = {}) {
  const gets = [...(options.gets ?? [JOINED])];
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = String(input);
      const method = (init.method ?? "GET").toUpperCase();
      const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      const headers = new Headers(init.headers);
      calls.push({ url, method, headers, body });
      const me = answerMe(url, method, headers, body, options.me);
      if (me) return me;
      if (url === "/api/invites/preview" && method === "POST") {
        const answer = options.preview ?? [200, PREVIEW];
        if (answer === "network") throw new TypeError("Failed to fetch");
        return jsonResponse(answer[0], answer[1]);
      }
      const joined = answerJoin(url, method, options.join ?? [200, JOINED]);
      if (joined) return joined;
      if (url === "/api/games" && method === "GET") return jsonResponse(200, []);
      if (url === "/api/games" && method === "POST") return jsonResponse(201, CREATED);
      if (url === "/api/opponents") return jsonResponse(200, []);
      if (url === "/api/games/7" && method === "GET") return jsonResponse(200, gets.length > 1 ? gets.shift() : gets[0]);
      return jsonResponse(404, { detail: "Not Found" });
    }),
  );
  return calls;
}

const joins = (calls: Call[]) => calls.filter((call) => call.method === "POST" && call.url === "/api/games/join");
const previews = (calls: Call[]) =>
  calls.filter((call) => call.method === "POST" && call.url === "/api/invites/preview");
const INVITED_BY = "Клієнт кличе тебе в гру";
const gamesGets = (calls: Call[]) => calls.filter((call) => call.method === "GET" && call.url === "/api/games/7");

let visibility: DocumentVisibilityState = "visible";

beforeEach(() => {
  freshTab();
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  freshTab();
  delete (document as { visibilityState?: unknown }).visibilityState;
  delete (navigator as { clipboard?: unknown }).clipboard;
});

describe("invites: The invite screen shows who invites and the penalties", () => {
  it("invite screen with the settings", async () => {
    stubApi();
    launchWith("/", T2S);
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Гра: Присідання" })).toBeTruthy();
    for (const text of [
      INVITED_BY,
      "Покарання за раунд: Присідання × 10",
      "+5 за кожну поразку поспіль",
      "Покарання за програну гру: Присідання × 30",
      "Гра — до 5 балів",
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Відмовитись", "Прийняти"]);
    expect(screen.queryByRole("region", { name: "Рахунок" })).toBeNull();
    expect(screen.queryByLabelText("Твоя здогадка")).toBeNull();
  });

  it("no step, no streak line", async () => {
    stubApi({ preview: [200, { ...PREVIEW, step_reps: 0 }] });
    launchWith("/", T2S);
    render(<App />);

    expect(await screen.findByText("Покарання за раунд: Присідання × 10")).toBeTruthy();
    expect(document.body.textContent).not.toContain("за кожну поразку поспіль");
  });
});

describe("invites: The web app joins the game it was launched with", () => {
  it("registered player opens the link", async () => {
    const calls = stubApi();
    launchWith("/", T2S);
    render(<App />);

    await screen.findByText(INVITED_BY);
    const [preview] = previews(calls);
    expect(preview.headers.get("Authorization")).toBe(`tma ${T2S}`);
    expect(preview.body).toEqual({ token: "Abc_123-xyz" });
    expect(joins(calls)).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Прийняти" }));

    await screen.findByRole("heading", { name: "Раунд 1" });
    const [join] = joins(calls);
    expect(join.headers.get("Authorization")).toBe(`tma ${T2S}`);
    expect(join.body).toEqual({ token: "Abc_123-xyz" });
    expect(window.location.pathname).toBe("/games/7");
  });

  it("new player opens the link", async () => {
    const calls = stubApi({ me: { me: "unregistered" } });
    launchWith("/", T2S);
    render(<App />);

    await screen.findByText(INVITED_BY);
    expect(screen.queryByRole("heading", { name: "Як тебе звати?" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Прийняти" }));

    await screen.findByRole("heading", { name: "Як тебе звати?" });
    expect(joins(calls)).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Почати" }));

    await screen.findByRole("heading", { name: "Раунд 1" });
    expect(joins(calls).map((call) => call.body)).toEqual([{ token: "Abc_123-xyz" }]);
    expect(window.location.pathname).toBe("/games/7");
  });

  it("declining the invite", async () => {
    const calls = stubApi();
    launchWith("/", T2S);
    render(<App />);

    await screen.findByText(INVITED_BY);
    fireEvent.click(screen.getByRole("button", { name: "Відмовитись" }));

    expect(await screen.findByRole("heading", { name: "Мої ігри" })).toBeTruthy();
    expect(joins(calls)).toHaveLength(0);
    const asked = calls.map((call) => `${call.method} ${call.url}`);
    expect(new Set(asked)).toEqual(new Set(["GET /api/me", "POST /api/invites/preview", "GET /api/games"]));
  });

  it("a new player declines", async () => {
    const calls = stubApi({ me: { me: "unregistered" } });
    launchWith("/", T2S);
    render(<App />);

    await screen.findByText(INVITED_BY);
    fireEvent.click(screen.getByRole("button", { name: "Відмовитись" }));

    await screen.findByRole("heading", { name: "Як тебе звати?" });
    fireEvent.click(screen.getByRole("button", { name: "Почати" }));

    expect(await screen.findByRole("heading", { name: "Мої ігри" })).toBeTruthy();
    expect(joins(calls)).toHaveLength(0);
  });

  it("the opponent opens the link again", async () => {
    const calls = stubApi({ preview: [200, { ...PREVIEW, role: "opponent" }] });
    launchWith("/", T2S);
    render(<App />);

    await screen.findByRole("heading", { name: "Раунд 1" });
    expect(joins(calls)).toHaveLength(1);
    expect(window.location.pathname).toBe("/games/7");
    expect(screen.queryByText(INVITED_BY)).toBeNull();
  });

  it("reload after joining", async () => {
    const calls = stubApi();
    launchWith("/", T2S);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Прийняти" }));
    await screen.findByRole("heading", { name: "Раунд 1" });
    cleanup();

    // Same tab: the kept login, the address the app left, no fragment.
    render(<App />);
    await screen.findByRole("heading", { name: "Раунд 1" });

    expect(window.location.pathname).toBe("/games/7");
    expect(previews(calls)).toHaveLength(1);
    expect(joins(calls)).toHaveLength(1);
  });

  it("launch without a start parameter", async () => {
    const calls = stubApi();
    openInTelegram("/", 2);
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Мої ігри" })).toBeTruthy();
    expect(previews(calls)).toHaveLength(0);
    expect(joins(calls)).toHaveLength(0);
  });
});

describe("invites: A link that cannot be joined says why", () => {
  it("link already used", async () => {
    stubApi({ preview: [409, { detail: "Invite already used" }] });
    launchWith("/", T2S);
    render(<App />);

    expect(await screen.findByText("Це запрошення вже прийняв інший гравець.")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Мої ігри" }));

    expect(await screen.findByRole("heading", { name: "Мої ігри" })).toBeTruthy();
    expect(window.location.pathname).toBe("/");
  });

  it("unknown link", async () => {
    stubApi({ preview: [404, { detail: "Invite not found" }] });
    launchWith("/", T2S);
    render(<App />);

    expect(await screen.findByText("Запрошення не знайдено.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Мої ігри" })).toBeTruthy();
  });

  it("no connection while reading the invite", async () => {
    stubApi({ preview: "network" });
    launchWith("/", T2S);
    render(<App />);

    expect(await screen.findByText("Не вдалося приєднатися до гри.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Мої ігри" })).toBeTruthy();
  });

  it("no connection while joining", async () => {
    stubApi({ join: "network" });
    launchWith("/", T2S);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Прийняти" }));

    expect(await screen.findByText("Не вдалося приєднатися до гри.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Мої ігри" })).toBeTruthy();
  });

  it("someone else accepted first", async () => {
    stubApi({ join: [409, { detail: "Invite already used" }] });
    launchWith("/", T2S);
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Прийняти" }));

    expect(await screen.findByText("Це запрошення вже прийняв інший гравець.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Мої ігри" })).toBeTruthy();
  });
});

// compact-shell (review finding 1): a known player's name stands in the header on the invite screen and its messages.
describe("web-shell: the header names a known player on an invite", () => {
  it("the header on an invite", async () => {
    stubApi();
    launchWith("/", T2S);
    render(<App />);

    await screen.findByRole("heading", { name: "Гра: Присідання" });
    expect(document.querySelector("header")?.textContent).toBe("Gym ChallengeТи граєш як Тренер");
  });

  it("the header on a link that cannot be joined", async () => {
    stubApi({ preview: [409, { detail: "Invite already used" }] });
    launchWith("/", T2S);
    render(<App />);

    await screen.findByText("Це запрошення вже прийняв інший гравець.");
    expect(document.querySelector("header")?.textContent).toBe("Gym ChallengeТи граєш як Тренер");
  });
});

describe("invites: The waiting game's screen gives the organizer the link", () => {
  function stubClipboard(writeText: (text: string) => Promise<void>) {
    const spy = vi.fn(writeText);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: spy } });
    return spy;
  }

  it("organizer opens the waiting game", async () => {
    stubApi({ gets: [WAITING] });
    openInTelegram("/games/7", 1);
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Гра: Присідання" })).toBeTruthy();
    expect(await screen.findByText("Чекаємо суперника. Надішли посилання на гру.")).toBeTruthy();
    expect(screen.getByText(INVITE_URL)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Надіслати в Telegram" }).getAttribute("href")).toBe(
      "https://t.me/share/url?url=https%3A%2F%2Ft.me%2Fgym_dev_bot%3Fstartapp%3DAbc_123-xyz&text=%D0%97%D1%96%D0%B3%D1%80%D0%B0%D0%B9%20%D0%B7%D1%96%20%D0%BC%D0%BD%D0%BE%D1%8E%20%D0%B2%20Gym%20Challenge",
    );
    expect(screen.queryByRole("region", { name: "Рахунок" })).toBeNull();
    expect(screen.queryByLabelText("Твоя здогадка")).toBeNull();
  });

  it("copy the link", async () => {
    const writeText = stubClipboard(async () => {});
    stubApi({ gets: [WAITING] });
    openInTelegram("/games/7", 1);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Копіювати посилання" }));

    expect(await screen.findByText("Скопійовано")).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(INVITE_URL);
  });

  it("clipboard refused", async () => {
    stubClipboard(async () => {
      throw new DOMException("Write permission denied.", "NotAllowedError");
    });
    stubApi({ gets: [WAITING] });
    openInTelegram("/games/7", 1);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Копіювати посилання" }));

    expect(await screen.findByText("Не вдалося скопіювати. Виділи посилання й скопіюй вручну.")).toBeTruthy();
  });

  describe("refresh", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    it("opponent joins while the screen is open", async () => {
      stubApi({ gets: [WAITING, JOINED] });
      openInTelegram("/games/7", 1);
      render(<App />);
      await screen.findByText("Чекаємо суперника. Надішли посилання на гру.");

      await vi.advanceTimersByTimeAsync(3000);

      expect(await screen.findByRole("heading", { name: "Раунд 1" })).toBeTruthy();
      expect(screen.getByLabelText("Твоя здогадка")).toBeTruthy();
      expect(screen.queryByText("Чекаємо суперника. Надішли посилання на гру.")).toBeNull();
    });

    it("waiting game is polled", async () => {
      const calls = stubApi({ gets: [WAITING] });
      openInTelegram("/games/7", 1);
      render(<App />);
      await screen.findByText("Чекаємо суперника. Надішли посилання на гру.");
      await waitFor(() => expect(gamesGets(calls)).toHaveLength(1));

      await vi.advanceTimersByTimeAsync(3000);

      await waitFor(() => expect(gamesGets(calls)).toHaveLength(2));
    });
  });
});

describe("invites: A new invite game opens its screen", () => {
  it("create an invite from the form", async () => {
    const calls = stubApi({ gets: [WAITING] });
    openInTelegram("/", 1);
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Нова гра" }));
    await screen.findByRole("heading", { name: "Нова гра" });
    fireEvent.change(screen.getByLabelText("Вправа"), { target: { value: "Присідання" } });
    fireEvent.change(screen.getByLabelText("Повторень за першу поразку"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Додати за кожну наступну поразку поспіль"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Повторень за програну гру"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Почати гру" }));

    expect(await screen.findByText("Чекаємо суперника. Надішли посилання на гру.")).toBeTruthy();
    expect(window.location.pathname).toBe("/games/7");
    const posts = calls.filter((call) => call.method === "POST" && call.url === "/api/games");
    expect(posts.map((call) => call.body)).toEqual([
      { exercise: "Присідання", base_reps: 10, step_reps: 5, final_reps: 30 },
    ]);
  });
});
