/** True only when GET /api/health answers 200 with {"status": "ok"}; false on any other status or a network error. */
export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch("/api/health", { signal, headers: { Accept: "application/json" } });
    if (response.status !== 200) return false;
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null && (body as { status?: unknown }).status === "ok";
  } catch {
    return false;
  }
}
