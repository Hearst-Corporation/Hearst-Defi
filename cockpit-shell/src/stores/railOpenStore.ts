/**
 * railOpenStore.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Chat rail width modes: collapsed (48px) · default (352px) · expanded (420px).
 * SSR-safe via `getServerSnapshot` / `getModeServerSnapshot`.
 */

export type RailRightMode = "collapsed" | "default" | "expanded";

const LS_KEY_MODE = "cockpit:rail-right-mode";
const LS_KEY_LAST_OPEN = "cockpit:rail-right-last-open";
/** @deprecated Migrated to LS_KEY_MODE — kept in sync on write for legacy readers. */
const LS_KEY_LEGACY = "cockpit:rail-right-open";

type OpenMode = "default" | "expanded";
type Listener = () => void;

const listeners = new Set<Listener>();

function isOpenMode(value: string | null): value is OpenMode {
  return value === "default" || value === "expanded";
}

function isRailMode(value: string | null): value is RailRightMode {
  return value === "collapsed" || value === "default" || value === "expanded";
}

function readLastOpenMode(): OpenMode {
  if (typeof window === "undefined") return "default";
  const stored = window.localStorage.getItem(LS_KEY_LAST_OPEN);
  return isOpenMode(stored) ? stored : "default";
}

function readMode(): RailRightMode {
  if (typeof window === "undefined") return "default";

  const stored = window.localStorage.getItem(LS_KEY_MODE);
  if (isRailMode(stored)) return stored;

  const legacy = window.localStorage.getItem(LS_KEY_LEGACY);
  if (legacy === "0") return "collapsed";
  return "default";
}

function persistMode(mode: RailRightMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_KEY_MODE, mode);
  window.localStorage.setItem(LS_KEY_LEGACY, mode === "collapsed" ? "0" : "1");
  if (mode === "default" || mode === "expanded") {
    window.localStorage.setItem(LS_KEY_LAST_OPEN, mode);
  }
}

function subscribe(cb: Listener): () => void {
  listeners.add(cb);

  const onStorage = (e: StorageEvent) => {
    if (
      e.key === LS_KEY_MODE ||
      e.key === LS_KEY_LEGACY ||
      e.key === LS_KEY_LAST_OPEN
    ) {
      cb();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function notifyAll(): void {
  listeners.forEach((cb) => cb());
}

/** @deprecated Prefer `getModeSnapshot` — true when rail is not collapsed. */
function getSnapshot(): boolean {
  return readMode() !== "collapsed";
}

function getServerSnapshot(): boolean {
  return true;
}

function getModeSnapshot(): RailRightMode {
  return readMode();
}

function getModeServerSnapshot(): RailRightMode {
  return "default";
}

function toggle(): void {
  const mode = readMode();
  if (mode === "collapsed") {
    persistMode(readLastOpenMode());
  } else {
    persistMode("collapsed");
  }
  notifyAll();
}

/** Cycle default ↔ expanded when the rail is open. */
function toggleWidth(): void {
  const mode = readMode();
  if (mode === "collapsed") return;
  persistMode(mode === "expanded" ? "default" : "expanded");
  notifyAll();
}

function forceOpen(): void {
  const mode = readMode();
  if (mode === "collapsed") {
    persistMode(readLastOpenMode());
    notifyAll();
  }
}

export {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  getModeSnapshot,
  getModeServerSnapshot,
  toggle,
  toggleWidth,
  forceOpen,
};
