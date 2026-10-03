import { useCallback, useEffect, useRef, useState } from "react";

import { fetchGame, UnknownPlayerError, type GameDetail, type MoveResult } from "../api/games";

export const POLL_MS = 3000;

export type GameState = {
  game: GameDetail | "loading" | "not-found" | "error";
  /** The last request failed; the shown game is kept and the next tick tries again. */
  offline: boolean;
};

/**
 * One game, kept fresh (add-game-screen, D5): a single chain of `setTimeout`s, so requests never overlap; no timer
 * while the page is hidden or the game is over; a move aborts the poll in flight and its answer wins.
 */
export function useGame(playerId: number, id: number, onUnknownPlayer: () => void) {
  const [state, setState] = useState<GameState>({ game: "loading", offline: false });
  const moveRef = useRef<(send: () => Promise<MoveResult>) => Promise<void>>(async () => {});

  useEffect(() => {
    let alive = true;
    let over = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inflight: AbortController | undefined;

    const stop = () => {
      clearTimeout(timer);
      inflight?.abort();
      inflight = undefined;
    };

    const schedule = () => {
      clearTimeout(timer);
      if (alive && !over && document.visibilityState !== "hidden") timer = setTimeout(poll, POLL_MS);
    };

    const show = (game: GameDetail | "not-found") => {
      over = game === "not-found" || game.status === "finished";
      setState({ game, offline: false });
    };

    const failed = (error: unknown) => {
      if (error instanceof UnknownPlayerError) {
        alive = false;
        stop();
        onUnknownPlayer();
        return;
      }
      setState((shown) => (typeof shown.game === "object" ? { ...shown, offline: true } : { game: "error", offline: false }));
    };

    async function poll() {
      stop();
      const controller = new AbortController();
      inflight = controller;
      try {
        show(await fetchGame(playerId, id, controller.signal));
      } catch (error) {
        if (controller.signal.aborted) return;
        failed(error);
      }
      if (inflight === controller) inflight = undefined;
      schedule();
    }

    moveRef.current = async (send) => {
      stop();
      try {
        const result = await send();
        if (!alive) return;
        if (result === "refused") {
          await poll();
          return;
        }
        show(result);
      } catch (error) {
        if (!alive) return;
        failed(error);
      }
      schedule();
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") clearTimeout(timer);
      else if (!over) void poll();
    };

    document.addEventListener("visibilitychange", onVisibility);
    void poll();
    return () => {
      alive = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [playerId, id, onUnknownPlayer]);

  const move = useCallback((send: () => Promise<MoveResult>) => moveRef.current(send), []);
  return { ...state, move };
}
