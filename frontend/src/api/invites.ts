// Hand-written to match backend/app/api/invites.py (invite-preview-accept, design D1).
import type { PlayerRef } from "./games";
import { headers, LoginRefusedError } from "./http";

/** Who invites and to what; `role` is the viewer's: their own link, already joined, or still to accept. */
export type InvitePreview = {
  organizer: PlayerRef;
  exercise: string;
  base_reps: number;
  step_reps: number;
  final_reps: number;
  role: "organizer" | "opponent" | "invited";
};

/** POST /api/invites/preview answers the invite, or why it cannot be joined (409, 404), as join does. */
export type PreviewResult = InvitePreview | "used" | "not-found";

export async function previewInvite(initData: string, token: string, signal?: AbortSignal): Promise<PreviewResult> {
  const response = await fetch("/api/invites/preview", {
    method: "POST",
    signal,
    headers: headers(initData),
    body: JSON.stringify({ token }),
  });
  if (response.status === 401) throw new LoginRefusedError();
  if (response.status === 409) return "used";
  if (response.status === 404) return "not-found";
  if (response.status !== 200) throw new Error(`POST /api/invites/preview answered ${response.status}`);
  return (await response.json()) as InvitePreview;
}
