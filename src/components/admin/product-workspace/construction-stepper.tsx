"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import {
  CockpitButton as Button,
  cockpitButtonVariants,
} from "@/components/catalyst/cockpit-button";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { BentoPanel, BentoHeader } from "@/components/catalyst/bento";
import { Skeleton } from "@/components/catalyst/skeleton";
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
import { ProductEngineReport } from "./product-engine-report";
import {
  BrandLogo,
  StepHeroLogo,
  StepSourceRow,
} from "./step-theater-branding";

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
const VISIBLE_STEP_IDS: readonly ConstructionStepId[] = [
  "bitcoin",
  "hashprice",
  "mining_infra",
  "defi",
  "data_scientist",
];

/** Minimum on-screen "running" time per step (narration + search read as real). */
const MIN_STEP_MS = 5_000;

/** Stable scroll offset so step titles stay below the admin shell chrome. */
const SCROLL_MARGIN_CLASS = "scroll-mt-[calc(var(--ct-space-20)+var(--ct-space-4))]";

/**
 * Per-step LOADING copy — short narration while the specialist works server-side.
 */
const STEP_LOADING: Record<
  ConstructionStepId,
  { narration: string; sourcesLabel: string }
> = {
  bitcoin: {
    narration:
      "Notre Bitcoin Price Specialist recherche le prix BTC le plus juste et compare plusieurs sources…",
    sourcesLabel: "Sources croisées",
  },
  hashprice: {
    narration:
      "Notre Hashprice Specialist dérive le hashprice ($/TH/jour) et la difficulté réseau en temps réel…",
    sourcesLabel: "Sources réseau",
  },
  mining_infra: {
    narration:
      "Notre Mining Infrastructure Specialist chiffre les machines (coût landed : ex-works + fret + douane) et les marges…",
    sourcesLabel: "Fournisseurs",
  },
  defi: {
    narration:
      "Notre DeFi Specialist source les meilleurs rendements stables / BTC et la bande de scénario BTC…",
    sourcesLabel: "Protocoles",
  },
  data_scientist: {
    narration:
      "Notre Data Scientist rédige la thèse, trace la projection et dimensionne l'allocation (+2 versions)…",
    sourcesLabel: "Moteurs",
  },
};

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

function StepNode({
  life,
  pipelineRunning,
  isNextUp = false,
}: {
  life: Lifecycle;
  pipelineRunning: boolean;
  isNextUp?: boolean;
}) {
  const tone = nodeTone(life);
  const isComplete = tone === "accent" || tone === "warning" || tone === "danger";
  // The immediate next step's black ring spins while the pipeline works toward it
  // (the transition gap: previous step done, this one not yet started).
  const isLoadingNext = tone === "idle" && isNextUp;
  // Other queued nodes pulse softly while the pipeline is active.
  const isQueued = tone === "idle" && pipelineRunning && !isLoadingNext;
  return (
    <span
      aria-current={tone === "current" ? "step" : undefined}
      aria-label={isLoadingNext ? "loading" : undefined}
      role={isLoadingNext ? "status" : undefined}
      className={cn(
        "relative z-10 flex h-(--ct-space-8) w-(--ct-space-8) items-center justify-center rounded-(--ct-radius-full) transition-colors duration-300",
        tone === "accent" && "bg-[var(--ct-accent)] text-[var(--ct-bg-deep)]",
        tone === "warning" && "bg-[var(--ct-status-warning)] text-[var(--ct-bg-deep)]",
        tone === "danger" && "bg-[var(--ct-status-danger)] text-[var(--ct-bg-deep)]",
        tone === "current" && "bg-surface-page",
        tone === "idle" && !isLoadingNext && "border border-[var(--ct-border-soft)] bg-surface-page",
        // Next-up: the black ring itself becomes a spinning accent-topped loader.
        isLoadingNext && "animate-spin border-2 border-[var(--ct-border-soft)] border-t-[var(--ct-accent)] bg-surface-page",
      )}
    >
      {tone === "danger" ? (
        <span className="mono text-[length:var(--ct-text-sm)] font-bold">!</span>
      ) : isComplete ? (
        CHECK
      ) : tone === "current" ? (
        // Spinning arc — accent arc over a faint track.
        <span
          aria-label="loading"
          role="status"
          className="h-(--ct-space-6) w-(--ct-space-6) animate-spin rounded-(--ct-radius-full) border-2 border-[var(--ct-border-soft)] border-t-[var(--ct-accent)]"
        />
      ) : isLoadingNext ? (
        // The black ring itself spins — no inner dot.
        null
      ) : isQueued ? (
        // Queued: pulsing dot — "I'm next in line."
        <span className="h-(--ct-space-2) w-(--ct-space-2) animate-pulse rounded-(--ct-radius-full) bg-[var(--ct-text-faint)]" />
      ) : (
        <span className="h-(--ct-space-2) w-(--ct-space-2) rounded-(--ct-radius-full) bg-[var(--ct-text-faint)] opacity-[var(--ct-opacity-40)]" />
      )}
    </span>
  );
}

function StepStatusBadge({ life }: { life: Lifecycle }) {
  if (life === "running") {
    return <span className="ct-section-label ct-text-accent">Running</span>;
  }
  if (life === "upcoming") {
    return <span className="ct-section-label ct-text-faint">Waiting</span>;
  }
  if (life === "error") {
    return <span className="ct-section-label ct-status-danger">Error</span>;
  }
  if (life === "unavailable" || life === "degraded") {
    return <span className="ct-section-label ct-status-warning">Degraded</span>;
  }
  return <span className="ct-section-label ct-text-accent">Complete</span>;
}

function StepMetricSkeleton() {
  return (
    <div className="grid w-full max-w-md grid-cols-3 gap-(--ct-space-3) px-(--ct-space-5) pb-(--ct-space-5)">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-(--ct-space-10) w-full" />
      ))}
    </div>
  );
}

function StepLoadingBody({ stepId }: { stepId: ConstructionStepId }) {
  const copy = STEP_LOADING[stepId];
  return (
    <div className="flex flex-col items-center gap-(--ct-space-5) p-(--ct-space-6) ml-[calc((var(--ct-space-32)+var(--ct-space-8))/-2)]">
      <StepHeroLogo stepId={stepId} size={72} />
      <p className="max-w-prose text-center body-sm ct-text-secondary leading-relaxed">
        <Typewriter text={copy.narration} />
      </p>
      <div className="flex flex-col items-center gap-(--ct-space-2)">
        <span className="ct-bento-label">{copy.sourcesLabel}</span>
        <StepSourceRow stepId={stepId} />
      </div>
      <StepMetricSkeleton />
    </div>
  );
}

/**
 * Typewriter — discreet reveal while a step runs. Disabled when reduced-motion.
 */
function Typewriter({ text, speedMs = 28 }: { text: string; speedMs?: number }) {
  const [shown, setShown] = useState(0);
  const [reducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (reducedMotion) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(0);
    if (!text) return;
    const id = setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, speedMs);
    return () => clearInterval(id);
  }, [text, speedMs, reducedMotion]);

  if (reducedMotion) return <span>{text}</span>;

  const done = shown >= text.length;
  return (
    <span>
      {text.slice(0, shown)}
      {!done ? (
        <span aria-hidden className="ct-text-accent animate-pulse">▍</span>
      ) : null}
    </span>
  );
}

/** One cell of a KPI strip. Declared at module scope (never inside the
 *  render) so it keeps a stable identity — react-hooks/static-components. */
function KpiStripCell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-(--ct-space-2) p-5 md:px-6">
      <span className="ct-bento-label">{label}</span>
      <div className="flex items-center justify-center gap-(--ct-space-2)">
        {children}
      </div>
    </div>
  );
}

/**
 * Bitcoin step result — a KPI strip tailored to the Bitcoin Price Specialist:
 *  - Spot   : the Bitcoin logo next to the price.
 *  - 24h    : the % with an up/down arrow (accent up, danger down).
 *  - Source : the three cross-checked source logos (not text).
 */
function BitcoinResultStrip({ metrics }: { metrics: StepMetric[] }) {
  const find = (label: string) =>
    metrics.find((m) => m.label.toLowerCase() === label.toLowerCase())?.value ??
    "";
  const spot = find("Spot");
  const change = find("24h");
  // Parse the signed % to pick the arrow + tone. "+1.2%" → up, "-0.8%" → down.
  const pctNum = parseFloat(change.replace(/[^0-9.+-]/g, ""));
  const up = Number.isFinite(pctNum) ? pctNum >= 0 : true;
  const Cell = KpiStripCell;

  return (
    <div className="grid grid-cols-1 border-b border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] md:grid-cols-3 [&>div:not(:last-child)]:border-b [&>div:not(:last-child)]:border-[var(--ct-border-soft)] md:[&>div:not(:last-child)]:border-b-0 md:[&>div:not(:last-child)]:border-r">
      <Cell label="Spot">
        <BrandLogo id="bitcoin" size={24} />
        <span className="text-[length:var(--ct-text-2xl)] font-medium leading-none tracking-tight tabular-nums ct-text-strong">
          {spot}
        </span>
      </Cell>
      <Cell label="24h">
        <span
          className={cn(
            "text-[length:var(--ct-text-2xl)] font-medium leading-none tracking-tight tabular-nums",
            up ? "ct-text-accent" : "text-[var(--ct-status-danger)]",
          )}
        >
          {up ? "↑" : "↓"} {change.replace(/^[+-]/, "")}
        </span>
      </Cell>
      <Cell label="Sources">
        <BrandLogo id="coingecko" size={24} />
        <BrandLogo id="binance" size={24} />
        <BrandLogo id="kraken" size={24} />
      </Cell>
    </div>
  );
}

function HashpriceResultStrip({ metrics }: { metrics: StepMetric[] }) {
  const find = (label: string) =>
    metrics.find((m) => m.label.toLowerCase() === label.toLowerCase())?.value ?? "";
  const hashprice = find("hashprice");
  const difficulty = find("difficulty");
  const reward = find("block reward");
  const Cell = KpiStripCell;

  return (
    <div className="grid grid-cols-1 border-b border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] md:grid-cols-3 [&>div:not(:last-child)]:border-b [&>div:not(:last-child)]:border-[var(--ct-border-soft)] md:[&>div:not(:last-child)]:border-b-0 md:[&>div:not(:last-child)]:border-r">
      <Cell label="Hashprice">
        <span className="text-[length:var(--ct-text-2xl)] font-medium leading-none tracking-tight tabular-nums ct-text-strong">
          {hashprice}
        </span>
      </Cell>
      <Cell label="Difficulty">
        <span className="text-[length:var(--ct-text-2xl)] font-medium leading-none tracking-tight tabular-nums ct-text-strong">
          {difficulty}
        </span>
      </Cell>
      <Cell label="Block Reward">
        <span className="text-[length:var(--ct-text-2xl)] font-medium leading-none tracking-tight tabular-nums ct-text-strong">
          {reward}
        </span>
      </Cell>
    </div>
  );
}

function MiningInfraResultStrip({ metrics }: { metrics: StepMetric[] }) {
  const find = (label: string) =>
    metrics.find((m) => m.label.toLowerCase() === label.toLowerCase())?.value ?? "";
  const top = find("top by margin");
  const bestMargin = find("best margin");
  const customs = find("customs dest.");
  const energy = find("energy");
  const Cell = KpiStripCell;

  return (
    <div className="grid grid-cols-1 border-b border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] md:grid-cols-4 [&>div:not(:last-child)]:border-b [&>div:not(:last-child)]:border-[var(--ct-border-soft)] md:[&>div:not(:last-child)]:border-b-0 md:[&>div:not(:last-child)]:border-r">
      <Cell label="Top by Margin">
        <span className="text-[length:var(--ct-text-2xl)] font-medium leading-none tracking-tight tabular-nums ct-text-strong">
          {top}
        </span>
      </Cell>
      <Cell label="Best Margin">
        <span className="text-[length:var(--ct-text-2xl)] font-medium leading-none tracking-tight tabular-nums ct-text-accent">
          {bestMargin}
        </span>
      </Cell>
      <Cell label="Customs Dest.">
        <span className="text-[length:var(--ct-text-2xl)] font-medium leading-none tracking-tight tabular-nums ct-text-strong">
          {customs}
        </span>
      </Cell>
      <Cell label="Energy">
        <span className="text-[length:var(--ct-text-2xl)] font-medium leading-none tracking-tight tabular-nums ct-text-strong">
          {energy}
        </span>
      </Cell>
    </div>
  );
}

function DefiResultStrip({ metrics }: { metrics: StepMetric[] }) {
  const find = (label: string) =>
    metrics.find((m) => m.label.toLowerCase() === label.toLowerCase())?.value ?? "";
  const yield_ = find("usdc yield");
  const source = find("source");
  const miningNet = find("mining net yield");
  const Cell = KpiStripCell;

  // Render a logo if we know the source
  const sourceLogoId = source.toLowerCase().includes("aave") ? "aave" : source.toLowerCase().includes("compound") ? "compound" : source.toLowerCase().includes("morpho") ? "morpho" : null;

  return (
    <div className="grid grid-cols-1 border-b border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)] md:grid-cols-3 [&>div:not(:last-child)]:border-b [&>div:not(:last-child)]:border-[var(--ct-border-soft)] md:[&>div:not(:last-child)]:border-b-0 md:[&>div:not(:last-child)]:border-r">
      <Cell label="USDC Yield">
        <span className="text-[length:var(--ct-text-2xl)] font-medium leading-none tracking-tight tabular-nums ct-text-strong">
          {yield_}
        </span>
      </Cell>
      <Cell label="Source">
        {sourceLogoId && <BrandLogo id={sourceLogoId as any} size={24} />}
        <span className="text-[length:var(--ct-text-2xl)] font-medium leading-none tracking-tight tabular-nums ct-text-strong">
          {source}
        </span>
      </Cell>
      <Cell label="Mining Net Yield">
        <span className="text-[length:var(--ct-text-2xl)] font-medium leading-none tracking-tight tabular-nums ct-text-strong">
          {miningNet}
        </span>
      </Cell>
    </div>
  );
}

/**
 * Generic step result strip — the FLAT KPI grammar (no rounded chip boxes): each
 * metric is a full-width cell (label on top, large fixed value below), cells
 * divided by thin vertical hairlines. Same grammar as the dashboard KPI tiles and
 * the Bitcoin strip, so every step reads identically — no boxes-in-boxes. The
 * Headline APY (data-scientist step) is the only accent-tinted value.
 */
function StepResultStrip({ metrics }: { metrics: StepMetric[] }) {
  return (
    <div className="dashboard-kpi-strip border-b border-[var(--ct-border-soft)] bg-[var(--ct-surface-inset)]">
      {metrics.map((m, i, arr) => {
        const accent = m.label.toLowerCase() === "headline apy";
        return (
          <div key={m.label} className="flex w-full min-w-0 items-center">
            <div className="flex flex-1 flex-col gap-(--ct-space-2) px-(--ct-space-5) py-(--ct-space-4)">
              <span className="ct-bento-label">{m.label}</span>
              <span
                className={cn(
                  "text-[length:var(--ct-text-xl-fixed)] font-medium leading-none tracking-tight tabular-nums",
                  accent ? "ct-text-accent" : "ct-text-strong",
                )}
              >
                {m.value}
              </span>
            </div>
            {i < arr.length - 1 ? (
              <div className="h-(--ct-space-8) w-px shrink-0 self-center bg-[var(--ct-border)]" aria-hidden="true" />
            ) : null}
          </div>
        );
      })}
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
  const reportRef = useRef<HTMLDivElement>(null);
  const lastScrollKeyRef = useRef<string | null>(null);
  const userPausedScrollRef = useRef(false);

  const run = useCallback(async () => {
    if (!objective) return;
    setResults({});
    setDraft(null);
    setError(null);
    setCurrent(null);
    setPhase("running");
    userPausedScrollRef.current = false;
    lastScrollKeyRef.current = null;
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
      // Each step must STAY visibly "running" for at least MIN_STEP_MS so the
      // narration types out and the search reads as real work — even when the
      // server resolves the data faster. We gate `step_done` on the elapsed time
      // since that step's `step_start`. The stream loop is sequential, so the
      // sleep naturally paces the whole pipeline.
      let stepStartedAt = Date.now();
      const sleep = (ms: number) =>
        new Promise<void>((r) => setTimeout(r, ms));
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
            stepStartedAt = Date.now();
            setCurrent(frame.step);
          } else if (frame.type === "step_done") {
            // Hold the running state until the step has been on screen ≥ minimum.
            const elapsed = Date.now() - stepStartedAt;
            if (elapsed < MIN_STEP_MS) await sleep(MIN_STEP_MS - elapsed);
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
    void run();
  }, [objective, run]);

  // Pause auto-scroll when the operator takes manual control.
  useEffect(() => {
    const pause = () => {
      userPausedScrollRef.current = true;
    };
    window.addEventListener("wheel", pause, { passive: true });
    window.addEventListener("touchmove", pause, { passive: true });
    return () => {
      window.removeEventListener("wheel", pause);
      window.removeEventListener("touchmove", pause);
    };
  }, []);

  // Calibrated scroll — center the active step or the final report once per transition.
  useEffect(() => {
    if (userPausedScrollRef.current) return;
    const scrollKey = draft ? "report" : current;
    if (!scrollKey) return;
    if (lastScrollKeyRef.current === scrollKey) return;
    lastScrollKeyRef.current = scrollKey;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior = prefersReduced ? "auto" : "smooth";
    const target =
      scrollKey === "report"
        ? reportRef.current
        : nodeRefs.current.get(scrollKey) ?? null;
    requestAnimationFrame(() => {
      target?.scrollIntoView({ behavior, block: "center" });
    });
  }, [current, draft]);

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
      {/* Status bar removed (no value once each step renders its own state). A
          failure still surfaces so it is never silent. */}
      {error ? (
        <span className="text-[length:var(--ct-text-xs)] ct-status-danger">
          {error} ·{" "}
          <button type="button" onClick={() => void run()} className="underline-offset-2 hover:underline">retry</button>
        </span>
      ) : null}

      {/* Vertical stepper. `relative` so the continuous connector spine can be
          drawn at THIS level — outside every BentoPanel's overflow-hidden, which
          would otherwise clip a per-box line at the box border and stop it from
          crossing the inter-box gap. */}
      <ol className="relative flex flex-col">
        {/* Grey spine — one continuous line through every centered node. x = center
            of the left-rail column (half its width). Spans the full list height so
            it threads all centered nodes regardless of individual box heights. */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-(--ct-space-8) left-[calc((var(--ct-space-32)+var(--ct-space-8))/2)] w-px -translate-x-1/2 bg-[var(--ct-border-soft)]"
        />
        {CONSTRUCTION_STEPS.filter((s) => VISIBLE_STEP_IDS.includes(s.id)).map((step, i, visible) => {
          const life = lifecycleOf(step.id);
          const result = results[step.id];
          const isLast = i === visible.length - 1;
          const connectorDone = result !== undefined; // step finished → green segment
          // Next-up: the previous step is done and this one hasn't started yet —
          // its black ring spins during the transition gap.
          const prevDone = i > 0 && results[visible[i - 1]!.id] !== undefined;
          const isNextUp = phase === "running" && life === "upcoming" && prevDone;
          return (
            <li
              key={step.id}
              ref={(el) => {
                if (el) nodeRefs.current.set(step.id, el);
              }}
              className={cn("relative", SCROLL_MARGIN_CLASS, !isLast && "pb-(--ct-space-8)")}
            >
              {/* Green connector — gap-crossing segment between this box and the
                  next. Lives at the <li> level so it escapes the panel's
                  overflow-hidden. Spans the full pb-(--ct-space-8) gap. */}
              {!isLast && connectorDone ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 left-[calc((var(--ct-space-32)+var(--ct-space-8))/2)] h-(--ct-space-8) w-px -translate-x-1/2 bg-[var(--ct-accent)]"
                />
              ) : null}
              {/* The step is a canonical DS compartment — BentoPanel (.ct-glass-panel).
                  A left RAIL inside the box holds the stepper node, centered. */}
              <BentoPanel>
                <div className="grid grid-cols-[calc(var(--ct-space-32)+var(--ct-space-8))_minmax(0,1fr)]">
                  {/* Left rail — node centered. Green half-segments inside the card:
                      bottom half (node→bottom) when this step is done and not last;
                      top half (top→node) when the previous step is done. */}
                  <div className="relative flex items-center justify-center border-r border-[var(--ct-border-soft)]">
                    {/* Top half: green from top of card to node center */}
                    {i > 0 && results[visible[i - 1]!.id] !== undefined ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute top-0 left-1/2 w-px -translate-x-1/2 bg-[var(--ct-accent)]"
                        style={{ height: "50%" }}
                      />
                    ) : null}
                    {/* Bottom half: green from node center to bottom of card */}
                    {!isLast && connectorDone ? (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute bottom-0 left-1/2 w-px -translate-x-1/2 bg-[var(--ct-accent)]"
                        style={{ height: "50%" }}
                      />
                    ) : null}
                    <StepNode life={life} pipelineRunning={phase === "running"} isNextUp={isNextUp} />
                  </div>

                  {/* Right column — header + body */}
                  <div className="flex min-w-0 flex-col">
                    <BentoHeader
                      title={`${step.index}. ${step.persona}`}
                      subtitle={step.role}
                      trailing={
                        <>
                          {!result && life !== "upcoming" ? (
                            <StepStatusBadge life={life} />
                          ) : null}
                          {result?.provenance ? (
                            <ProvenanceBadge kind={liveToBadge(result.provenance)} compact />
                          ) : null}
                          {result?.status === "unavailable" ? (
                            <span className="ct-section-label ct-status-warning">unavailable</span>
                          ) : null}
                        </>
                      }
                    />
                    {result ? (
                      <>
                        <p className="body-sm ct-text-body p-(--ct-space-5) pb-(--ct-space-4)">
                          {result.headline}
                        </p>
                        {result.metrics.length > 0 ? (
                          step.id === "bitcoin" ? (
                            <BitcoinResultStrip metrics={result.metrics} />
                          ) : step.id === "hashprice" ? (
                            <HashpriceResultStrip metrics={result.metrics} />
                          ) : step.id === "mining_infra" ? (
                            <MiningInfraResultStrip metrics={result.metrics} />
                          ) : step.id === "defi" ? (
                            <DefiResultStrip metrics={result.metrics} />
                          ) : (
                            <StepResultStrip metrics={result.metrics} />
                          )
                        ) : null}
                        {result.note ? (
                          <p className="text-[length:var(--ct-text-xs)] ct-status-warning p-(--ct-space-5)">
                            {result.note}
                          </p>
                        ) : null}
                        {/* The Data Scientist's full report is NOT rendered inside
                            the stepper box — it unrolls as a separate, decorrelated
                            "Report Product" block below the stepper (see <ol> end). */}
                      </>
                    ) : life === "running" ? (
                      <StepLoadingBody stepId={step.id} />
                    ) : (
                      <div className="p-(--ct-space-5)" />
                    )}
                  </div>
                </div>
              </BentoPanel>
            </li>
          );
        })}
      </ol>

      {/* Report Product — the Data Scientist's full report, DECORRELATED from the
          stepper: once step 5 finishes, this unrolls as its own titled block below
          the stepper, not inside a step box. */}
      {draft ? (
        <div ref={reportRef} className={SCROLL_MARGIN_CLASS}>
          <BentoPanel>
            <BentoHeader
              title="Report Product"
              subtitle={draft.vault.label}
            />
            <div className="p-(--ct-space-5)">
              <DataScientistOutput draft={draft} />
              <ProductEngineReport draft={draft} />
              <div className="mt-(--ct-space-4) flex flex-col gap-(--ct-space-2) border-t border-[var(--ct-border-soft)] pt-(--ct-space-3)">
                <div className="flex flex-wrap items-center gap-(--ct-space-2)">
                  <Link
                    href={`/admin/vaults/new?prefill=${encodeURIComponent(encodeVaultFormPrefill(constructionDraftToVaultForm(draft)))}`}
                    className={cn(cockpitButtonVariants({ variant: "primary", size: "sm" }))}
                  >
                    Open in vault wizard
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      window.open("/admin/product-workspace/report/print", "_blank", "noopener")
                    }
                  >
                    Print view
                  </Button>
                </div>
                <p className="text-[length:var(--ct-text-nano)] ct-text-faint">
                  No record created · Manual admin validation required
                </p>
              </div>
            </div>
          </BentoPanel>
        </div>
      ) : null}
    </div>
  );
}
