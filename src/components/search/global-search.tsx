"use client";

/**
 * GlobalSearch — ⌘/ modal overlay.
 *
 * Features:
 * - Auto-focus input on mount
 * - Live search (debounced 200ms) against /api/search
 * - Address / tx-hash / id-prefix direct-jump detection
 * - Results grouped by entity section with badges
 * - Keyboard navigation (↑↓ + Enter)
 * - Recent searches stored in localStorage
 * - Hardcoded suggestions when input is empty
 * - Focus trap + Escape to close
 * - role="dialog" aria-modal="true", listbox/option a11y
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import {
  ENTITY_META,
  type Entity,
  type SearchResult,
  type SearchApiResponse,
} from "@/lib/search/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECENT_KEY = "hc:search:recent";
const MAX_RECENT = 5;
const DEBOUNCE_MS = 200;

const SUGGESTIONS = [
  { label: "HYV-A", hint: "Active vault" },
  { label: "0x712a", hint: "Wallet address prefix" },
  { label: "Q3 memo", hint: "Investor memo" },
  { label: "distribution 2026", hint: "USDC distributions" },
  { label: "mining_attestation", hint: "Proof type" },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

interface RecentEntry {
  query: string;
  href?: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRecent(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as RecentEntry[];
  } catch {
    return [];
  }
}

function saveRecent(entry: RecentEntry): void {
  const prev = getRecent().filter((r) => r.query !== entry.query);
  const next = [entry, ...prev].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

function groupByEntity(results: SearchResult[]): Map<Entity, SearchResult[]> {
  const map = new Map<Entity, SearchResult[]>();
  for (const r of results) {
    const bucket = map.get(r.entity) ?? [];
    bucket.push(r);
    map.set(r.entity, bucket);
  }
  return map;
}

// ---------------------------------------------------------------------------
// EntityBadge
// ---------------------------------------------------------------------------

function EntityBadge({ entity }: { entity: Entity }) {
  const meta = ENTITY_META[entity];
  return (
    <span
      className="inline-flex items-center rounded-full border border-[var(--ct-border)] ct-surface-1 px-2 py-0.5 text-[length:var(--ct-text-micro)] font-medium uppercase tracking-[var(--ct-tracking-wide)]"
      style={{ color: meta.color }}
      aria-label={meta.label}
    >
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ResultItem
// ---------------------------------------------------------------------------

function ResultItem({
  result,
  isSelected,
  onMouseEnter,
  onClick,
  optionId,
}: {
  result: SearchResult;
  isSelected: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
  optionId: string;
}) {
  return (
    <button
      id={optionId}
      role="option"
      aria-selected={isSelected}
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
        isSelected
          ? "ct-surface-3 ct-text-strong"
          : "ct-text-body hover:ct-surface-2",
      )}
    >
      <EntityBadge entity={result.entity} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {result.title}
        </span>
        {result.subtitle && (
          <span className="block truncate text-xs ct-text-muted">
            {result.subtitle}
          </span>
        )}
      </span>
      {result.badge && (
        <span className="shrink-0 rounded-sm border border-[var(--ct-border-soft)] ct-surface-1 px-1.5 py-0.5 text-[length:var(--ct-text-micro)] ct-text-muted">
          {result.badge}
        </span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface GlobalSearchProps {
  onClose: () => void;
}

export function GlobalSearch({ onClose }: GlobalSearchProps) {
  const dialogId = useId();
  const inputId = useId();
  const listboxId = useId();

  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  // Lazy initialiser so we read localStorage only once, on mount (client-side).
  const [recent, setRecent] = useState<RecentEntry[]>(() => getRecent());

  // Capture trigger element, auto-focus input, restore focus on unmount
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(id);
      triggerRef.current?.focus?.();
    };
  }, []);

  // Escape + focus trap
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) { e.preventDefault(); return; }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Flat list of navigable results (for arrow key nav)
  const flatResults = results;

  // Debounced search — all setState calls happen inside the async timer callback
  // (async external system) to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    const q = query.trim();

    const timer = window.setTimeout(async () => {
      if (q.length === 0) {
        setResults([]);
        setSelectedIndex(-1);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`search ${res.status}`);
        const data = (await res.json()) as SearchApiResponse;

        // Direct jump — navigate immediately
        if (data.directJump && data.directHref) {
          saveRecent({ query: q, href: data.directHref, timestamp: Date.now() });
          setRecent(getRecent());
          onClose();
          router.push(data.directHref);
          return;
        }

        setResults(data.results);
        setSelectedIndex(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query, onClose, router]);

  // Navigate to result
  const navigate = useCallback(
    (result: SearchResult) => {
      saveRecent({ query: query.trim(), href: result.href, timestamp: Date.now() });
      setRecent(getRecent());
      onClose();
      router.push(result.href);
    },
    [query, onClose, router],
  );

  // Keyboard navigation in the input
  function onInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = flatResults[selectedIndex];
      if (selected) navigate(selected);
    }
  }

  const grouped = groupByEntity(results);
  const showEmpty = query.trim().length === 0;
  const showResults = !showEmpty && results.length > 0 && !loading;
  const showNoResults =
    !showEmpty && !loading && results.length === 0 && query.trim().length > 0;

  // Map from flat index → result (for aria-activedescendant)
  const getOptionId = (idx: number) => `${listboxId}-opt-${idx}`;

  return (
    <div
      className="fixed inset-0 z-[var(--ct-z-modal)] flex items-start justify-center pt-[10vh] px-4"
      role="presentation"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[var(--ct-bg-deep)]/75 backdrop-blur-sm"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        id={dialogId}
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-[var(--ct-border-strong)] ct-surface-2 shadow-[var(--ct-shadow-elevated)]"
      >
        {/* Search input row */}
        <div className="flex items-center gap-2 border-b border-[var(--ct-border-soft)] px-4 py-3">
          {/* Search icon */}
          <svg
            aria-hidden="true"
            className="h-4 w-4 shrink-0 ct-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>

          <label htmlFor={inputId} className="sr-only">
            Search
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={showResults}
            aria-controls={listboxId}
            aria-activedescendant={
              selectedIndex >= 0 ? getOptionId(selectedIndex) : undefined
            }
            aria-autocomplete="list"
            placeholder="Search vaults, investors, proofs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            className="min-w-0 flex-1 bg-transparent text-sm ct-text-strong placeholder:ct-text-muted focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />

          {/* Loading spinner */}
          {loading && (
            <svg
              aria-label="Loading"
              className="h-4 w-4 shrink-0 animate-spin ct-text-muted"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
          )}

          {/* Kbd hint */}
          <kbd className="hidden shrink-0 rounded-sm border border-[var(--ct-border)] ct-surface-1 px-1.5 py-0.5 text-[length:var(--ct-text-micro)] ct-text-muted sm:inline-block">
            esc
          </kbd>
        </div>

        {/* Results / Empty state */}
        <div className="max-h-[60vh] overflow-y-auto">
          {/* Empty state — recent searches + suggestions */}
          {showEmpty && (
            <div className="p-4 space-y-4">
              {recent.length > 0 && (
                <section aria-label="Recent searches">
                  <p className="mb-2 text-[length:var(--ct-text-xs)] font-semibold uppercase tracking-[var(--ct-tracking-wide)] ct-text-muted">
                    Recent
                  </p>
                  <ul className="space-y-1">
                    {recent.map((entry) => (
                      <li key={entry.timestamp}>
                        <button
                          type="button"
                          onClick={() => {
                            if (entry.href) {
                              onClose();
                              router.push(entry.href);
                            } else {
                              setQuery(entry.query);
                            }
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm ct-text-body hover:ct-surface-3 transition-colors"
                        >
                          <svg
                            aria-hidden="true"
                            className="h-3 w-3 shrink-0 ct-text-muted"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                          >
                            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="truncate">{entry.query}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section aria-label="Suggestions">
                <p className="mb-2 text-[length:var(--ct-text-xs)] font-semibold uppercase tracking-[var(--ct-tracking-wide)] ct-text-muted">
                  Suggestions
                </p>
                <ul className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <li key={s.label}>
                      <button
                        type="button"
                        title={s.hint}
                        onClick={() => setQuery(s.label)}
                        className="rounded-full border border-[var(--ct-border)] ct-surface-1 px-3 py-1 text-xs ct-text-muted hover:border-[var(--ct-border-strong)] hover:ct-text-strong transition-colors"
                      >
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {/* No results */}
          {showNoResults && (
            <p className="px-4 py-8 text-center text-sm ct-text-muted">
              No results for{" "}
              <span className="font-medium ct-text-strong">
                &ldquo;{query}&rdquo;
              </span>
            </p>
          )}

          {/* Results grouped by entity */}
          {showResults && (
            <div
              id={listboxId}
              role="listbox"
              aria-label="Search results"
              className="p-2 space-y-4"
            >
              {Array.from(grouped.entries()).map(([entity, items]) => {
                return (
                  <section key={entity} aria-label={ENTITY_META[entity].label}>
                    <p className="mb-1 px-3 text-[length:var(--ct-text-xs)] font-semibold uppercase tracking-[var(--ct-tracking-wide)] ct-text-muted">
                      {ENTITY_META[entity].label}
                    </p>
                    <ul>
                      {items.map((result) => {
                        const flatIdx = flatResults.indexOf(result);
                        return (
                          <li key={result.id}>
                            <ResultItem
                              result={result}
                              isSelected={flatIdx === selectedIndex}
                              onMouseEnter={() => setSelectedIndex(flatIdx)}
                              onClick={() => navigate(result)}
                              optionId={getOptionId(flatIdx)}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 border-t border-[var(--ct-border-soft)] px-4 py-2">
          <span className="text-[length:var(--ct-text-xs)] ct-text-muted">
            <kbd className="rounded-sm border border-[var(--ct-border)] ct-surface-1 px-1 py-0.5">
              ↑↓
            </kbd>{" "}
            navigate
          </span>
          <span className="text-[length:var(--ct-text-xs)] ct-text-muted">
            <kbd className="rounded-sm border border-[var(--ct-border)] ct-surface-1 px-1 py-0.5">
              ↵
            </kbd>{" "}
            open
          </span>
          <span className="text-[length:var(--ct-text-xs)] ct-text-muted">
            <kbd className="rounded-sm border border-[var(--ct-border)] ct-surface-1 px-1 py-0.5">
              esc
            </kbd>{" "}
            close
          </span>
        </div>
      </div>
    </div>
  );
}
