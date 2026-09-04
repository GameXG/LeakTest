export const recentSessionStorageKey = "leaktest-last-session-id";

export function saveRecentSessionId(sessionId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(recentSessionStorageKey, sessionId);
}

export function readRecentSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(recentSessionStorageKey);
}
