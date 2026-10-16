import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { createGame, type Game, type NewGame } from "../api/games";
import { LoginRefusedError } from "../api/http";
import { fetchOpponents, type Player } from "../api/players";
import styles from "./NewGameForm.module.css";
import ui from "./ui.module.css";

type Props = {
  initData: string;
  onCreated: (game: Game) => void;
  onCancel: () => void;
  onLoginRefused: () => void;
};

const SERVER_ERRORS: Record<string, string> = {
  "Opponent not found": "Такого гравця немає. Обери іншого.",
};
const GENERIC_ERROR = "Не вдалося створити гру. Перевір поля.";
const NETWORK_ERROR = "Сервер недоступний. Спробуй ще раз.";

/**
 * A 422 stays on the form with a Ukrainian message; a 401 goes to the refused-login message via `onLoginRefused`.
 * The opponent is someone already played with, or nobody yet: an invite game with a link (game-invites).
 */
export default function NewGameForm({ initData, onCreated, onCancel, onLoginRefused }: Props) {
  const [opponents, setOpponents] = useState<Player[] | "loading" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchOpponents(initData, controller.signal).then(setOpponents, (caught: unknown) => {
      if (controller.signal.aborted) return;
      if (caught instanceof LoginRefusedError) onLoginRefused();
      else setOpponents("error");
    });
    return () => controller.abort();
  }, [initData, onLoginRefused]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const opponentId = String(form.get("opponent_id") ?? "");
    const game: NewGame = {
      exercise: String(form.get("exercise")),
      base_reps: Number(form.get("base_reps")),
      step_reps: Number(form.get("step_reps")),
      final_reps: Number(form.get("final_reps")),
    };
    // The first option, the invite, has no value: the body then has no opponent_id.
    if (opponentId !== "") game.opponent_id = Number(opponentId);
    setSending(true);
    setError(null);
    try {
      const result = await createGame(initData, game);
      if (result.ok) {
        onCreated(result.game);
        return;
      }
      setError(SERVER_ERRORS[String(result.detail)] ?? GENERIC_ERROR);
    } catch (caught) {
      if (caught instanceof LoginRefusedError) {
        onLoginRefused();
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
        <Field id="opponent_id" label="Суперник">
          <select id="opponent_id" name="opponent_id" defaultValue="" aria-describedby="opponent_note">
            <option value="">Запросити за посиланням</option>
            {Array.isArray(opponents) &&
              opponents.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
          </select>
          <p id="opponent_note" className={styles.hint}>
            {opponents === "error" && "Не вдалося завантажити знайомих суперників."}
          </p>
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
