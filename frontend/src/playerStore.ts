/** The chosen player lives in this browser's localStorage; storage can be missing or blocked (private mode). */
const KEY = "gym-challenge.player-id";

export function loadPlayerId(): number | null {
  try {
    const value = localStorage.getItem(KEY);
    return value !== null && /^\d+$/.test(value) ? Number(value) : null;
  } catch {
    return null;
  }
}

export function savePlayerId(id: number): void {
  try {
    localStorage.setItem(KEY, String(id));
  } catch {
    // Without storage the choice lasts until the page reloads.
  }
}

export function clearPlayerId(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}
