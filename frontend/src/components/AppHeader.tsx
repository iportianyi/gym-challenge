import styles from "./AppHeader.module.css";

/**
 * The one line above every screen: `Gym Challenge` and, once the player is known, their name (compact-shell, design
 * D2). The words `Ти граєш як` are for screen readers only; on screen the name stands next to the heading.
 */
export default function AppHeader({ name }: { name?: string }) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>Gym Challenge</h1>
      {name !== undefined && (
        <p className={styles.me}>
          <span className="visually-hidden">Ти граєш як </span>
          {name}
        </p>
      )}
    </header>
  );
}
