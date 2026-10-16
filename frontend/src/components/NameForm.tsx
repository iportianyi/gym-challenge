import { useState, type FormEvent } from "react";

import { LoginRefusedError } from "../api/http";
import { fetchMe, registerMe, type Player } from "../api/players";
import { firstName } from "../telegram";
import styles from "./NameForm.module.css";
import ui from "./ui.module.css";

type Props = { initData: string; onRegistered: (player: Player) => void; onLoginRefused: () => void };

const NAME_RULE = "Ім'я — від 1 до 40 символів";
const NETWORK_ERROR = "Не вдалося зв'язатися з сервером.";

/** The first login: the name the other players will see, prefilled from Telegram (players spec). */
export default function NameForm({ initData, onRegistered, onLoginRefused }: Props) {
  const [name, setName] = useState(() => firstName(initData));
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    // Counted in code points, as the server counts characters.
    const length = [...trimmed].length;
    if (length < 1 || length > 40) {
      setError(NAME_RULE);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await registerMe(initData, trimmed);
      if (typeof result === "object") return onRegistered(result);
      if (result === 409) {
        // Registered meanwhile in another tab: continue as that player.
        const me = await fetchMe(initData);
        if (me !== "not-registered") return onRegistered(me);
      }
      setError(result === 422 ? NAME_RULE : NETWORK_ERROR);
    } catch (caught) {
      if (caught instanceof LoginRefusedError) return onLoginRefused();
      setError(NETWORK_ERROR);
    }
    setSending(false);
  }

  return (
    <section className={styles.section} aria-labelledby="name-heading">
      <h2 id="name-heading" className={ui.heading}>
        Як тебе звати?
      </h2>
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.field}>
          <label htmlFor="player_name">Твоє ім'я</label>
          <input
            id="player_name"
            name="name"
            type="text"
            autoComplete="given-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        {error && (
          <p className={ui.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={ui.primary} disabled={sending}>
          Почати
        </button>
      </form>
    </section>
  );
}
