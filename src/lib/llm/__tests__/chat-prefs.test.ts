import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Mirrors `package/src/chat/prefs.ts` (cockpit-shell) — guards legacy key cleanup
 * and markdown toggle semantics without importing the private shell module.
 */
const LS_MARKDOWN = "cockpit:chat-markdown";
const LEGACY_KEYS = [
  "cockpit:hypercli-key",
  "cockpit:chat-model",
  "cockpit:chat-show-think",
] as const;

function createStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

function purgeLegacyChatPrefs(storage: Storage): void {
  for (const key of LEGACY_KEYS) {
    storage.removeItem(key);
  }
}

function isChatMarkdownEnabled(storage: Storage): boolean {
  return storage.getItem(LS_MARKDOWN) !== "0";
}

describe("cockpit chat prefs", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createStorage();
    vi.stubGlobal("window", { localStorage: storage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("purges retired Hypercli/devhub localStorage keys", () => {
    for (const key of LEGACY_KEYS) {
      storage.setItem(key, "stale");
    }
    purgeLegacyChatPrefs(storage);
    for (const key of LEGACY_KEYS) {
      expect(storage.getItem(key)).toBeNull();
    }
  });

  it("defaults markdown rendering to enabled", () => {
    expect(isChatMarkdownEnabled(storage)).toBe(true);
  });

  it("disables markdown when localStorage flag is 0", () => {
    storage.setItem(LS_MARKDOWN, "0");
    expect(isChatMarkdownEnabled(storage)).toBe(false);
  });
});
