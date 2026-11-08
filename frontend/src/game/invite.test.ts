// The words of the invite screen (invite-preview-accept, design D3), without rendering.
import { describe, expect, it } from "vitest";

import type { InvitePreview } from "../api/invites";
import { inviteLines } from "./invite";

const PREVIEW: InvitePreview = {
  organizer: { id: 1, name: "Клієнт" },
  exercise: "Присідання",
  base_reps: 10,
  step_reps: 5,
  final_reps: 30,
  role: "invited",
};

describe("invite lines", () => {
  it("name the organizer and every penalty, with no-break spaces", () => {
    expect(inviteLines(PREVIEW)).toEqual({
      title: "Гра: Присідання",
      invitedBy: "Клієнт кличе тебе в\u00a0гру",
      terms: [
        "Покарання за раунд: Присідання × 10",
        "+5 за кожну поразку поспіль",
        "Покарання за програну гру: Присідання × 30",
        "Гра — до 5 балів",
      ],
    });
  });

  it("leave out the streak line when the step is 0", () => {
    expect(inviteLines({ ...PREVIEW, step_reps: 0 }).terms).toEqual([
      "Покарання за раунд: Присідання × 10",
      "Покарання за програну гру: Присідання × 30",
      "Гра — до 5 балів",
    ]);
  });
});
