import { useEffect, useState } from "react";

import styles from "./App.module.css";
import { checkHealth } from "./api/health";
import PlayerSession from "./components/PlayerSession";

type ServerState = "checking" | "up" | "down";

const STATUS_TEXT: Record<ServerState, string> = {
  checking: "Перевіряємо сервер…",
  up: "Сервер працює",
  down: "Сервер недоступний",
};

export default function App() {
  const [server, setServer] = useState<ServerState>("checking");

  useEffect(() => {
    const controller = new AbortController();
    checkHealth(controller.signal).then((up) => {
      if (!controller.signal.aborted) setServer(up ? "up" : "down");
    });
    return () => controller.abort();
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Welcome to Gym Challenge</h1>
        <p role="status" className={styles.status} data-server={server}>
          {STATUS_TEXT[server]}
        </p>
      </header>
      <PlayerSession />
    </main>
  );
}
