import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { fetchGames, UnknownPlayerError, type Game } from "../api/games";
import GameList from "./GameList";
import ui from "./ui.module.css";

type Props = { playerId: number; onUnknownPlayer: () => void };

/** "Мої ігри": loaded each time it is shown and again when the tab becomes visible (no timer, design D2). */
export default function GamesPage({ playerId, onUnknownPlayer }: Props) {
  const [games, setGames] = useState<Game[] | "loading" | "error">("loading");
  const [reload, setReload] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") setReload((count) => count + 1);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchGames(playerId, controller.signal).then(setGames, (error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof UnknownPlayerError) onUnknownPlayer();
      else setGames((shown) => (Array.isArray(shown) ? shown : "error"));
    });
    return () => controller.abort();
  }, [playerId, reload, onUnknownPlayer]);

  if (games === "loading" || games === "error") {
    return <p className={ui.note}>{games === "loading" ? "Завантажуємо ігри…" : "Не вдалося завантажити ігри."}</p>;
  }
  return <GameList games={games} playerId={playerId} onNewGame={() => navigate("/games/new")} />;
}
