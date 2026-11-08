import { useState } from "react";
import { Link, useParams } from "react-router";

import { hasOpponent, sendActual, sendGuess } from "../api/games";
import { useGame } from "../game/useGame";
import { viewGame, type CardView, type HistoryItem, type Phase } from "../game/view";
import styles from "./GameScreen.module.css";
import NumberEntry from "./NumberEntry";
import ui from "./ui.module.css";

type Props = { initData: string; playerId: number; onLoginRefused: () => void };

/** The screen of one game at /games/:id; everything shown comes from `viewGame` (add-game-screen, D4). */
export default function GameScreen({ initData, playerId, onLoginRefused }: Props) {
  const id = Number(useParams().id);
  const { game, offline, move } = useGame(initData, id, onLoginRefused);

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

  if (!hasOpponent(game)) {
    return (
      <section className={styles.screen} aria-labelledby="game-heading">
        {back}
        <h2 id="game-heading" className={ui.heading}>
          Гра: {game.exercise}
        </h2>
        {offline && (
          <p role="status" className={styles.offline}>
            Немає зв'язку, пробуємо ще
          </p>
        )}
        {game.invite_url !== null && <WaitingForOpponent inviteUrl={game.invite_url} />}
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

      {/* Reading order stays "Ти 3 : 1 <name>"; the grid puts each name under its points (D5). */}
      <section aria-label="Рахунок" className={styles.board}>
        <span className={`${styles.side} ${styles.me}`}>Ти</span>{" "}
        <span className={`${styles.points} ${styles.mine} digits`}>{view.myPoints}</span>{" "}
        <span className={styles.colon}>:</span>{" "}
        <span className={`${styles.points} ${styles.theirs} digits`}>{view.theirPoints}</span>{" "}
        <span className={`${styles.side} ${styles.other}`}>{view.otherName}</span>
      </section>

      {view.end && (
        <div className={styles.end}>
          <p className={styles.headline}>{view.end.headline}</p>
          {view.end.penalty && <p className={styles.penalty}>{view.end.penalty}</p>}
        </div>
      )}

      {/* The result comes before the next round's field, so the one who lost sees the penalty first (D2). */}
      {view.card && <ResultCard card={view.card} />}

      {view.phase.kind !== "over" && (
        <CurrentRound
          phase={view.phase}
          otherName={view.otherName}
          onGuess={(value) => move(() => sendGuess(initData, id, value))}
          onActual={(value) => move(() => sendActual(initData, id, value))}
        />
      )}

      {view.history.length > 0 && (
        <section className={styles.history}>
          <h3 id="history-heading" className={styles.subheading}>
            Історія раундів
          </h3>
          <ol aria-labelledby="history-heading" className={styles.rounds}>
            {view.history.map((round) => (
              <li key={round.number} className={styles.round}>
                <HistoryLines round={round} />
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
          <div className={styles.explain}>
            <p className={styles.question}>Скільки людей зараз у залі?</p>
            {/* A no-break space keeps the dash off the start of a line on a narrow phone. */}
            <p className={styles.hint}>{"Ближча здогадка отримує бал. Гра — до 5 балів."}</p>
          </div>
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
            <>
              <p className={styles.question}>Скільки людей показує апка залу?</p>
              <NumberEntry
                id="actual"
                label="Реальна кількість"
                confirmText={(value) => `Реальна кількість ${value}? Це закриє раунд.`}
                onSend={onActual}
              />
            </>
          ) : (
            <p className={styles.hint}>Чекаємо реальну кількість від суперника</p>
          )}
        </>
      )}
    </section>
  );
}

/** The round just settled: outcome and penalty first, then the numbers; an exact guess stands out (D2–D3). */
function ResultCard({ card }: { card: CardView }) {
  return (
    <section aria-labelledby="card-heading" className={styles.card}>
      <h3 id="card-heading" className={styles.subheading}>
        Підсумок раунду {card.number}
      </h3>
      <div className={styles.lines}>
        <p className={styles.outcome}>{card.outcome}</p>
        {card.penalty && <p className={styles.penalty}>{card.penalty}</p>}
        <p>{card.actual}</p>
        {card.guesses.map((guess) => (
          <p key={guess.text} className={guess.exact ? styles.exact : undefined}>
            {guess.text}
          </p>
        ))}
      </div>
    </section>
  );
}

function HistoryLines({ round }: { round: HistoryItem }) {
  return (
    // Paragraphs, not a list: the history items must stay the only list items of the history list.
    <div className={styles.lines}>
      <p className={styles.roundNumber}>{round.title}</p>
      <p>{round.guesses}</p>
      <p className={styles.outcome}>{round.outcome}</p>
      {round.penalty && <p className={styles.penalty}>{round.penalty}</p>}
    </div>
  );
}

const SHARE_TEXT = "Зіграй зі мною в Gym Challenge";

/**
 * The organizer's waiting game: the invite link to send in Telegram (game-invites, design D8). No Telegram script:
 * copy works everywhere; the share link opens Telegram's chat picker. `encodeURIComponent`, not URLSearchParams,
 * which would write spaces as `+`.
 */
function WaitingForOpponent({ inviteUrl }: { inviteUrl: string }) {
  const [copied, setCopied] = useState<"no" | "yes" | "failed">("no");
  const share = `https://t.me/share/url?url=${encodeURIComponent(inviteUrl)}&text=${encodeURIComponent(SHARE_TEXT)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied("yes");
    } catch {
      // No clipboard API (an old web view) or permission refused.
      setCopied("failed");
    }
  }

  return (
    <section aria-labelledby="invite-heading" className={styles.invite}>
      <h3 id="invite-heading" className={styles.subheading}>
        Чекаємо суперника. Надішли посилання на гру.
      </h3>
      <p className={styles.inviteUrl}>{inviteUrl}</p>
      <div className={styles.inviteActions}>
        <button type="button" className={ui.secondary} onClick={copy}>
          Копіювати посилання
        </button>
        <a className={`${ui.primary} ${styles.share}`} href={share} target="_blank" rel="noopener noreferrer">
          Надіслати в Telegram
        </a>
      </div>
      {copied === "yes" && (
        <p role="status" className={styles.hint}>
          Скопійовано
        </p>
      )}
      {copied === "failed" && (
        <p role="alert" className={ui.error}>
          Не вдалося скопіювати. Виділи посилання й скопіюй вручну.
        </p>
      )}
    </section>
  );
}
