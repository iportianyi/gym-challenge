import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router";

import { joinGame } from "../api/games";
import { LoginRefusedError } from "../api/http";
import { fetchMe, type Player } from "../api/players";
import { forgetInitData } from "../telegram";
import GameScreen from "./GameScreen";
import GamesPage from "./GamesPage";
import NameForm from "./NameForm";
import NewGameForm from "./NewGameForm";
import styles from "./PlayerSession.module.css";
import ui from "./ui.module.css";

type Session =
  | { status: "loading" }
  | { status: "register" }
  | { status: "joining"; player: Player; token: string }
  | { status: "join-failed"; player: Player; message: string }
  | { status: "ready"; player: Player }
  | { status: "refused" }
  | { status: "unreachable" };

type Props = { initData: string | null; startParam: string | null };

const JOIN_USED = "Це запрошення вже прийняв інший гравець.";
const JOIN_NOT_FOUND = "Запрошення не знайдено.";
const JOIN_FAILED = "Не вдалося приєднатися до гри.";

/**
 * Who is playing in this tab, from the Telegram login (telegram-auth, design D7), and that player's screens by
 * address. The address is kept while the name form or a message shows, so the same route renders afterwards.
 * Launched by an invite link, the player first joins that game (game-invites, design D7).
 */
export default function PlayerSession({ initData, startParam }: Props) {
  if (initData === null) return <p className={ui.note}>Відкрий Gym Challenge у Telegram</p>;
  return <LoggedIn initData={initData} startParam={startParam} />;
}

function LoggedIn({ initData, startParam }: { initData: string; startParam: string | null }) {
  const [session, setSession] = useState<Session>({ status: "loading" });
  const navigate = useNavigate();

  // Stable, because the pages below reload their data when it changes.
  const refuse = useCallback(() => {
    forgetInitData();
    setSession({ status: "refused" });
  }, []);

  // The player is known: join the invite this launch came with, once, or go on as usual.
  const arrive = useCallback(
    (player: Player) =>
      setSession(startParam ? { status: "joining", player, token: startParam } : { status: "ready", player }),
    [startParam],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchMe(initData, controller.signal).then(
      (me) => (me === "not-registered" ? setSession({ status: "register" }) : arrive(me)),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof LoginRefusedError) refuse();
        else setSession({ status: "unreachable" });
      },
    );
    return () => controller.abort();
  }, [initData, refuse, arrive]);

  const joining = session.status === "joining" ? session : null;
  useEffect(() => {
    if (joining === null) return;
    const { player, token } = joining;
    const controller = new AbortController();
    const failed = (message: string) => setSession({ status: "join-failed", player, message });
    joinGame(initData, token, controller.signal).then(
      (result) => {
        if (result === "used") return failed(JOIN_USED);
        if (result === "not-found") return failed(JOIN_NOT_FOUND);
        setSession({ status: "ready", player });
        navigate(`/games/${result.id}`, { replace: true });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof LoginRefusedError) refuse();
        else failed(JOIN_FAILED);
      },
    );
    return () => controller.abort();
  }, [joining, initData, navigate, refuse]);

  switch (session.status) {
    case "loading":
    case "joining":
      return <p className={ui.note}>Завантажуємо…</p>;
    case "refused":
      return <p className={ui.note}>Вхід застарів. Закрий і знову відкрий застосунок у Telegram.</p>;
    case "unreachable":
      return <p className={ui.note}>Не вдалося зв'язатися з сервером.</p>;
    case "register":
      return <NameForm initData={initData} onRegistered={arrive} onLoginRefused={refuse} />;
    case "join-failed": {
      const { player, message } = session;
      return (
        <div className={styles.session}>
          <p className={ui.note}>{message}</p>
          <Link to="/" className={styles.back} onClick={() => setSession({ status: "ready", player })}>
            Мої ігри
          </Link>
        </div>
      );
    }
  }

  const { player } = session;
  return (
    <div className={styles.session}>
      <p className={styles.me}>Ти граєш як {player.name}</p>
      <Routes>
        <Route path="/" element={<GamesPage initData={initData} playerId={player.id} onLoginRefused={refuse} />} />
        <Route
          path="/games/new"
          element={
            <NewGameForm
              initData={initData}
              // Replace the form in history: Back goes to the list, not to a form for a game that exists (D2).
              onCreated={(game) => navigate(`/games/${game.id}`, { replace: true })}
              onCancel={() => navigate("/")}
              onLoginRefused={refuse}
            />
          }
        />
        <Route
          path="/games/:id"
          element={<GameScreen initData={initData} playerId={player.id} onLoginRefused={refuse} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
