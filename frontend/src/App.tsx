import { BrowserRouter } from "react-router";

import styles from "./App.module.css";
import PlayerSession from "./components/PlayerSession";

export default function App() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Gym Challenge</h1>
      </header>
      {/* The router lives here, not in main.tsx, so tests choose the address with history.replaceState (D1). */}
      <BrowserRouter>
        <PlayerSession />
      </BrowserRouter>
    </main>
  );
}
