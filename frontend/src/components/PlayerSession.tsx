import { useCallback, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router";

import { joinGame } from "../api/games";
import { LoginRefusedError } from "../api/http";
import { previewInvite, type InvitePreview, type PreviewResult } from "../api/invites";
import { fetchMe, type Player } from "../api/players";
import { forgetInitData } from "../telegram";
import AppHeader from "./AppHeader";
import GameScreen from "./GameScreen";
import GamesPage from "./GamesPage";
import InviteScreen from "./InviteScreen";
import NameForm from "./NameForm";
import NewGameForm from "./NewGameForm";
import styles from "./PlayerSession.module.css";
import ui from "./ui.module.css";

/** After the name form: join the accepted invite, or just go on. */
type Next = "join" | "ready";

type Session =
  | { status: "loading" }
  | { status: "register"; next: Next }
  | { status: "invited"; player: Player | null; invite: InvitePreview }
  | { status: "joining"; player: Player; token: string }
  | { status: "join-failed"; player: Player | null; message: string }
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
 * Launched by an invite link, the person first reads the invite and joins only after `Прийняти`, choosing a name in
 * between if they are new (invite-preview-accept, design D2); a reload has no start parameter and reads nothing.
 */
export default function PlayerSession({ initData, startParam }: Props) {
  if (initData === null) {
    return (
      <>
        <AppHeader />
        <p className={ui.note}>Відкрий Gym Challenge у Telegram</p>
      </>
    );
  }
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

  // The player is known (at once, or after the name form): join the accepted invite, or go on as usual.
  const arrive = useCallback(
    (player: Player, next: Next) =>
      setSession(
        next === "join" && startParam ? { status: "joining", player, token: startParam } : { status: "ready", player },
      ),
    [startParam],
  );

  // GET /api/me and, for an invite launch, the preview, side by side: the preview needs no player.
  useEffect(() => {
    const controller = new AbortController();
    const me = fetchMe(initData, controller.signal);
    // A failed preview is a message, not a failed session; a refused login fails both requests alike.
    const preview: Promise<PreviewResult | "failed" | null> = startParam
      ? previewInvite(initData, startParam, controller.signal).catch((error: unknown) => {
          if (error instanceof LoginRefusedError) throw error;
          return "failed";
        })
      : Promise.resolve(null);
    Promise.all([me, preview]).then(
      ([found, invite]) => {
        const player = found === "not-registered" ? null : found;
        if (invite === null) {
          return setSession(player ? { status: "ready", player } : { status: "register", next: "ready" });
        }
        if (typeof invite !== "object") {
          const message = invite === "used" ? JOIN_USED : invite === "not-found" ? JOIN_NOT_FOUND : JOIN_FAILED;
          return setSession({ status: "join-failed", player, message });
        }
        // Their own link, or a game they are already in: straight to it, as before.
        if (invite.role !== "invited" && player) return arrive(player, "join");
        setSession({ status: "invited", player, invite });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof LoginRefusedError) refuse();
        else setSession({ status: "unreachable" });
      },
    );
    return () => controller.abort();
  }, [initData, startParam, refuse, arrive]);

  // Leaving an invite or a failed link: the list, after the name form for a new person.
  const goOn = useCallback(
    (player: Player | null) => setSession(player ? { status: "ready", player } : { status: "register", next: "ready" }),
    [],
  );

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

  // One header line above every screen; the name only once the player is known (compact-shell, design D1).
  const name = session.status === "ready" ? session.player.name : undefined;
  return (
    <>
      <AppHeader name={name} />
      {content()}
    </>
  );

  function content() {
    switch (session.status) {
      case "loading":
      case "joining":
        return <p className={ui.note}>Завантажуємо…</p>;
      case "refused":
        return <p className={ui.note}>Вхід застарів. Закрий і знову відкрий застосунок у Telegram.</p>;
      case "unreachable":
        return <p className={ui.note}>Не вдалося зв'язатися з сервером.</p>;
      case "register": {
        const { next } = session;
        return (
          <NameForm initData={initData} onRegistered={(player) => arrive(player, next)} onLoginRefused={refuse} />
        );
      }
      case "invited": {
        const { player, invite } = session;
        return (
          <InviteScreen
            invite={invite}
            onAccept={() => (player ? arrive(player, "join") : setSession({ status: "register", next: "join" }))}
            onDecline={() => {
              goOn(player);
              navigate("/", { replace: true });
            }}
          />
        );
      }
      case "join-failed": {
        const { player, message } = session;
        return (
          <div className={styles.session}>
            <p className={ui.note}>{message}</p>
            <Link to="/" className={styles.back} onClick={() => goOn(player)}>
              Мої ігри
            </Link>
          </div>
        );
      }
    }

    const { player } = session;
    return (
      <div className={styles.session}>
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
}
