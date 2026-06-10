"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Markdown } from "@/components/admin/markdown";
import { cn } from "@/lib/cn";

type Mode = "normal" | "review";

/** `false` on the server + first client render, `true` after hydration — gates
 * the client-only portal so it never causes an SSR mismatch. */
const emptySubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

const PILL_BASE_CLASS = cn(
  "h-8 rounded-full px-3 text-xs font-medium",
  "transition-[background-color,color] duration-[var(--ct-dur-base)]",
  "focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

function pillClass(active: boolean): string {
  return cn(
    PILL_BASE_CLASS,
    active
      ? "bg-[var(--ct-accent)] text-[var(--ct-bg-deep)]"
      : "ct-text-muted hover:ct-text-strong",
  );
}

/**
 * Mode selector for the Cockpit chat (Conversation / Review), mounted GLOBALLY
 * in the product shell (AppChrome) so it is available on every product page —
 * not just /admin. Admin-gated: on mount it calls `GET /api/admin/review-mode`,
 * which is `requireAdmin`-protected; a 403 means "not an admin" and the
 * component renders nothing. So only admins ever see the selector.
 *
 * Visually: portaled INSIDE `<div class="ct-rail-right-body">` (the chat body
 * exposed by `@hearst/cockpit-shell`), positioned `sticky top-0`. The toolbar
 * is part of the chat layout — width inherits from the rail, collapse with
 * the rail, no fixed positioning math, no z-index war with the cockpit
 * stacking context. The optional Review-document Modal still overlays the
 * full viewport (its own portal lives inside the Modal primitive).
 *
 * In Review mode it exposes a "Générer le document" action that distills the
 * conversation into a structured change doc.
 */
export function AdminChatControls() {
  // null = not yet resolved / not an admin → render nothing.
  const [mode, setMode] = useState<Mode | null>(null);
  const [savingMode, setSavingMode] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [streamingCharCount, setStreamingCharCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [target, setTarget] = useState<Element | null>(null);

  // Resolve admin status + current mode in one call. The route is
  // requireAdmin-gated: 200 → admin (use the returned mode); anything else
  // (403 non-admin, 401 logged-out) → stay null → render nothing.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/review-mode");
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as
          | { mode?: Mode }
          | null;
        if (!cancelled) {
          setMode(data?.mode === "review" ? "review" : "normal");
        }
      } catch {
        // Network error → leave null (hidden). Non-fatal.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Anchor the toolbar inside the chat rail body so it scrolls/collapses with
  // the rail natively instead of floating fixed above it.
  useEffect(() => {
    const el = document.querySelector(".ct-rail-right-body");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTarget(el);
  }, []);

  const switchMode = useCallback(
    async (next: Mode) => {
      setError(null);
      setSavingMode(true);
      // Snapshot the value BEFORE the optimistic update so the rollback
      // restores it textually on failure. The previous logic inferred the
      // previous value from `next`, which mis-rolled-back if the user
      // clicked again during the in-flight request.
      const previous = mode;
      setMode(next);
      try {
        const res = await fetch("/api/admin/review-mode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: next }),
        });
        if (!res.ok) {
          // A non-ok response only rolls the optimistic toggle back — there is
          // no navigation side-effect here. 429 = the route's per-admin write
          // cap; surface a specific, non-alarming message for it.
          setError(
            res.status === 429
              ? "Trop de requêtes — réessayez dans un instant."
              : "Impossible d'enregistrer le mode.",
          );
          setMode(previous);
        }
      } catch {
        setError("Impossible d'enregistrer le mode.");
        setMode(previous);
      } finally {
        setSavingMode(false);
      }
    },
    [mode],
  );

  // AbortController for the in-flight generation. Lets the admin cancel a
  // pending 60s call instead of staring at a frozen spinner.
  const abortRef = useRef<AbortController | null>(null);

  const generateDocument = useCallback(async () => {
    setError(null);
    setGenerating(true);
    setStreamingCharCount(0);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/admin/review-document?stream=1", {
        method: "POST",
        signal: controller.signal,
        headers: { Accept: "text/event-stream" },
      });

      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        if (!res.body) throw new Error("Réponse de stream vide");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalMd: string | null = null;
        let accumulated = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const evt of events) {
            const line = evt.trim();
            if (!line.startsWith("data: ")) continue;
            try {
              const payload = JSON.parse(line.slice(6)) as {
                type: string;
                text?: string;
                documentId?: string;
                contentMd?: string;
                message?: string;
              };
              if (payload.type === "delta" && payload.text) {
                accumulated += payload.text;
                setStreamingCharCount(accumulated.length);
              } else if (payload.type === "done") {
                finalMd = payload.contentMd ?? null;
              } else if (payload.type === "error") {
                throw new Error(payload.message ?? "Erreur de génération");
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.name !== "SyntaxError") {
                throw parseErr;
              }
              // ignore malformed SSE events
            }
          }
        }

        if (!finalMd) throw new Error("Stream terminé sans document final");
        setDoc(finalMd);
        setPanelOpen(true);
      } else {
        // JSON fallback branch (backward-compatible)
        const data = (await res.json().catch(() => null)) as
          | { document?: { contentMd: string }; error?: string }
          | null;
        if (!res.ok || !data?.document) {
          throw new Error(data?.error ?? "Échec de la génération.");
        }
        setDoc(data.document.contentMd);
        setPanelOpen(true);
      }

      // Auto-reset to "normal" after a successful generation: the review is
      // finished, the doc is captured, leaving the admin in facilitator mode
      // would turn subsequent chats into a probing interview rather than
      // assistance. Fire-and-forget — a failure here doesn't break the doc.
      void fetch("/api/admin/review-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "normal" }),
      }).then((r) => {
        if (r.ok) setMode("normal");
      });
    } catch (err) {
      // Distinguish user-initiated abort from a real failure.
      if (err instanceof Error && err.name === "AbortError") {
        setError("Génération annulée.");
      } else {
        setError(
          err instanceof Error ? err.message : "Échec de la génération.",
        );
      }
    } finally {
      setGenerating(false);
      setStreamingCharCount(0);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Abort any in-flight generation if the component unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const copyDoc = useCallback(() => {
    if (doc) void navigator.clipboard.writeText(doc);
  }, [doc]);

  const downloadDoc = useCallback(() => {
    if (!doc) return;
    const blob = new Blob([doc], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revue-produit-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [doc]);

  const hydrated = useHydrated();
  // Hidden until hydrated, anchor resolved, and admin status confirmed.
  if (!hydrated || !target || mode === null) return null;

  return (
    <>
      {createPortal(
        <div
          className={cn(
            "sticky top-0 z-10 flex items-center gap-2",
            "bg-transparent",
            "px-4 py-2",
          )}
          role="toolbar"
          aria-label="Mode du chat"
        >
          {/* Mode toggle */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => switchMode("normal")}
              disabled={savingMode}
              aria-pressed={mode === "normal"}
              className={pillClass(mode === "normal")}
            >
              Conversation
            </button>
            <button
              type="button"
              onClick={() => switchMode("review")}
              disabled={savingMode}
              aria-pressed={mode === "review"}
              className={pillClass(mode === "review")}
            >
              Review
            </button>
          </div>

          {mode === "review" && (
            <>
              <span
                className="h-5 w-px bg-[var(--ct-border-soft)]"
                aria-hidden="true"
              />
              <Button
                variant="primary"
                size="sm"
                onClick={generateDocument}
                disabled={generating}
              >
                {generating
                  ? streamingCharCount > 0
                    ? `Génération… (${streamingCharCount} chars)`
                    : "Génération…"
                  : "Générer le document"}
              </Button>
              {generating && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelGeneration}
                  aria-label="Annuler la génération en cours"
                >
                  Annuler
                </Button>
              )}
              {doc && !panelOpen && !generating && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPanelOpen(true)}
                >
                  Voir
                </Button>
              )}
            </>
          )}
        </div>,
        target,
      )}

      {error && (
        <div
          className={cn(
            "fixed right-4 top-28 z-[var(--ct-z-toast)]",
            "rounded-md border px-3 py-1.5 text-xs",
            "border-[var(--ct-status-danger-border)] ct-status-danger-bg",
            "ct-status-danger",
          )}
          role="alert"
        >
          {error}
        </div>
      )}

      <Modal
        isOpen={panelOpen && doc !== null}
        onClose={() => setPanelOpen(false)}
        title="Plan de modifications suggérées"
        headerActions={
          <>
            <Button variant="ghost" size="sm" onClick={copyDoc}>
              Copier
            </Button>
            <Button variant="secondary" size="sm" onClick={downloadDoc}>
              Télécharger .md
            </Button>
          </>
        }
      >
        {doc && <Markdown content={doc} />}
      </Modal>
    </>
  );
}
