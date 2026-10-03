import { useEffect, useState } from "react";

import { checkHealth } from "./api/health";

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
    <main>
      <h1>Welcome to Gym Challenge</h1>
      <p role="status">{STATUS_TEXT[server]}</p>
    </main>
  );
}
