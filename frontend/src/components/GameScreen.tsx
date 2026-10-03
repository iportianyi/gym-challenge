import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";

import { fetchGame, UnknownPlayerError, type GameDetail } from "../api/games";
import ui from "./ui.module.css";

type Props = { playerId: number; onUnknownPlayer: () => void };

/** The screen of one game at /games/:id. */
export default function GameScreen({ playerId, onUnknownPlayer }: Props) {
  const id = Number(useParams().id);
  const [game, setGame] = useState<GameDetail | "loading" | "not-found" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetchGame(playerId, id, controller.signal).then(setGame, (error: unknown) => {
      if (controller.signal.aborted) return;
      if (error instanceof UnknownPlayerError) onUnknownPlayer();
      else setGame("error");
    });
    return () => controller.abort();
  }, [playerId, id, onUnknownPlayer]);

  return (
    <section aria-labelledby="game-heading">
      <Link to="/" className={ui.link}>
        Мої ігри
      </Link>
      {typeof game === "object" ? (
        <h2 id="game-heading" className={ui.heading}>
          Гра: {game.exercise}
        </h2>
      ) : (
        <p className={ui.note}>
          {game === "not-found" ? "Гру не знайдено" : game === "loading" ? "Завантажуємо гру…" : "Не вдалося завантажити гру."}
        </p>
      )}
    </section>
  );
}
