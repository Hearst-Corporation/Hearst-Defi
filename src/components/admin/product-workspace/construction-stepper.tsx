"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import {
  CockpitButton as Button,
  cockpitButtonVariants,
} from "@/components/catalyst/cockpit-button";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import {
  CONSTRUCTION_STEPS,
  type ConstructionStepId,
  type ConstructionStepStatus,
  type ConstructionStreamFrame,
  type StepMetric,
} from "@/lib/agentic/swarm/live/stream-types";
import type { LiveProvenance, ProductConstructionDraft } from "@/lib/agentic/swarm/live/types";
import {
  constructionDraftToVaultForm,
  encodeVaultFormPrefill,
} from "@/lib/agentic/swarm/live/to-vault-form";
import { DataScientistOutput } from "./data-scientist-output";

/**
 * Product construction — full-page vertical stepper.
 *
 * The five named specialists run server-side, one real `await` each, and stream
 * an NDJSON frame per transition. This component reveals each step ONLY when its
 * frame actually arrives (no cosmetic 300ms timer) and auto-scrolls to the active
 * step as the construction advances. Token-only (`--ct-*`), Catalyst atoms, dark.
 * Read-only: nothing is created, sent, or deployed from here.
 */

/**
 * DISPLAY-ONLY mask — which step cards are rendered in the stepper.
 *
 * The five specialists ALWAYS run server-side and stream their frames; this list
 * only controls what the admin SEES. We are iterating the design step-by-step, so
 * we currently render step 1 (bitcoin) alone. Add ids back here to reveal the
 * others — nothing in the pipeline/computation changes.
 */
const VISIBLE_STEP_IDS: readonly ConstructionStepId[] = ["bitcoin"];

type Lifecycle = "upcoming" | "running" | ConstructionStepStatus;

interface StepResult {
  status: ConstructionStepStatus;
  headline: string;
  metrics: StepMetric[];
  provenance: LiveProvenance | null;
  note?: string;
}

function liveToBadge(p: LiveProvenance): Provenance {
  switch (p) {
    case "Live": return "live";
    case "Oracle": return "oracle";
    case "Attested": return "attested";
    case "Estimated": return "estimated";
    case "Manual": return "manual";
    case "Stale": return "stale";
  }
}

/** Node visual tone derived from lifecycle. */
function nodeTone(life: Lifecycle): "accent" | "warning" | "danger" | "current" | "idle" {
  if (life === "running") return "current";
  if (life === "live") return "accent";
  if (life === "degraded" || life === "unavailable") return "warning";
  if (life === "error") return "danger";
  return "idle";
}

const CHECK = (
  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 12 12" fill="none">
    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function StepNode({ life }: { life: Lifecycle }) {
  const tone = nodeTone(life);
  const isComplete = tone === "accent" || tone === "warning" || tone === "danger";
  return (
    <span
      aria-current={tone === "current" ? "step" : undefined}
      className={cn(
        "relative z-10 flex h-(--ct-space-8) w-(--ct-space-8) items-center justify-center rounded-(--ct-radius-full)",
        tone === "accent" && "bg-[var(--ct-accent)] text-[var(--ct-bg-deep)]",
        tone === "warning" && "bg-[var(--ct-status-warning)] text-[var(--ct-bg-deep)]",
        tone === "danger" && "bg-[var(--ct-status-danger)] text-[var(--ct-bg-deep)]",
        tone === "current" && "border-2 border-[var(--ct-accent)] bg-surface-page",
        tone === "idle" && "border border-[var(--ct-border-soft)] bg-surface-page",
      )}
    >
      {tone === "danger" ? (
        <span className="mono text-[length:var(--ct-text-sm)] font-bold">!</span>
      ) : isComplete ? (
        CHECK
      ) : tone === "current" ? (
        <span className="h-(--ct-space-2) w-(--ct-space-2) rounded-(--ct-radius-full) bg-[var(--ct-accent)] animate-pulse" />
      ) : (
        <span className="h-(--ct-space-2) w-(--ct-space-2) rounded-(--ct-radius-full) bg-[var(--ct-text-faint)] opacity-40" />
      )}
    </span>
  );
}

function MetricChip({ metric }: { metric: StepMetric }) {
  return (
    <div className="flex flex-col gap-px rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-surface-card px-(--ct-space-3) py-(--ct-space-2)">
      <span className="ct-bento-label">{metric.label}</span>
      <span className="mono text-[length:var(--ct-text-sm)] font-bold ct-text-strong">{metric.value}</span>
    </div>
  );
}

export function ConstructionStepper({ objective }: { objective: string | null }) {
  const [results, setResults] = useState<Partial<Record<ConstructionStepId, StepResult>>>({});
  const [current, setCurrent] = useState<ConstructionStepId | null>(null);
  const [draft, setDraft] = useState<ProductConstructionDraft | null>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const autoRanRef = useRef(false);
  const nodeRefs = useRef(new Map<ConstructionStepId, HTMLLIElement>());

  const run = useCallback(async () => {
    if (!objective) return;
    setResults({});
    setDraft(null);
    setError(null);
    setCurrent(null);
    setPhase("running");
    try {
      const res = await fetch("/api/admin/product-construction/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective }),
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        setPhase("error");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let frame: ConstructionStreamFrame;
          try {
            frame = JSON.parse(line) as ConstructionStreamFrame;
          } catch {
            continue;
          }
          if (frame.type === "step_start") {
            setCurrent(frame.step);
          } else if (frame.type === "step_done") {
            setResults((prev) => ({
              ...prev,
              [frame.step]: {
                status: frame.status,
                headline: frame.headline,
                metrics: frame.metrics,
                provenance: frame.provenance,
                ...(frame.note ? { note: frame.note } : {}),
              },
            }));
          } else if (frame.type === "final") {
            setDraft(frame.draft);
          } else if (frame.type === "error") {
            setError(frame.message);
          }
        }
      }
      setCurrent(null);
      setPhase((p) => (p === "error" ? "error" : "done"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "request failed");
      setPhase("error");
    }
  }, [objective]);

  // Auto-run once when the workspace opens with an objective.
  useEffect(() => {
    if (autoRanRef.current || !objective) return;
    autoRanRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run();
  }, [objective, run]);

  // Auto-scroll to the active step as the construction advances.
  useEffect(() => {
    if (!current) return;
    const el = nodeRefs.current.get(current);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [current]);

  // When the data-scientist draft lands, scroll to its (rich) output.
  useEffect(() => {
    if (!draft) return;
    const el = nodeRefs.current.get("data_scientist");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [draft]);

  if (!objective) {
    return (
      <p className="body-sm ct-text-muted">
        No objective yet — describe the product in the cockpit chat to start the construction.
      </p>
    );
  }

  const lifecycleOf = (id: ConstructionStepId): Lifecycle => {
    if (results[id]) return results[id]!.status;
    if (current === id) return "running";
    return "upcoming";
  };

  return (
    <div className="flex flex-col gap-(--ct-space-6)">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-(--ct-space-3) rounded-(--ct-radius-xl) border border-[var(--ct-border)] bg-surface-card px-(--ct-space-4) py-(--ct-space-3)">
        {phase === "running" ? (
          <span className="flex items-center gap-(--ct-space-2) text-[length:var(--ct-text-xs)] ct-text-secondary">
            <span aria-hidden className="h-(--ct-space-2) w-(--ct-space-2) rounded-(--ct-radius-full) bg-[var(--ct-accent)] animate-pulse" />
            Specialists at work — each step streams as it finishes.
          </span>
        ) : phase === "done" ? (
          <span className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
            Construction complete from live data ·{" "}
            <button type="button" onClick={() => void run()} className="underline-offset-2 hover:underline ct-text-muted">re-run</button>
          </span>
        ) : (
          <span className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
            live read · no write, no send, no deploy
          </span>
        )}
        {error ? (
          <span className="text-[length:var(--ct-text-xs)] ct-status-danger">
            {error} ·{" "}
            <button type="button" onClick={() => void run()} className="underline-offset-2 hover:underline">retry</button>
          </span>
        ) : null}
      </div>

      {/* Vertical stepper — DISPLAY filtered to VISIBLE_STEP_IDS while we iterate
          the design step-by-step. The full pipeline still runs all five steps. */}
      <ol className="flex flex-col">
        {CONSTRUCTION_STEPS.filter((s) => VISIBLE_STEP_IDS.includes(s.id)).map((step, i, visible) => {
          const life = lifecycleOf(step.id);
          const result = results[step.id];
          const isLast = i === visible.length - 1;
          const connectorDone = result !== undefined; // step finished → fill the rail down
          return (
            <li
              key={step.id}
              ref={(el) => {
                if (el) nodeRefs.current.set(step.id, el);
              }}
              className={cn("relative scroll-mt-(--ct-space-20)", !isLast && "pb-(--ct-space-8)")}
            >
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-(--ct-space-8) left-(--ct-space-4) h-full w-px -translate-x-1/2",
                    connectorDone ? "bg-[var(--ct-accent)]" : "bg-[var(--ct-border-soft)]",
                  )}
                />
              ) : null}
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-(--ct-space-4)">
                <StepNode life={life} />
                <div className="flex min-w-0 flex-col gap-(--ct-space-2) pb-(--ct-space-2)">
                  {/* Header line */}
                  <div className="flex flex-wrap items-baseline gap-x-(--ct-space-3) gap-y-px">
                    <span
                      className={cn(
                        "ct-section-label",
                        life === "upcoming" ? "ct-text-faint" : "ct-text-strong",
                      )}
                    >
                      {step.index}. {step.persona}
                    </span>
                    {result?.provenance ? <ProvenanceBadge kind={liveToBadge(result.provenance)} compact /> : null}
                    {result?.status === "unavailable" ? (
                      <span className="ct-section-label ct-status-warning">unavailable</span>
                    ) : null}
                  </div>
                  <span className="text-[length:var(--ct-text-xs)] ct-text-tertiary">{step.role}</span>

                  {/* Result */}
                  {result ? (
                    <div className="flex flex-col gap-(--ct-space-3) pt-(--ct-space-1)">
                      <span className="body-sm ct-text-body">{result.headline}</span>
                      {result.metrics.length > 0 ? (
                        <div className="grid grid-cols-2 gap-(--ct-space-2) sm:grid-cols-3 lg:grid-cols-4">
                          {result.metrics.map((m) => (
                            <MetricChip key={m.label} metric={m} />
                          ))}
                        </div>
                      ) : null}
                      {result.note ? (
                        <p className="text-[length:var(--ct-text-xs)] ct-status-warning">{result.note}</p>
                      ) : null}
                      {/* Data-scientist rich output */}
                      {step.id === "data_scientist" && draft ? (
                        <div className="mt-(--ct-space-3) rounded-(--ct-radius-2xl) border border-[var(--ct-border)] bg-surface-page p-(--ct-space-5)">
                          <DataScientistOutput draft={draft} />
                        </div>
                      ) : null}
                    </div>
                  ) : life === "running" ? (
                    <span className="flex items-center gap-(--ct-space-2) pt-(--ct-space-1) text-[length:var(--ct-text-xs)] ct-text-secondary">
                      <span aria-hidden className="h-(--ct-space-1) w-(--ct-space-1) rounded-(--ct-radius-full) bg-[var(--ct-accent)] animate-pulse" />
                      working…
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Handoffs — wizard prefill (no DB write) */}
      {draft ? (
        <div className="flex flex-wrap items-center gap-(--ct-space-3) border-t border-[var(--ct-border-soft)] pt-(--ct-space-4)">
          <Link
            href={`/admin/vaults/new?prefill=${encodeURIComponent(encodeVaultFormPrefill(constructionDraftToVaultForm(draft)))}`}
            className={cn(cockpitButtonVariants({ variant: "primary", size: "sm" }), "self-start")}
          >
            Open in vault wizard (pre-filled)
          </Link>
          <Button variant="secondary" size="sm" onClick={() => window.open("/admin/product-workspace/report/print", "_blank", "noopener")}>
            Open print view (PDF)
          </Button>
          <span className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
            Hand-off carries ticker / APY range / allocations · no record created.
          </span>
        </div>
      ) : null}
    </div>
  );
}
