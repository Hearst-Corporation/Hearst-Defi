"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/admin/markdown";
import { cn } from "@/lib/cn";

/**
 * Live agent framing brief for the (near-empty) Product Workspace.
 *
 * The page no longer pre-computes any product content — this component is the
 * chamber the agent fills. On mount, if there is no persisted brief yet and the
 * page was opened by the cockpit agent (`autostart`), it POSTs the objective to
 * /api/admin/product-workspace/brief and streams the brief token-by-token into
 * the page (typewriter). The route persists the final text, so a later refresh
 * arrives with `initialBrief` set and skips regeneration.
 *
 * States: idle (manual trigger) · streaming ("L'agent rédige le cadrage…" +
 * live text) · done (Markdown render) · error.
 */
type Phase = "idle" | "streaming" | "done" | "error";

export function AgentBriefLive({
  objective,
  autostart,
  initialBrief,
}: {
  objective: string | null;
  autostart: boolean;
  initialBrief: string | null;
}) {
  const [text, setText] = useState(initialBrief ?? "");
  const [phase, setPhase] = useState<Phase>(initialBrief ? "done" : "idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedRef = useRef(false);

  const generate = useCallback(async () => {
    if (!objective) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setText("");
    setPhase("streaming");
    try {
      const res = await fetch("/api/admin/product-workspace/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error("brief_request_failed");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        // The compliance guard emits a \x00ERROR: sentinel on a blocked brief.
        if (acc.includes("\x00ERROR:")) {
          throw new Error("brief_blocked");
        }
        setText(acc);
      }
      acc += dec.decode();
      setText(acc);
      setPhase(acc.trim().length > 0 ? "done" : "error");
      if (acc.trim().length === 0) setError("Empty brief — try again.");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setPhase("error");
      setError("Brief generation failed — try again.");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [objective]);

  // Auto-launch once when the agent opened this page and no brief exists yet.
  useEffect(() => {
    if (startedRef.current) return;
    if (initialBrief) return;
    if (!autostart || !objective) return;
    startedRef.current = true;
    // One-shot async kickoff: generate() streams a brief and setStates only
    // after awaits (not synchronously). This is an effect-driven side effect,
    // not state derivable during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void generate();
  }, [autostart, objective, initialBrief, generate]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  if (!objective) {
    return (
      <p className="body-sm ct-text-muted italic">
        {autostart
          ? "Objective not received — return to chat and retry."
          : "Waiting for an objective from the cockpit assistant."}
      </p>
    );
  }

  return (
    <div className="admin-doc-stack admin-doc-stack--tight">
      {phase === "streaming" ? (
        <div className="flex items-center gap-[var(--ct-space-2)]">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-(--ct-accent) animate-pulse"
          />
          <p className="body-xs ct-text-muted">The agent is writing the brief…</p>
        </div>
      ) : null}

      {phase === "streaming" ? (
        <p
          className="body-sm ct-text-body whitespace-pre-wrap wrap-break-word"
          aria-live="polite"
        >
          {text}
          <span className="ct-text-faint animate-pulse">▍</span>
        </p>
      ) : phase === "done" ? (
        <Markdown content={text} />
      ) : null}

      {phase === "error" ? (
        <div className="admin-doc-stack admin-doc-stack--tight">
          <p className={cn("body-sm", "ct-status-danger")} role="alert">
            {error ?? "Error."}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void generate()}>
            Retry
          </Button>
        </div>
      ) : null}

      {phase === "idle" ? (
        <div className="admin-doc-stack admin-doc-stack--tight">
          <p className="body-sm ct-text-muted">
            Start writing the brief for this objective.
          </p>
          <Button variant="primary" size="sm" onClick={() => void generate()}>
            Write the brief
          </Button>
        </div>
      ) : null}
    </div>
  );
}
