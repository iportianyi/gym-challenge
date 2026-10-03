import { useState, type FormEvent, type ReactNode } from "react";

import { createGame, UnknownPlayerError, type Game } from "../api/games";
import styles from "./NewGameForm.module.css";
import ui from "./ui.module.css";

type Props = {
  playerId: number;
  onCreated: (game: Game) => void;
  onCancel: () => void;
  onUnknownPlayer: () => void;
};

const SERVER_ERRORS: Record<string, string> = {
  "Opponent not found": "Гравця з таким email немає",
  "Cannot play against yourself": "Це твій email. Введи email суперника.",
};
const GENERIC_ERROR = "Не вдалося створити гру. Перевір поля.";
const NETWORK_ERROR = "Сервер недоступний. Спробуй ще раз.";

/** A 422 stays on the form with a Ukrainian message; a 401 hands back to the picker via `onUnknownPlayer`. */
export default function NewGameForm({ playerId, onCreated, onCancel, onUnknownPlayer }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSending(true);
    setError(null);
    try {
      const result = await createGame(playerId, {
        opponent_email: String(form.get("opponent_email")),
        exercise: String(form.get("exercise")),
        base_reps: Number(form.get("base_reps")),
        step_reps: Number(form.get("step_reps")),
        final_reps: Number(form.get("final_reps")),
      });
      if (result.ok) {
        onCreated(result.game);
        return;
      }
      setError(SERVER_ERRORS[String(result.detail)] ?? GENERIC_ERROR);
    } catch (caught) {
      if (caught instanceof UnknownPlayerError) {
        onUnknownPlayer();
        return;
      }
      setError(NETWORK_ERROR);
    }
    setSending(false);
  }

  return (
    <section className={styles.section} aria-labelledby="new-game-heading">
      <h2 id="new-game-heading" className={ui.heading}>
        Нова гра
      </h2>
      <form className={styles.form} onSubmit={submit}>
        <Field id="opponent_email" label="Email суперника">
          <input id="opponent_email" name="opponent_email" type="email" required autoComplete="off" />
        </Field>
        {error && (
          <p className={ui.error} role="alert">
            {error}
          </p>
        )}
        <Field id="exercise" label="Вправа">
          <input id="exercise" name="exercise" type="text" required maxLength={60} />
        </Field>
        <Field id="base_reps" label="Повторень за першу поразку">
          <RepsInput id="base_reps" min={1} />
        </Field>
        <Field id="step_reps" label="Додати за кожну наступну поразку поспіль">
          <RepsInput id="step_reps" min={0} />
        </Field>
        <Field id="final_reps" label="Повторень за програну гру">
          <RepsInput id="final_reps" min={1} />
        </Field>
        <div className={styles.actions}>
          <button type="submit" className={ui.primary} disabled={sending}>
            Почати гру
          </button>
          <button type="button" className={ui.secondary} onClick={onCancel}>
            Скасувати
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function RepsInput({ id, min }: { id: string; min: number }) {
  return (
    <input
      id={id}
      name={id}
      className={`${styles.reps} digits`}
      type="number"
      inputMode="numeric"
      required
      min={min}
      max={1000}
      step={1}
    />
  );
}
