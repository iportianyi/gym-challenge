import { useState } from "react";
import { BrowserRouter } from "react-router";

import styles from "./App.module.css";
import PlayerSession from "./components/PlayerSession";
import { takeInitData } from "./telegram";

export default function App() {
  // Before the router reads the address: taking the launch parameters also clears them from it.
  const [initData] = useState(takeInitData);
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Gym Challenge</h1>
      </header>
      {/* The router lives here, not in main.tsx, so tests choose the address with history.replaceState (D1). */}
      <BrowserRouter>
        <PlayerSession initData={initData} />
      </BrowserRouter>
    </main>
  );
}
