import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";

import { fetchPlayers, type Player } from "../api/players";
import { clearPlayerId, loadPlayerId, savePlayerId } from "../playerStore";
import GameScreen from "./GameScreen";
import GamesPage from "./GamesPage";
import NewGameForm from "./NewGameForm";
import styles from "./PlayerSession.module.css";
import PlayerPicker from "./PlayerPicker";
import ui from "./ui.module.css";

type Loaded<T> = { status: "loading" } | { status: "error" } | { status: "ready"; value: T };

/**
 * Who is playing in this browser, and that player's screens by address (add-game-screen, D2). Without a player
 * the picker shows on any address, which is kept, so after the pick the same route renders.
 */
export default function PlayerSession() {
  const [playerId, setPlayerId] = useState<number | null>(loadPlayerId);
  const [players, setPlayers] = useState<Loaded<Player[]>>({ status: "loading" });
  const navigate = useNavigate();

  useEffect(() => {
    const controller = new AbortController();
    fetchPlayers(controller.signal).then(
      (value) => setPlayers({ status: "ready", value }),
      () => {
        if (!controller.signal.aborted) setPlayers({ status: "error" });
      },
    );
    return () => controller.abort();
  }, []);

  function pick(player: Player) {
    savePlayerId(player.id);
    setPlayerId(player.id);
  }

  // Stable, because the pages below reload their data when it changes.
  const forgetPlayer = useCallback(() => {
    clearPlayerId();
    setPlayerId(null);
  }, []);

  if (playerId === null) {
    if (players.status === "ready") return <PlayerPicker players={players.value} onPick={pick} />;
    return (
      <p className={ui.note}>{players.status === "loading" ? "Завантажуємо гравців…" : "Не вдалося завантажити гравців."}</p>
    );
  }

  const me = players.status === "ready" ? players.value.find((player) => player.id === playerId) : undefined;

  return (
    <div className={styles.session}>
      <div className={styles.who}>
        <p className={styles.me}>Ти граєш як {me?.name ?? "…"}</p>
        <button type="button" className={ui.link} onClick={forgetPlayer}>
          Змінити гравця
        </button>
      </div>
      {/* Keyed by player, so switching players never shows the previous player's data. */}
      <Routes key={playerId}>
        <Route path="/" element={<GamesPage playerId={playerId} onUnknownPlayer={forgetPlayer} />} />
        <Route
          path="/games/new"
          element={
            <NewGameForm
              playerId={playerId}
              onCreated={() => navigate("/")}
              onCancel={() => navigate("/")}
              onUnknownPlayer={forgetPlayer}
            />
          }
        />
        <Route path="/games/:id" element={<GameScreen playerId={playerId} onUnknownPlayer={forgetPlayer} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
