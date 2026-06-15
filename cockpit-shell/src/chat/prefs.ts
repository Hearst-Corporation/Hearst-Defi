/** Client-only chat display prefs (localStorage). */

export const LS_MARKDOWN = "cockpit:chat-markdown";

const LEGACY_KEYS = [
  "cockpit:hypercli-key",
  "cockpit:chat-model",
  "cockpit:chat-show-think",
] as const;

const markdownListeners = new Set<() => void>();

function notifyMarkdownListeners(): void {
  for (const listener of markdownListeners) {
    listener();
  }
}

/** Drop retired devhub/Hypercli keys on first settings mount. */
export function purgeLegacyChatPrefs(): void {
  if (typeof window === "undefined") return;
  for (const key of LEGACY_KEYS) {
    window.localStorage.removeItem(key);
  }
}

export function isChatMarkdownEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(LS_MARKDOWN) !== "0";
}

export function setChatMarkdownEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_MARKDOWN, enabled ? "1" : "0");
  notifyMarkdownListeners();
}

export function subscribeChatMarkdown(onStoreChange: () => void): () => void {
  markdownListeners.add(onStoreChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === LS_MARKDOWN) onStoreChange();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    markdownListeners.delete(onStoreChange);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}
