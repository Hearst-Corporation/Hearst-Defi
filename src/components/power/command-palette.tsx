"use client";

/**
 * CommandPalette — Admin global search + command launcher.
 *
 * Trigger: ⌘K (Mac) / Ctrl+K (Win/Linux), or the search button in the admin rail.
 * Admin-only: the GET /api/search endpoint enforces requireAdmin(); this component
 * is only rendered inside /admin/layout.tsx which already gates on role=admin.
 *
 * Search mode (default when user types a non-command query):
 *   - Calls GET /api/search?q=<query> (admin-only, PII-safe on this surface)
 *   - Displays results grouped by entity type
 *   - Handles directJump → router.push(directHref) immediately
 *   - States: idle | loading | results | empty | error
 *
 * Command mode (when no search results / query is empty):
 *   - Fuzzy-filters COMMAND_REGISTRY (static, no network)
 *   - Navigate commands → router.push(href)
 *   - Action commands → handler() (handlers injected below)
 */

import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, ArrowRight } from "lucide-react";

import { cn } from "@/lib/cn";
import { type SearchResult, type Entity } from "@/lib/search/types";
import {
  COMMAND_REGISTRY,
  filterCommands,
  groupBySection,
  type Command,
} from "@/lib/power/commands";

// ── Constants ────────────────────────────────────────────────────────────────

const MIN_QUERY_LENGTH = 1;
/** Debounce before hitting /api/search (ms) */
const SEARCH_DEBOUNCE_MS = 180;

// ── Entity label map ─────────────────────────────────────────────────────────

const ENTITY_LABELS: Record<Entity, string> = {
  vault: "Vault",
  investor: "Investor",
  position: "Position",
  distribution: "Distribution",
  proof: "Proof",
  signature: "Signature",
  scenario: "Scenario",
  backtest: "Backtest",
  memo: "Memo",
  event: "Event",
};

// ── Types ────────────────────────────────────────────────────────────────────

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "results"; results: SearchResult[]; query: string }
  | { kind: "empty"; query: string }
  | { kind: "error" };

// ── Hook: keyboard shortcut ⌘K / Ctrl+K ─────────────────────────────────────

function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpen();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpen]);
}

// ── Result row ───────────────────────────────────────────────────────────────

function ResultRow({
  result,
  active,
  onSelect,
}: {
  result: SearchResult;
  active: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={active}
      className={cn("cp-result-row", active && "cp-result-row--active")}
      onClick={onSelect}
    >
      <span className="cp-result-row__entity">
        {ENTITY_LABELS[result.entity]}
      </span>
      <span className="cp-result-row__title">{result.title}</span>
      {result.subtitle && (
        <span className="cp-result-row__subtitle">{result.subtitle}</span>
      )}
      {result.badge && (
        <span className="cp-result-row__badge">{result.badge}</span>
      )}
      <ArrowRight size={12} className="cp-result-row__arrow" aria-hidden />
    </button>
  );
}

// ── Command row ──────────────────────────────────────────────────────────────

function CommandRow({
  cmd,
  active,
  onSelect,
}: {
  cmd: Command;
  active: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={active}
      className={cn("cp-result-row", active && "cp-result-row--active")}
      onClick={onSelect}
    >
      <span className="cp-result-row__entity">{cmd.section}</span>
      <span className="cp-result-row__title">{cmd.label}</span>
      {cmd.shortcut && (
        <kbd className="cp-result-row__kbd">{cmd.shortcut}</kbd>
      )}
      <ArrowRight size={12} className="cp-result-row__arrow" aria-hidden />
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({ kind: "idle" });
  const [activeIndex, setActiveIndex] = useState(0);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery("");
    setSearchState({ kind: "idle" });
    setActiveIndex(0);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSearchState({ kind: "idle" });
  }, []);

  // ⌘K / Ctrl+K shortcut
  useCommandPaletteShortcut(openPalette);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      // nextTick — let the DOM appear first
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        closePalette();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closePalette]);

  // ── Search on query change ─────────────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();

    if (q.length < MIN_QUERY_LENGTH) {
      setSearchState({ kind: "idle" });
      setActiveIndex(0);
      return;
    }

    setSearchState({ kind: "loading" });

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}`,
          { credentials: "same-origin" },
        );

        if (!res.ok) {
          setSearchState({ kind: "error" });
          return;
        }

        const data = await res.json() as {
          results: SearchResult[];
          query: string;
          directJump: boolean;
          directHref?: string;
        };

        // Direct jump — navigate immediately and close
        if (data.directJump && data.directHref) {
          closePalette();
          startTransition(() => {
            router.push(data.directHref!);
          });
          return;
        }

        if (data.results.length === 0) {
          setSearchState({ kind: "empty", query: q });
        } else {
          setSearchState({ kind: "results", results: data.results, query: q });
        }
        setActiveIndex(0);
      } catch {
        setSearchState({ kind: "error" });
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, router, closePalette]);

  // ── Build flat list of selectable items ───────────────────────────────────

  const searchResults =
    searchState.kind === "results" ? searchState.results : [];

  const commandMatches =
    searchState.kind === "idle" || searchState.kind === "empty"
      ? filterCommands(COMMAND_REGISTRY, query)
      : [];

  const totalItems = searchResults.length + commandMatches.length;

  // ── Keyboard navigation ───────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex < searchResults.length) {
        const result = searchResults[activeIndex];
        if (result) selectResult(result);
      } else {
        const cmdIndex = activeIndex - searchResults.length;
        const cmd = commandMatches[cmdIndex];
        if (cmd) selectCommand(cmd);
      }
    }
  }

  function selectResult(result: SearchResult) {
    closePalette();
    startTransition(() => {
      router.push(result.href);
    });
  }

  function selectCommand(cmd: Command) {
    if (cmd.href) {
      closePalette();
      startTransition(() => {
        router.push(cmd.href!);
      });
    } else if (cmd.handler) {
      cmd.handler();
      closePalette();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open search (⌘K)"
        title="Search (⌘K)"
        className="cp-trigger"
        onClick={openPalette}
      >
        <Search size={18} strokeWidth={1.8} />
        <kbd className="cp-trigger__kbd">⌘K</kbd>
      </button>
    );
  }

  // Group commands by section for display
  const commandGroups = groupBySection(commandMatches);

  return (
    <>
      {/* Backdrop */}
      <div
        className="cp-backdrop"
        aria-hidden
        onClick={closePalette}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        className="cp-dialog"
      >
        {/* Input row */}
        <div className="cp-input-row">
          <Search
            size={16}
            strokeWidth={1.8}
            className="cp-input-row__icon"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search investors, vaults, proofs… or type a command"
            aria-label="Search"
            aria-autocomplete="list"
            aria-controls="cp-results"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="cp-input"
          />
          {searchState.kind === "loading" && (
            <Loader2
              size={14}
              className="cp-input-row__loader"
              aria-label="Searching…"
            />
          )}
          <button
            type="button"
            aria-label="Close search"
            className="cp-input-row__close"
            onClick={closePalette}
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Results area */}
        <div id="cp-results" role="listbox" className="cp-results">

          {/* ── Search results ─────────────────────────────────────── */}
          {searchState.kind === "results" && searchResults.length > 0 && (
            <div className="cp-section">
              <div className="cp-section__label">Results</div>
              {searchResults.map((r, i) => (
                <ResultRow
                  key={`${r.entity}-${r.id}`}
                  result={r}
                  active={activeIndex === i}
                  onSelect={() => selectResult(r)}
                />
              ))}
            </div>
          )}

          {/* ── Empty search ───────────────────────────────────────── */}
          {searchState.kind === "empty" && (
            <div className="cp-empty">
              No results for &ldquo;{searchState.query}&rdquo;
            </div>
          )}

          {/* ── Error ─────────────────────────────────────────────── */}
          {searchState.kind === "error" && (
            <div className="cp-error">
              Search unavailable — try again
            </div>
          )}

          {/* ── Commands (shown when idle or no search results) ────── */}
          {commandMatches.length > 0 && (
            <>
              {[...commandGroups.entries()].map(([section, cmds]) => {
                if (cmds.length === 0) return null;
                return (
                  <div key={section} className="cp-section">
                    <div className="cp-section__label">{section}</div>
                    {cmds.map((cmd) => {
                      const globalIdx =
                        searchResults.length +
                        commandMatches.indexOf(cmd);
                      return (
                        <CommandRow
                          key={cmd.id}
                          cmd={cmd}
                          active={activeIndex === globalIdx}
                          onSelect={() => selectCommand(cmd)}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {/* ── Idle placeholder (no query yet, no commands to show) ── */}
          {searchState.kind === "idle" && query.length === 0 && commandMatches.length === 0 && (
            <div className="cp-empty">Start typing to search or run a command</div>
          )}
        </div>

        {/* Footer hint */}
        <div className="cp-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </>
  );
}

// ── Trigger button (standalone, for embedding elsewhere) ─────────────────────

// GlobalSearch = alias d'attente pour le futur câblage ⌘K (décision projet :
// composant construit+testé, à brancher plus tard — PAS du code mort, ne pas
// supprimer). knip le flag comme unused export : attendu tant que ⌘K n'est pas câblé.
export { CommandPalette as GlobalSearch };
