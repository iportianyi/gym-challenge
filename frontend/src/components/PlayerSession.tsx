import { useEffect, useState } from "react";

import { fetchGames, UnknownPlayerError, type Game } from "../api/games";
import { fetchPlayers, type Player } from "../api/players";
import { clearPlayerId, loadPlayerId, savePlayerId } from "../playerStore";
import GameList from "./GameList";
import NewGameForm from "./NewGameForm";
import styles from "./PlayerSession.module.css";
import PlayerPicker from "./PlayerPicker";
import ui from "./ui.module.css";

type Loaded<T> = { status: "loading" } | { status: "error" } | { status: "ready"; value: T };

/** Who is playing in this browser, and that player's screens: picker → my games ⇄ new game (add-game-setup, D5). */
export default function PlayerSession() {
  const [playerId, setPlayerId] = useState<number | null>(loadPlayerId);
  const [players, setPlayers] = useState<Loaded<Player[]>>({ status: "loading" });
  // Games are tagged with the player they were loaded for, so switching players never shows someone else's list.
  const [games, setGames] = useState<{ playerId: number; list: Loaded<Game[]> } | null>(null);
  const [screen, setScreen] = useState<"games" | "new-game">("games");

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

  useEffect(() => {
    if (playerId === null) return;
    const controller = new AbortController();
    fetchGames(playerId, controller.signal).then(
      (list) => setGames({ playerId, list: { status: "ready", value: list } }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof UnknownPlayerError) forgetPlayer();
        else setGames({ playerId, list: { status: "error" } });
      },
    );
    return () => controller.abort();
  }, [playerId]);

  function pick(player: Player) {
    savePlayerId(player.id);
    setPlayerId(player.id);
    setScreen("games");
  }

  function forgetPlayer() {
    clearPlayerId();
    setPlayerId(null);
    setGames(null);
  }

  if (playerId === null) {
    if (players.status === "ready") return <PlayerPicker players={players.value} onPick={pick} />;
    return (
      <p className={ui.note}>{players.status === "loading" ? "Завантажуємо гравців…" : "Не вдалося завантажити гравців."}</p>
    );
  }

  const me = players.status === "ready" ? players.value.find((player) => player.id === playerId) : undefined;
  const list = games?.playerId === playerId ? games.list : { status: "loading" as const };

  return (
    <div className={styles.session}>
      <div className={styles.who}>
        <p className={styles.me}>Ти граєш як {me?.name ?? "…"}</p>
        <button type="button" className={ui.link} onClick={forgetPlayer}>
          Змінити гравця
        </button>
      </div>
      {screen === "new-game" ? (
        <NewGameForm
          playerId={playerId}
          onCancel={() => setScreen("games")}
          onUnknownPlayer={forgetPlayer}
          onCreated={(game) => {
            const before = list.status === "ready" ? list.value : [];
            setGames({ playerId, list: { status: "ready", value: [game, ...before] } });
            setScreen("games");
          }}
        />
      ) : list.status === "ready" ? (
        <GameList games={list.value} playerId={playerId} onNewGame={() => setScreen("new-game")} />
      ) : (
        <p className={ui.note}>{list.status === "loading" ? "Завантажуємо ігри…" : "Не вдалося завантажити ігри."}</p>
      )}
    </div>
  );
}
