"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { Markdown } from "@/components/admin/markdown";
import { cn } from "@/lib/cn";
import {
  analyzeObjectiveQuality,
  DIMENSION_LABEL,
} from "@/lib/product-workspace/objective-quality";

/**
 * Live agent framing brief for the (near-empty) Product Workspace.
 *
 * The page no longer pre-computes any product content — this component is the
 * chamber the agent fills. It guards against the "the agent is writing the
 * brief…" spinner the user reported with two layers:
 *
 *  1. A pure, synchronous TOO-VAGUE pre-check (no model call): a bare objective
 *     like "Je veux créer un produit." renders a structured fallback listing the
 *     5 framing inputs to define, instead of streaming forever.
 *  2. A CLIENT-SIDE WATCHDOG on the stream: if the fetch hangs or stalls with no
 *     tokens, it aborts and flips to the error state (with Retry). The spinner
 *     can therefore never run indefinitely.
 *
 * States: no-objective · too-vague (structured fallback) · idle (manual
 * trigger) · streaming (with watchdog) · done (Markdown) · error (retry).
 */
type Phase = "idle" | "streaming" | "done" | "error";

/** Hard client watchdog: a brief that produces no tokens within this window —
 *  or never finishes — is aborted so the spinner cannot hang forever. */
const STREAM_WATCHDOG_MS = 45_000;

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
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);
  const unmountedRef = useRef(false);
  const timedOutRef = useRef(false);

  // Pure, synchronous: an objective that names little more than "a product" is
  // too broad to brief. We surface the missing inputs instead of calling the
  // model. A persisted brief still renders (the admin already refined it once).
  const quality = useMemo(
    () => analyzeObjectiveQuality(objective),
    [objective],
  );
  const tooVague = !initialBrief && quality.tooVague;

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const generate = useCallback(async () => {
    if (!objective) return;
    abortRef.current?.abort();
    clearWatchdog();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setText("");
    setPhase("streaming");
    timedOutRef.current = false;

    // Watchdog — abort a hung/slow stream so the spinner can't run forever.
    watchdogRef.current = setTimeout(() => {
      timedOutRef.current = true;
      controller.abort();
    }, STREAM_WATCHDOG_MS);

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
      clearWatchdog();
      if (unmountedRef.current) return;
      setText(acc);
      if (acc.trim().length > 0) {
        setPhase("done");
      } else {
        setPhase("error");
        setError("Empty brief — try again.");
      }
    } catch (err) {
      clearWatchdog();
      // Unmount or a superseding run — stay quiet, never touch state.
      if (unmountedRef.current || abortRef.current !== controller) return;
      const aborted = err instanceof Error && err.name === "AbortError";
      // A quiet abort that was NOT our watchdog (e.g. a manual re-trigger that
      // raced) is ignored; only a watchdog timeout becomes a visible error.
      if (aborted && !timedOutRef.current) return;
      setPhase("error");
      setError(
        timedOutRef.current
          ? "Brief generation timed out. The workspace is still usable — retry or continue manually."
          : "Brief generation failed. The workspace is still usable — retry or continue manually.",
      );
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [objective, clearWatchdog]);

  // Auto-launch once when the agent opened this page, the objective is specific
  // enough, and no brief exists yet. A too-vague objective never autostarts —
  // it shows the structured fallback instead (no model call, no spinner).
  useEffect(() => {
    if (startedRef.current) return;
    if (initialBrief) return;
    if (!autostart || !objective) return;
    if (quality.tooVague) return;
    startedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void generate();
  }, [autostart, objective, initialBrief, quality.tooVague, generate]);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      clearWatchdog();
      abortRef.current?.abort();
    };
  }, [clearWatchdog]);

  // ── No objective ──────────────────────────────────────────────────────────
  if (!objective) {
    return (
      <div className="admin-doc-stack admin-doc-stack--tight">
        <p className="body-sm ct-text-muted">No objective provided.</p>
        <p className="body-xs ct-text-muted">
          Start from chat or enter an objective manually.
        </p>
      </div>
    );
  }

  // ── Too vague (structured fallback — no model call) ───────────────────────
  if (tooVague && phase !== "streaming" && phase !== "done") {
    return (
      <div className="admin-doc-stack admin-doc-stack--tight">
        <p className="body-sm ct-text-body">
          The objective is too broad to generate a complete product brief.
        </p>
        <p className="body-xs ct-text-muted">Define:</p>
        <ol className="list-decimal pl-5 body-sm ct-text-body">
          {quality.missing.map((dim) => (
            <li key={dim}>{DIMENSION_LABEL[dim]}</li>
          ))}
        </ol>
        <p className="body-xs ct-text-muted">
          Add these to the objective from chat (or refine it), then the workspace
          can write a real framing brief. Nothing is generated from a vague
          objective — no model call, no assumptions invented.
        </p>
        {/* Escape hatch — let the admin force a brief anyway if they accept it
            will be thin. Honest label, not a primary action. */}
        <Button variant="secondary" size="sm" onClick={() => void generate()}>
          Write a brief anyway
        </Button>
      </div>
    );
  }

  return (
    <div className="admin-doc-stack admin-doc-stack--tight">
      {phase === "streaming" ? (
        <div className="flex items-center gap-(--ct-space-2)">
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
            {error ?? "Brief generation failed."}
          </p>
          <p className="body-xs ct-text-muted">
            The workspace is still usable. You can continue manually or retry.
          </p>
          <Button variant="secondary" size="sm" onClick={() => void generate()}>
            Retry brief
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
