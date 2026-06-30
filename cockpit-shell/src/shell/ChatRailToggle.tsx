"use client";

import { useSyncExternalStore } from "react";

import {
  subscribe,
  getModeSnapshot,
  getModeServerSnapshot,
  toggle,
} from "../stores/railOpenStore";

/**
 * Chat-rail open/close control, lifted OUT of the rail and placed next to the
 * other top-right controls (search ⌘K + notifications). When the rail is fully
 * closed there is no leftover 48px handle — this button is the single way to
 * bring the assistant back. When open, it reads as the "collapse" affordance.
 *
 * Shares the SAME railOpenStore as RailRight, so the two stay in lockstep:
 * clicking here toggles collapsed ↔ last-open mode.
 */
export function ChatRailToggle() {
  const mode = useSyncExternalStore(
    subscribe,
    getModeSnapshot,
    getModeServerSnapshot,
  );
  const open = mode !== "collapsed";

  return (
    <button
      type="button"
      data-testid="chat-trigger"
      onClick={toggle}
      aria-label={open ? "Close assistant" : "Open assistant"}
      aria-expanded={open}
      title={open ? "Close assistant" : "Open assistant"}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--ct-border-soft)] bg-[var(--ct-surface-card)] text-[var(--ct-text-muted)] transition-colors duration-150 hover:text-[var(--ct-text-strong)] hover:border-[var(--ct-border)]"
    >
      {/* Chat bubble glyph — neutral, matches the dock's icon weight. */}
      <svg
        className="h-4 w-4"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2.5 4.5C2.5 3.67 3.17 3 4 3h8c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5H6.5L4 13v-2H4c-.83 0-1.5-.67-1.5-1.5v-5Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
