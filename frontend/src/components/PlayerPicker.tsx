import type { Player } from "../api/players";
import styles from "./PlayerPicker.module.css";
import ui from "./ui.module.css";

type Props = { players: Player[]; onPick: (player: Player) => void };

/** "Хто ти?" — one button per player; the email stays outside the button so its name is just "Я — <name>". */
export default function PlayerPicker({ players, onPick }: Props) {
  return (
    <section className={styles.picker} aria-labelledby="picker-heading">
      <h2 id="picker-heading" className={ui.heading}>
        Хто ти?
      </h2>
      <ul className={styles.players}>
        {players.map((player) => (
          <li key={player.id} className={styles.player}>
            <button type="button" className={ui.primary} onClick={() => onPick(player)}>
              Я — {player.name}
            </button>
            <span className={styles.email}>{player.email}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
