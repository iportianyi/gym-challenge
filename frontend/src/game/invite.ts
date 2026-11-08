import type { InvitePreview } from "../api/invites";

/** The backend's `WINNING_SCORE` (backend/app/rules.py): the first to this many points wins. */
const WINNING_SCORE = 5;

// No-break spaces keep "× 10" with the exercise and the dash off a line start (clarify-round-and-result, D4).
const NBSP = " ";

/** The words of the invite screen (invite-preview-accept, design D3); no grammatical gender, no declension. */
export type InviteLines = {
  title: string;
  invitedBy: string;
  /** Round penalty, the streak step (only when it is above 0), final penalty, points to win. */
  terms: string[];
};

export function inviteLines(invite: InvitePreview): InviteLines {
  const reps = (count: number) => `${invite.exercise}${NBSP}×${NBSP}${count}`;
  return {
    title: `Гра: ${invite.exercise}`,
    invitedBy: `${invite.organizer.name} кличе тебе в гру`,
    terms: [
      `Покарання за раунд: ${reps(invite.base_reps)}`,
      ...(invite.step_reps > 0 ? [`+${invite.step_reps} за кожну поразку поспіль`] : []),
      `Покарання за програну гру: ${reps(invite.final_reps)}`,
      `Гра${NBSP}— до ${WINNING_SCORE} балів`,
    ],
  };
}
