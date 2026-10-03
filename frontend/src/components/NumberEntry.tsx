import { useState, type FormEvent } from "react";

import styles from "./GameScreen.module.css";
import ui from "./ui.module.css";

type Props = {
  id: string;
  label: string;
  confirmText: (value: number) => string;
  onSend: (value: number) => Promise<void>;
};

const MAX = 500;
const RANGE_ERROR = `Введи ціле число від 0 до ${MAX}`;

/**
 * A number that cannot be taken back: edit it, then confirm it inside the card (add-game-screen, D6). The range
 * is the server's (0–500), checked here so the person sees the reason before anything is sent.
 */
export default function NumberEntry({ id, label, confirmText, onSend }: Props) {
  const [text, setText] = useState("");
  const [confirming, setConfirming] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);

  function next(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(text);
    if (!/^\d+$/.test(text.trim()) || value > MAX) {
      setError(true);
      return;
    }
    setError(false);
    setConfirming(value);
  }

  async function send(value: number) {
    setSending(true);
    await onSend(value);
    setSending(false);
  }

  if (confirming !== null) {
    return (
      <div className={styles.entry}>
        <p className={styles.confirm}>{confirmText(confirming)}</p>
        <div className={styles.actions}>
          <button type="button" className={ui.primary} disabled={sending} onClick={() => void send(confirming)}>
            Надіслати
          </button>
          <button type="button" className={ui.secondary} disabled={sending} onClick={() => setConfirming(null)}>
            Змінити
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.entry} onSubmit={next} noValidate>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        className={`${styles.number} digits`}
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX}
        step={1}
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoComplete="off"
      />
      {error && (
        <p className={ui.error} role="alert">
          {RANGE_ERROR}
        </p>
      )}
      <button type="submit" className={ui.primary}>
        Далі
      </button>
    </form>
  );
}
