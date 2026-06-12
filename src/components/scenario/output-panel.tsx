"use client";

import { useState } from "react";

import { Markdown } from "@/components/admin/markdown";
import { NavSparkline } from "@/components/scenario/nav-sparkline";
import {
  AllocationSection,
  ApyHero,
  ScoreGrid,
  VaultMode,
} from "@/components/scenario/output-panel-sections";
import { PtaiBlock } from "@/components/scenario/ptai-block";
import {
  deriveActions,
  RebalancingActions,
  type RebalancingAction,
} from "@/components/scenario/rebalancing-actions";
import { ApyRange } from "@/components/ui/apy-range";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { NestedCallout, NestedPanel } from "@/components/ui/nested-panel";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  BUCKET_COLOR,
  BUCKET_LABEL,
  CONFIDENCE_VARIANT,
  MODE_LABEL,
  MODE_VARIANT,
  progressScoreFillClass,
} from "@/lib/constants/scenario";
import { cn } from "@/lib/cn";
import type { ScenarioNarrativeOutput } from "@/lib/agents/schemas";
import type {
  BtcGuardrail,
  BtcGuardrailKind,
  ScenarioOutput,
} from "@/lib/engine/types";

interface OutputPanelBaseProps {
  output: ScenarioOutput;
}

interface OutputPanelFullProps extends OutputPanelBaseProps {
  variant?: "full";
  isPending: boolean;
  /**
   * AI-generated narrative from the Scenario Narrative agent (OpenAI GPT-4.1, ADR-011).
   * `null` means the agent failed (timeout, forbidden-words filter, schema fail)
   * and we degrade gracefully by surfacing a discreet footer note instead of a
   * whole broken-looking card.
   */
  narrative?: ScenarioNarrativeOutput | null;
}

interface OutputPanelCompactProps extends OutputPanelBaseProps {
  variant: "compact";
  presetLabel: string;
  side: "A" | "B";
  /** Optional comparison reference (the other panel). When present on side B,
   * deltas are rendered under hero APY and risk score. */
  vs?: ScenarioOutput | null;
  isPending?: boolean;
}

type OutputPanelProps = OutputPanelFullProps | OutputPanelCompactProps;

// ── shared map helpers ────────────────────────────────────────────────────────

const GUARDRAIL_STATUS_VARIANT: Record<
  BtcGuardrail["status"],
  "success" | "default" | "warning" | "danger"
> = {
  healthy: "success",
  normal: "default",
  warning: "warning",
  breached: "danger",
};

const GUARDRAIL_KIND_LABEL: Record<BtcGuardrailKind, string> = {
  volatility: "Volatility",
  mining_margin: "Mining Margin",
  concentration: "Concentration",
  liquidity: "Liquidity",
};

/** Tone classes for the recommended-action callout, keyed by the action's
 * badge variant so a colour rename ripples to one place. */
const ACTION_TONE: Record<
  RebalancingAction["variant"],
  { dot: string; border: string }
> = {
  success: { dot: "bg-(--ct-status-success)", border: "border-l-(--ct-status-success)" },
  warning: { dot: "bg-(--ct-status-warning)", border: "border-l-(--ct-status-warning)" },
  danger: { dot: "bg-(--ct-status-danger)", border: "border-l-(--ct-status-danger)" },
  brand: { dot: "bg-(--ct-accent)", border: "border-l-(--ct-accent)" },
  default: { dot: "bg-(--ct-text-muted)", border: "border-l-(--ct-border-strong)" },
};

/**
 * Parses an assumption string. If it contains `=`, splits on first `=` and
 * returns { key, value }. Otherwise returns the full string as value.
 */
function parseAssumption(line: string): { key: string | null; value: string } {
  const eqIdx = line.indexOf("=");
  if (eqIdx === -1) return { key: null, value: line };
  const key = line.slice(0, eqIdx).trim().replace(/_/g, " ");
  const value = line.slice(eqIdx + 1).trim();
  return { key, value };
}

// ── compact delta helpers ─────────────────────────────────────────────────────

function computeApyDelta(a: ScenarioOutput, b: ScenarioOutput): number {
  const midA = (a.apy_range.low + a.apy_range.high) / 2;
  const midB = (b.apy_range.low + b.apy_range.high) / 2;
  return midB - midA;
}

function formatSignedFixed(n: number, precision: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "±";
  return `${sign}${Math.abs(n).toFixed(precision)}`;
}

function formatSignedInt(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "±";
  return `${sign}${Math.abs(Math.round(n))}`;
}

// ── full-view: decision panel ─────────────────────────────────────────────────

/** A score cell (risk / mining) inside the decision panel stat strip. No own
 * provenance badge — the panel header carries a single Estimated badge. */
function ScoreCell({
  label,
  value,
  fillClassName,
  caption,
}: {
  label: string;
  value: number;
  fillClassName: string;
  caption: string;
}) {
  return (
    <NestedPanel className="flex flex-col gap-2 p-4">
      <span className="stat-label">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="mono text-2xl font-extrabold tabular-nums ct-text-primary">
          {value.toFixed(0)}
        </span>
        <span className="body-sm ct-text-muted">/100</span>
      </div>
      <Progress value={value} fillClassName={fillClassName} />
      <span className="body-xs ct-text-muted">{caption}</span>
    </NestedPanel>
  );
}

/**
 * Single hero block answering "what should I do?" in five seconds:
 * APY range, stressed floor, risk + mining posture, confidence, the
 * recommended action, then scenario-level PTAI. Rebalancing detail lives below.
 * One Estimated badge.
 */
function DecisionPanel({
  output,
  narrative,
}: {
  output: ScenarioOutput;
  narrative?: ScenarioNarrativeOutput | null;
}) {
  const topAction = deriveActions(output)[0] ?? null;
  const tone = topAction ? ACTION_TONE[topAction.variant] : ACTION_TONE.success;
  const actionLabel = topAction
    ? topAction.label
    : "Hold posture — allocation within target bands";
  const riskFill = progressScoreFillClass(output.risk_score, true);
  const miningFill = progressScoreFillClass(output.mining_margin_score, false);

  return (
    <Card>
      <CardHeader className="mb-5">
        <div className="min-w-0">
          <CardTitle>Scenario decision</CardTitle>
          <p className="mt-0.5 body-xs ct-text-muted">
            Deterministic engine output · conditional on stated assumptions
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={MODE_VARIANT[output.mode]}>
            {MODE_LABEL[output.mode]}
          </Badge>
          <ProvenanceBadge kind="estimated" />
        </div>
      </CardHeader>

      {/* Hero: APY range + confidence */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="stat-label">Projected APY range</span>
          <ApyRange
            low={output.apy_range.low}
            high={output.apy_range.high}
            className="mono text-3xl sm:text-4xl font-extrabold tabular-nums ct-text-strong leading-tight"
          />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="stat-label">Confidence</span>
          <Badge variant={CONFIDENCE_VARIANT[output.confidence]}>
            {output.confidence.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Stat strip: stressed floor · risk · mining */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <NestedPanel className="flex flex-col gap-2 p-4">
          <span className="stat-label">Stressed floor</span>
          <span className="mono text-2xl font-extrabold tabular-nums ct-text-primary">
            {output.stressed_apy.toFixed(1)}%
          </span>
          <span className="body-xs ct-text-muted">Bear scenario floor</span>
        </NestedPanel>
        <ScoreCell
          label="Risk score"
          value={output.risk_score}
          fillClassName={riskFill}
          caption="Lower = lower risk"
        />
        <ScoreCell
          label="Mining margin"
          value={output.mining_margin_score}
          fillClassName={miningFill}
          caption="Current vs target"
        />
      </div>

      {/* Recommended action */}
      <div className="mt-5">
        <span className="stat-label">Recommended action</span>
        <NestedCallout
          className={cn("mt-2 flex items-center gap-3 border-l-4", tone.border)}
        >
          <span
            className={cn("inline-block h-2 w-2 shrink-0 rounded-full", tone.dot)}
            aria-hidden
          />
          <p className="body-sm font-semibold ct-text-strong">{actionLabel}</p>
          {topAction ? (
            <Badge
              variant={topAction.variant}
              className="ml-auto shrink-0 text-micro"
            >
              {topAction.ruleId}
            </Badge>
          ) : null}
        </NestedCallout>
      </div>

      {/* PTAI — calm nested panel inside the decision */}
      <div className="mt-5">
        <span className="stat-label">Projection · Trigger · Action · Impact</span>
        <PtaiBlock output={output} className="mt-2" />
      </div>

      {/* AI narrative — discreet, never a broken-looking standalone card */}
      {narrative === null ? (
        <p className="mt-4 border-t border-(--ct-border-soft) pt-3 body-xs ct-text-muted">
          AI narrative unavailable — deterministic engine output shown.
        </p>
      ) : narrative ? (
        <div className="mt-4 border-t border-(--ct-border-soft) pt-4">
          <span className="stat-label">AI narrative</span>
          <div className="mt-2">
            <Markdown content={narrative.narrative_md} />
          </div>
          {narrative.risk_warning ? (
            <NestedCallout className="mt-3 border-l-4 border-l-(--ct-status-warning)">
              <p className="stat-label mb-1 ct-status-warning">Risk warning</p>
              <p className="body-sm ct-text-body">{narrative.risk_warning}</p>
            </NestedCallout>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

// ── full-view: allocation + rebalancing (one merged block) ────────────────────

/**
 * Allocation target, tactical guardrails and the rule-based rebalancing actions
 * collapsed into one block — they all describe the same operational decision,
 * so they no longer live in three separate cards.
 */
function AllocationRebalancePanel({ output }: { output: ScenarioOutput }) {
  const armedTriggers = output.btc_tactical.triggers.filter((t) => t.armed);
  const hasGuardrails = output.btc_tactical.guardrails.length > 0;

  return (
    <Card>
      <CardHeader className="mb-5">
        <div className="min-w-0">
          <CardTitle>Allocation &amp; rebalancing</CardTitle>
          <p className="mt-0.5 body-xs ct-text-muted">
            Target weights, guardrails and rule-based actions
          </p>
        </div>
        <ProvenanceBadge kind="estimated" />
      </CardHeader>

      {/* Target allocation */}
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="stat-label">Target allocation</span>
        <span className="body-xs ct-text-muted">
          BTC tactical target {output.btc_tactical.targetExposurePct.toFixed(0)}%
        </span>
      </div>
      <div className="flex h-2 w-full overflow-hidden rounded-full">
        {output.allocations.map((a) => (
          <div
            key={a.bucket}
            className="ct-alloc-bar-segment"
            style={{ width: `${a.pct}%`, color: BUCKET_COLOR[a.bucket] }}
            title={`${BUCKET_LABEL[a.bucket]}: ${a.pct.toFixed(0)}%`}
          />
        ))}
      </div>
      <div className="mt-4">
        <div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-x-4 text-micro font-semibold uppercase tracking-(--ct-tracking-wide) ct-text-muted">
          <span>Bucket</span>
          <span className="text-right">Pct</span>
          <span className="text-right">Yield contribution</span>
        </div>
        <ul className="divide-y divide-(--ct-border-soft)">
          {output.allocations.map((a) => (
            <li
              key={a.bucket}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 py-2.5 body-sm first:pt-1 last:pb-1"
            >
              <span className="flex min-w-0 items-center gap-2 ct-text-body">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full shadow-(--ct-glow-dot) bg-current"
                  style={{ color: BUCKET_COLOR[a.bucket] }}
                  aria-hidden
                />
                {BUCKET_LABEL[a.bucket]}
              </span>
              <span className="text-right mono tabular-nums ct-text-primary">
                {a.pct.toFixed(0)}%
              </span>
              <span className="text-right mono tabular-nums ct-text-muted">
                {a.yield_contribution_bps > 0
                  ? `+${a.yield_contribution_bps} bps`
                  : "P&L variable"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Tactical guardrails */}
      {hasGuardrails ? (
        <div className="mt-5 border-t border-(--ct-border-soft) pt-5">
          <span className="stat-label">Guardrails</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {output.btc_tactical.guardrails.map((g) => (
              <Badge
                key={g.id}
                variant={GUARDRAIL_STATUS_VARIANT[g.status]}
                title={g.detail}
              >
                {GUARDRAIL_KIND_LABEL[g.kind]}
              </Badge>
            ))}
          </div>
          {armedTriggers.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {armedTriggers.map((t) => (
                <li key={t.id} className="flex items-start gap-2 body-sm">
                  <span
                    className="mt-0.5 shrink-0 text-micro ct-status-warning"
                    aria-hidden
                  >
                    ▸
                  </span>
                  <span className="ct-text-body">{t.condition}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* Rebalancing actions (PTAI list) */}
      <div className="mt-5 border-t border-(--ct-border-soft) pt-5">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <span className="stat-label">Rebalancing actions</span>
          <span className="eyebrow">Max 4 · Rule-based · PTAI</span>
        </div>
        <RebalancingActions output={output} />
      </div>
    </Card>
  );
}

// ── full-view: assumptions (secondary, collapsed by default) ──────────────────

function AssumptionsList({ assumptions }: { assumptions: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const THRESHOLD = 5;
  const shouldTruncate = assumptions.length > THRESHOLD;
  const visible =
    shouldTruncate && !expanded ? assumptions.slice(0, THRESHOLD) : assumptions;

  return (
    <div>
      <ul className="space-y-2">
        {visible.map((line, i) => {
          const { key, value } = parseAssumption(line);
          return (
            <li key={i} className="flex items-start gap-2 body-sm">
              <span
                className="mt-0.5 shrink-0 text-micro ct-text-strong"
                aria-hidden
              >
                ▸
              </span>
              {key !== null ? (
                <span>
                  <span className="font-semibold ct-text-body capitalize">
                    {key}
                  </span>
                  <span className="ct-text-muted">: </span>
                  <span className="mono ct-text-body">{value}</span>
                </span>
              ) : (
                <span className="ct-text-body">{value}</span>
              )}
            </li>
          );
        })}
      </ul>
      {shouldTruncate && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((x) => !x)}
          className="mt-3 ct-text-strong hover:ct-text-strong"
        >
          {expanded ? "Show less" : `Show ${assumptions.length - THRESHOLD} more`}
        </Button>
      )}
    </div>
  );
}

/** Assumptions live below the decision as a collapsed, secondary block — they
 * must never weigh as much as the result itself. */
function AssumptionsPanel({ assumptions }: { assumptions: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <div className="min-w-0">
          <CardTitle>Assumptions</CardTitle>
          <p className="mt-0.5 body-xs ct-text-muted">
            {assumptions.length} inputs behind this projection
          </p>
        </div>
        <span className="shrink-0 body-xs font-semibold ct-text-accent">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open ? (
        <div className="mt-4 border-t border-(--ct-border-soft) pt-4">
          <AssumptionsList assumptions={assumptions} />
        </div>
      ) : null}
    </Card>
  );
}

// ── compact variant (Compare mode — unchanged behaviour) ──────────────────────

function CompactPanel({
  output,
  presetLabel,
  side,
  vs,
  isPending,
}: Omit<OutputPanelCompactProps, "variant">) {
  const showDeltas = side === "B" && vs !== null && vs !== undefined;
  const apyDeltaValue = showDeltas ? computeApyDelta(vs, output) : null;
  const riskDeltaValue = showDeltas ? output.risk_score - vs.risk_score : null;

  // For APY: higher is "better" (positive delta = green).
  // For Risk: higher is "worse" (positive delta = red).
  const apyDeltaToneClass =
    apyDeltaValue !== null
      ? apyDeltaValue > 0.05
        ? "ct-status-success"
        : apyDeltaValue < -0.05
          ? "ct-status-danger"
          : "ct-text-muted"
      : "";

  const riskDeltaToneClass =
    riskDeltaValue !== null
      ? riskDeltaValue > 0.5
        ? "ct-status-danger"
        : riskDeltaValue < -0.5
          ? "ct-status-success"
          : "ct-text-muted"
      : "";

  const apyDelta =
    apyDeltaValue !== null ? (
      <p
        className={cn(
          "mt-3 mono text-xs font-semibold tabular-nums",
          apyDeltaToneClass,
        )}
        aria-label={`APY midpoint delta vs Scenario A: ${apyDeltaValue.toFixed(2)} percentage points`}
      >
        Δ {formatSignedFixed(apyDeltaValue, 2)} pts{" "}
        <span className="font-normal ct-text-muted">
          midpoint vs Scenario A
        </span>
      </p>
    ) : undefined;

  const riskFooter =
    riskDeltaValue !== null ? (
      <p
        className={cn(
          "mt-2 mono text-micro font-semibold tabular-nums",
          riskDeltaToneClass,
        )}
        aria-label={`Risk score delta vs Scenario A: ${Math.round(riskDeltaValue)}`}
      >
        Δ {formatSignedInt(riskDeltaValue)}{" "}
        <span className="font-normal ct-text-muted">
          vs A
        </span>
      </p>
    ) : undefined;

  return (
    <section
      className={cn(
        "relative flex flex-col gap-4 glass-panel p-5",
        "border-l-4",
        side === "A"
          ? "border-l-(--ct-border-strong)"
          : "border-l-(--ct-text-strong)",
        "transition-opacity duration-(--ct-dur-fast)",
        isPending && "pointer-events-none opacity-50",
      )}
      aria-busy={isPending}
      aria-label={`Scenario ${side}: ${presetLabel}`}
    >
      <header className="flex flex-col gap-0.5">
        <span className="eyebrow">Scenario {side}</span>
        <h3 className="h3 truncate" title={presetLabel}>
          {presetLabel}
        </h3>
      </header>

      <ApyHero output={output} variant="compact" delta={apyDelta} />
      <ScoreGrid output={output} variant="compact" riskFooter={riskFooter} />
      <VaultMode output={output} variant="compact" />
      <AllocationSection output={output} variant="compact" />
    </section>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export function OutputPanel(props: OutputPanelProps) {
  if (props.variant === "compact") {
    const { output, presetLabel, side, vs, isPending } = props;
    return (
      <CompactPanel
        output={output}
        presetLabel={presetLabel}
        side={side}
        vs={vs}
        isPending={isPending}
      />
    );
  }

  const { output, isPending, narrative } = props;

  return (
    <div
      className={cn(
        "relative space-y-5 transition-opacity duration-(--ct-dur-fast)",
        isPending && "pointer-events-none opacity-50",
      )}
      aria-busy={isPending}
    >
      {isPending && (
        <div className="pointer-events-none absolute inset-0 z-(--ct-z-overlay) flex items-center justify-center rounded-lg ct-surface-2/60 backdrop-blur-sm">
          <span className="body-sm ct-text-body">Computing…</span>
        </div>
      )}

      {/* 1 — Scenario decision (the answer) */}
      <DecisionPanel output={output} narrative={narrative} />

      {/* 2 — 12-month NAV projection */}
      <NavSparkline output={output} />

      {/* 3 — Allocation & rebalancing (the operational plan) */}
      <AllocationRebalancePanel output={output} />

      {/* 4 — Assumptions (secondary, collapsed) */}
      <AssumptionsPanel assumptions={output.assumptions} />

      {/* Disclaimer */}
      <p className="border-t border-(--ct-border-soft) pt-4 body-xs italic ct-text-muted">
        <span className="font-semibold not-italic ct-text-body">
          Not guaranteed.
        </span>{" "}
        Projections are conditional on stated assumptions. Methodology v1.0. Past
        performance does not predict future results.
      </p>
    </div>
  );
}
