import { Link, useParams } from "react-router";

import { sendActual, sendGuess } from "../api/games";
import { useGame } from "../game/useGame";
import { viewGame, type Phase, type RoundView } from "../game/view";
import styles from "./GameScreen.module.css";
import NumberEntry from "./NumberEntry";
import ui from "./ui.module.css";

type Props = { playerId: number; onUnknownPlayer: () => void };

/** The screen of one game at /games/:id; everything shown comes from `viewGame` (add-game-screen, D4). */
export default function GameScreen({ playerId, onUnknownPlayer }: Props) {
  const id = Number(useParams().id);
  const { game, offline, move } = useGame(playerId, id, onUnknownPlayer);

  const back = (
    <Link to="/" className={styles.back}>
      Мої ігри
    </Link>
  );

  if (typeof game !== "object") {
    return (
      <section className={styles.screen}>
        {back}
        <p className={ui.note}>
          {game === "not-found" ? "Гру не знайдено" : game === "loading" ? "Завантажуємо гру…" : "Не вдалося завантажити гру."}
        </p>
      </section>
    );
  }

  const view = viewGame(game, playerId);

  return (
    <section className={styles.screen} aria-labelledby="game-heading">
      {back}
      <h2 id="game-heading" className={ui.heading}>
        {view.title}
      </h2>
      {offline && (
        <p role="status" className={styles.offline}>
          Немає зв'язку, пробуємо ще
        </p>
      )}

      <section aria-label="Рахунок" className={styles.board}>
        <span className={styles.side}>Ти</span>{" "}
        <span className={`${styles.points} digits`}>{view.myPoints}</span>{" "}
        <span className={styles.colon}>:</span>{" "}
        <span className={`${styles.points} digits`}>{view.theirPoints}</span>{" "}
        <span className={styles.side}>{view.otherName}</span>
      </section>

      {view.end && (
        <div className={styles.end}>
          <p className={styles.headline}>{view.end.headline}</p>
          {view.end.penalty && <p className={styles.penalty}>{view.end.penalty}</p>}
        </div>
      )}

      {view.phase.kind !== "over" && (
        <CurrentRound
          phase={view.phase}
          otherName={view.otherName}
          onGuess={(value) => move(() => sendGuess(playerId, id, value))}
          onActual={(value) => move(() => sendActual(playerId, id, value))}
        />
      )}

      {view.card && (
        <section aria-labelledby="card-heading" className={styles.card}>
          <h3 id="card-heading" className={styles.subheading}>
            Підсумок раунду {view.card.number}
          </h3>
          <RoundLines round={view.card} />
        </section>
      )}

      {view.history.length > 0 && (
        <section className={styles.history}>
          <h3 id="history-heading" className={styles.subheading}>
            Історія раундів
          </h3>
          <ol aria-labelledby="history-heading" className={styles.rounds}>
            {view.history.map((round) => (
              <li key={round.number} className={styles.round}>
                <span className={styles.roundNumber}>Раунд {round.number}</span>
                <RoundLines round={round} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  );
}

type RoundProps = {
  phase: Exclude<Phase, { kind: "over" }>;
  otherName: string;
  onGuess: (value: number) => Promise<void>;
  onActual: (value: number) => Promise<void>;
};

/** The round being played: what the viewer does next, or who is still expected to act. */
function CurrentRound({ phase, otherName, onGuess, onActual }: RoundProps) {
  return (
    <section aria-labelledby="round-heading" className={styles.current}>
      <h3 id="round-heading" className={styles.subheading}>
        Раунд {phase.round}
      </h3>
      {phase.kind === "guess" && (
        <>
          {phase.otherGuessed && <p className={styles.hint}>Здогадка суперника вже є</p>}
          <NumberEntry
            id="guess"
            label="Твоя здогадка"
            confirmText={(value) => `Надіслати здогадку ${value}? Змінити не вийде.`}
            onSend={onGuess}
          />
        </>
      )}
      {phase.kind === "wait-guess" && (
        <>
          <p className={styles.value}>
            Твоя здогадка: <span className="digits">{phase.mine}</span>
          </p>
          <p className={styles.hint}>Чекаємо здогадку суперника</p>
        </>
      )}
      {(phase.kind === "enter-actual" || phase.kind === "wait-actual") && (
        <>
          <ul className={styles.both}>
            <li className={styles.value}>
              Ти: <span className="digits">{phase.mine}</span>
            </li>
            <li className={styles.value}>
              {otherName}: <span className="digits">{phase.theirs}</span>
            </li>
          </ul>
          {phase.kind === "enter-actual" ? (
            <NumberEntry
              id="actual"
              label="Реальна кількість"
              confirmText={(value) => `Реальна кількість ${value}? Це закриє раунд.`}
              onSend={onActual}
            />
          ) : (
            <p className={styles.hint}>Чекаємо реальну кількість від суперника</p>
          )}
        </>
      )}
    </section>
  );
}

function RoundLines({ round }: { round: RoundView }) {
  return (
    // Paragraphs, not a list: the history items must stay the only list items of the history list.
    <div className={styles.lines}>
      <p>{round.actual}</p>
      <p>{round.guesses[0]}</p>
      <p>{round.guesses[1]}</p>
      <p className={styles.outcome}>{round.outcome}</p>
      {round.penalty && <p className={styles.penalty}>{round.penalty}</p>}
    </div>
  );
}
