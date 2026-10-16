/**
 * The Telegram login of this tab (telegram-auth, design D7). Telegram opens the Mini App with launch parameters in
 * the URL fragment; `tgWebAppData` is the raw `initData` the server checks. It is kept in sessionStorage, as
 * Telegram's own script does, so a reload in the same tab keeps it; storage can be blocked, then memory is used.
 */
const KEY = "gym-challenge.init-data";

let memory: string | null = null;

function keep(initData: string) {
  try {
    sessionStorage.setItem(KEY, initData);
  } catch {
    memory = initData;
  }
}

function kept(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return memory;
  }
}

/** Takes `initData` from the launch parameters (and clears them from the address), or the one kept for the tab. */
export function takeInitData(): string | null {
  const launched = new URLSearchParams(window.location.hash.slice(1)).get("tgWebAppData");
  if (!launched) return kept();
  keep(launched);
  // The router should see a clean path; the parameters are not needed again.
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  return launched;
}

/** After the server refused the login: the next load asks to open the app from Telegram again. */
export function forgetInitData() {
  memory = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing kept, nothing to forget.
  }
}

/** The Telegram first name, only to prefill the name form; the server decides who the user is. */
export function firstName(initData: string): string {
  try {
    const user: unknown = JSON.parse(new URLSearchParams(initData).get("user") ?? "");
    const name = (user as { first_name?: unknown } | null)?.first_name;
    return typeof name === "string" ? name : "";
  } catch {
    return "";
  }
}
