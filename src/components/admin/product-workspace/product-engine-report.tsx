"use client";

/**
 * product-engine-report.tsx — PROMPT 17 report surface.
 *
 * Renders, beneath the Data Scientist output, the four wired product engines plus
 * the Calculated-vs-Documented disclosure. Pure presentation: it only reads what
 * the pipeline already computed. Token-only (`--ct-*`), dark, flat (no nested
 * boxes — hairline-separated sections + native <details> collapsibles).
 *
 * HONESTY (PROMPT 17 STOP conditions enforced visually):
 *   - Operator economics renders under its OWN header, explicitly "separate from
 *     investor return" — it is never shown as part of the client APY.
 *   - Recovery is labelled "not a guarantee"; the recovery flag is read-only.
 *   - The funding decision shows its PARTIAL status + missing inputs verbatim.
 *   - The Monte-Carlo disclosure states it is static / scenario-level.
 */

import { cn } from "@/lib/cn";
import type { ProductConstructionDraft } from "@/lib/agentic/swarm/live/types";
import type {
  Waterfall,
  WaterfallStep,
  WaterfallStepStatus,
} from "@/lib/products/btc-mining-waterfalls";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <span className="ct-bento-label">{children}</span>;
}

/** A flat key/value line. */
function Row({ k, v, tone }: { k: string; v: React.ReactNode; tone?: "warn" | "accent" }) {
  return (
    <div className="flex items-baseline justify-between gap-(--ct-space-4) py-(--ct-space-1)">
      <span className="body-sm ct-text-tertiary">{k}</span>
      <span
        className={cn(
          "mono text-[length:var(--ct-text-xs)] ct-text-body text-right",
          tone === "warn" && "ct-status-warning",
          tone === "accent" && "ct-text-accent",
        )}
      >
        {v}
      </span>
    </div>
  );
}

/** A small status chip for engine source-status / step status. */
function StatusChip({ status }: { status: string }) {
  const warn = /UNKNOWN|PARTIAL|blocked|not_applicable|pending/i.test(status);
  const ok = /CALCULATED|active/i.test(status);
  return (
    <span
      className={cn(
        "ct-section-label rounded-(--ct-radius-sm) px-(--ct-space-1_5) py-px",
        ok && "ct-text-accent",
        warn && "ct-status-warning",
        !ok && !warn && "ct-text-tertiary",
      )}
    >
      {status}
    </span>
  );
}

/** A collapsible engine block. */
function EngineDetails({
  title,
  trailing,
  children,
  defaultOpen = false,
}: {
  title: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details className="group border-t border-[var(--ct-border-soft)] py-(--ct-space-4)" open={defaultOpen}>
      <summary className="ct-bento-label flex cursor-pointer list-none items-center gap-(--ct-space-2) transition-colors hover:text-[var(--ct-text-body)]">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rotate-45 border-b border-r border-current transition-transform group-open:rotate-[225deg]"
        />
        <span className="flex-1">{title}</span>
        {trailing}
      </summary>
      <div className="pt-(--ct-space-3) pl-(--ct-space-4)">{children}</div>
    </details>
  );
}

const STEP_DOT: Record<WaterfallStepStatus, string> = {
  active: "ct-text-accent",
  pending: "ct-text-tertiary",
  blocked: "ct-status-warning",
  not_applicable: "ct-text-faint",
};

function WaterfallList({ wf }: { wf: Waterfall }) {
  return (
    <div className="flex flex-col gap-(--ct-space-2)">
      <SectionLabel>{wf.title}</SectionLabel>
      <ol className="flex flex-col gap-(--ct-space-1)">
        {wf.steps.map((s: WaterfallStep) => (
          <li key={s.rank} className="flex items-baseline gap-(--ct-space-2)">
            <span className={cn("mono text-[length:var(--ct-text-nano)] tabular-nums ct-text-faint")}>{s.rank}.</span>
            <span className={cn("h-1.5 w-1.5 shrink-0 translate-y-1 rounded-(--ct-radius-full)", STEP_DOT[s.status], s.status === "active" ? "bg-[var(--ct-accent)]" : s.status === "blocked" ? "bg-[var(--ct-status-warning)]" : "bg-[var(--ct-text-faint)]")} />
            <span className="flex-1 body-sm ct-text-body">{s.label}</span>
            <StatusChip status={s.status} />
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ProductEngineReport({ draft }: { draft: ProductConstructionDraft }) {
  const funding = draft.stableFundingDecision;
  const exit = draft.exitRecovery;
  const wf = draft.waterfalls;
  const op = draft.operatorEconomics;
  const mc = draft.monteCarloDisclosure;

  // Nothing wired (non-mining product) → render nothing.
  if (!funding && !exit && !wf && !op) return null;

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <details className="group mt-(--ct-space-4) border-t border-[var(--ct-border-soft)] pt-(--ct-space-3)">
      <summary className="ct-bento-label flex cursor-pointer list-none items-center gap-(--ct-space-2) transition-colors hover:text-[var(--ct-text-body)]">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rotate-45 border-b border-r border-current transition-transform group-open:rotate-[225deg]"
        />
        Engine detail (funding · recovery · waterfalls)
      </summary>
      <div className="pt-(--ct-space-4)">
        <ProductEngineReportBody
          funding={funding}
          exit={exit}
          wf={wf}
          op={op}
          mc={mc}
          pct={pct}
        />
      </div>
    </details>
  );
}

function ProductEngineReportBody({
  funding,
  exit,
  wf,
  op,
  mc,
  pct,
}: {
  funding: ProductConstructionDraft["stableFundingDecision"];
  exit: ProductConstructionDraft["exitRecovery"];
  wf: ProductConstructionDraft["waterfalls"];
  op: ProductConstructionDraft["operatorEconomics"];
  mc: ProductConstructionDraft["monteCarloDisclosure"];
  pct: (n: number) => string;
}) {
  return (
    <div className="flex flex-col">
      {/* Calculated-vs-documented disclosure removed at the admin's request. */}

      {/* ── Stable Funding Engine (Phase B) ─────────────────────────────── */}
      {funding ? (
        <EngineDetails
          title="Stable Funding Engine"
          trailing={<StatusChip status={funding.sourceStatus} />}
        >
          <div className="flex flex-col gap-(--ct-space-1)">
            <Row k="Decision" v={funding.source} tone="accent" />
            <Row k="Distribution allowed" v={funding.coverageAllowsDistribution ? "yes" : "no"} tone={funding.coverageAllowsDistribution ? "accent" : "warn"} />
            <Row k="Borrow allowed" v={funding.borrowAllowed ? "yes" : "no"} />
            <Row k="LTV state" v={funding.ltvState} />
            <p className="body-sm ct-text-secondary pt-(--ct-space-2) leading-relaxed">{funding.reason}</p>
            {funding.missingInputs.length > 0 ? (
              <p className="text-[length:var(--ct-text-xs)] ct-status-warning pt-(--ct-space-1)">
                Partial funding decision — missing inputs: {funding.missingInputs.join(", ")}.
              </p>
            ) : null}
          </div>
        </EngineDetails>
      ) : null}

      {/* ── Exit / Recovery (Phase C) ───────────────────────────────────── */}
      {exit ? (
        <EngineDetails
          title="Exit / Recovery state"
          trailing={<StatusChip status={exit.state} />}
        >
          <div className="flex flex-col gap-(--ct-space-1)">
            <Row k="State" v={exit.state} tone="accent" />
            <Row k="Early-exit eligible" v={exit.earlyExitEligible ? "yes" : "no"} />
            <Row k="Recovery required" v={exit.recoveryRequired ? "yes" : "no"} tone={exit.recoveryRequired ? "warn" : undefined} />
            {exit.recoveryMode ? <Row k="Recovery mode" v={exit.recoveryMode} /> : null}
            <Row k="Guaranteed recovery" v="no — never guaranteed" tone="warn" />
            <p className="body-sm ct-text-secondary pt-(--ct-space-2) leading-relaxed">{exit.note}</p>
            {exit.missingInputs.length > 0 ? (
              <p className="text-[length:var(--ct-text-xs)] ct-status-warning pt-(--ct-space-1)">
                Construction-time state — missing live inputs: {exit.missingInputs.join(", ")}.
              </p>
            ) : null}
          </div>
        </EngineDetails>
      ) : null}

      {/* ── Waterfalls (Phase D) ────────────────────────────────────────── */}
      {wf ? (
        <EngineDetails title="Waterfalls — normal / early / recovery">
          <div className="flex flex-col gap-(--ct-space-5)">
            <WaterfallList wf={wf.normal} />
            <WaterfallList wf={wf.earlyClosure} />
            <WaterfallList wf={wf.recovery} />
            <p className="text-[length:var(--ct-text-nano)] ct-text-faint leading-relaxed">
              Ordering is fixed; a step status of “active/pending/blocked/not_applicable” reflects the current
              funding + exit state. A waterfall never implies a guaranteed distribution.
            </p>
          </div>
        </EngineDetails>
      ) : null}

      {/* ── Operator economics (Phase E) — SEPARATE from investor return ── */}
      {op ? (
        <EngineDetails
          title="Operator economics — separate from investor return"
          trailing={<StatusChip status="CONFIGURED_NOT_VALIDATED" />}
        >
          <div className="flex flex-col gap-(--ct-space-1)">
            <p className="text-[length:var(--ct-text-xs)] ct-status-warning pb-(--ct-space-2)">
              These figures model the operator side only. They are never added to the client APY / distribution.
            </p>
            <Row k="Machine markup" v={pct(op.machineMarkup.value)} />
            <Row k="Revenue share" v={pct(op.revenueShare.value)} />
            <Row k="Management fee" v={pct(op.managementFee.value)} />
            <Row k="Performance fee" v={pct(op.performanceFee.value)} />
            <Row k="Spread above client target" v={pct(op.performanceSpreadAboveClientTarget.value)} />
            <Row k="Financing spread" v={pct(op.financingSpread.value)} />
            <Row k="Machine resale value" v={pct(op.machineResaleValue.value)} />
            <Row k="Machine redeploy value" v={pct(op.machineRedeployValue.value)} />
            <Row k="Residual mining production" v={pct(op.residualMiningProduction.value)} />
          </div>
        </EngineDetails>
      ) : null}

      {/* ── Monte-Carlo disclosure (Phase G) ────────────────────────────── */}
      {mc ? (
        <section className="border-t border-[var(--ct-border-soft)] py-(--ct-space-4)">
          <p className="text-[length:var(--ct-text-xs)] ct-text-muted leading-relaxed">
            <span className="ct-section-label ct-text-tertiary">Monte-Carlo {mc.version}</span> — {mc.note}
          </p>
        </section>
      ) : null}
    </div>
  );
}
