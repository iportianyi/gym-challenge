import type { InvitePreview } from "../api/invites";
import { inviteLines } from "../game/invite";
import styles from "./InviteScreen.module.css";
import ui from "./ui.module.css";

type Props = { invite: InvitePreview; onAccept: () => void; onDecline: () => void };

/**
 * An invite before it is accepted: who invites and what a lost round and a lost game cost (invite-preview-accept).
 * `Відмовитись` sends nothing; the forward action is on the right, as in the number entry's confirm step (D2).
 */
export default function InviteScreen({ invite, onAccept, onDecline }: Props) {
  const lines = inviteLines(invite);
  return (
    <section className={styles.screen} aria-labelledby="invite-title">
      <h2 id="invite-title" className={ui.heading}>
        {lines.title}
      </h2>
      <div className={styles.card}>
        <p className={styles.invitedBy}>{lines.invitedBy}</p>
        <ul className={styles.terms}>
          {lines.terms.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
      </div>
      <div className={styles.actions}>
        <button type="button" className={ui.secondary} onClick={onDecline}>
          Відмовитись
        </button>
        <button type="button" className={ui.primary} onClick={onAccept}>
          Прийняти
        </button>
      </div>
    </section>
  );
}
