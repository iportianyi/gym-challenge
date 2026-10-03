import type { Game } from "../api/games";
import styles from "./GameList.module.css";
import ui from "./ui.module.css";

type Props = { games: Game[]; playerId: number; onNewGame: () => void };

export default function GameList({ games, playerId, onNewGame }: Props) {
  return (
    <section className={styles.section} aria-labelledby="games-heading">
      <h2 id="games-heading" className={ui.heading}>
        Мої ігри
      </h2>
      {games.length === 0 ? (
        <p className={ui.note}>Ще немає ігор. Почни першу.</p>
      ) : (
        <ul className={styles.games} aria-label="Мої ігри">
          {games.map((game) => (
            <GameRow key={game.id} game={game} playerId={playerId} />
          ))}
        </ul>
      )}
      <button type="button" className={ui.primary} onClick={onNewGame}>
        Нова гра
      </button>
    </section>
  );
}

function GameRow({ game, playerId }: { game: Game; playerId: number }) {
  const other = game.creator.id === playerId ? game.opponent : game.creator;
  return (
    <li className={styles.game}>
      <div className={styles.title}>
        <span className={styles.label}>Проти</span>
        <span className={styles.opponent}>{other.name}</span>
        <span className={styles.exercise}>{game.exercise}</span>
      </div>
      {/* The penalty in reps, read like a scoreboard: first loss, add per loss in a row, lost game. */}
      <dl className={styles.board}>
        <div className={styles.cell}>
          <dt>перша поразка</dt>
          <dd className="digits">{game.base_reps}</dd>
        </div>
        <div className={styles.cell}>
          <dt>далі, поспіль</dt>
          <dd className="digits">+{game.step_reps}</dd>
        </div>
        <div className={styles.cell}>
          <dt>програна гра</dt>
          <dd className="digits">{game.final_reps}</dd>
        </div>
      </dl>
    </li>
  );
}
