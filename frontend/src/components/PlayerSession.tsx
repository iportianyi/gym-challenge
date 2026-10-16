import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router";

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
  | { status: "ready"; player: Player }
  | { status: "refused" }
  | { status: "unreachable" };

type Props = { initData: string | null };

/**
 * Who is playing in this tab, from the Telegram login (telegram-auth, design D7), and that player's screens by
 * address. The address is kept while the name form or a message shows, so the same route renders afterwards.
 */
export default function PlayerSession({ initData }: Props) {
  if (initData === null) return <p className={ui.note}>Відкрий Gym Challenge у Telegram</p>;
  return <LoggedIn initData={initData} />;
}

function LoggedIn({ initData }: { initData: string }) {
  const [session, setSession] = useState<Session>({ status: "loading" });
  const navigate = useNavigate();

  // Stable, because the pages below reload their data when it changes.
  const refuse = useCallback(() => {
    forgetInitData();
    setSession({ status: "refused" });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchMe(initData, controller.signal).then(
      (me) => setSession(me === "not-registered" ? { status: "register" } : { status: "ready", player: me }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof LoginRefusedError) refuse();
        else setSession({ status: "unreachable" });
      },
    );
    return () => controller.abort();
  }, [initData, refuse]);

  switch (session.status) {
    case "loading":
      return <p className={ui.note}>Завантажуємо…</p>;
    case "refused":
      return <p className={ui.note}>Вхід застарів. Закрий і знову відкрий застосунок у Telegram.</p>;
    case "unreachable":
      return <p className={ui.note}>Не вдалося зв'язатися з сервером.</p>;
    case "register":
      return (
        <NameForm
          initData={initData}
          onRegistered={(player) => setSession({ status: "ready", player })}
          onLoginRefused={refuse}
        />
      );
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
