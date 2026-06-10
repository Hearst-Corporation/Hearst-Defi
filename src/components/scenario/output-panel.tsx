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
import { RebalancingActions } from "@/components/scenario/rebalancing-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
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
   * AI-generated narrative from the Scenario Narrative agent (Kimi K2.6 via Hypercli).
   * `null` means the agent failed (timeout, forbidden-words filter, schema fail)
   * and we degrade gracefully by surfacing a discreet note instead of hiding
   * the missing section.
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

// ── shared map helpers (full-only sections) ──────────────────────────────────

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

// ── full-only sub-components ──────────────────────────────────────────────────

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
            <li key={i} className="flex items-start gap-2 text-sm">
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

function NarrativeCard({
  narrative,
}: {
  narrative: ScenarioNarrativeOutput | null;
}) {
  if (narrative === null) {
    return (
      <Card>
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ct-status-warning)]"
            aria-hidden
          />
          <p className="text-xs ct-text-muted">
            AI narrative unavailable — engine output shown above.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="mb-3">
        <CardTitle>Narrative</CardTitle>
        <ProvenanceBadge kind="estimated" />
      </CardHeader>
      <Markdown content={narrative.narrative_md} />
      {narrative.risk_warning ? (
        <div className="mt-4 rounded-full border border-[var(--ct-status-warning)] ct-status-warning-bg px-4 py-3">
          <p className="stat-label mb-1 ct-status-warning">
            Risk warning
          </p>
          <p className="text-sm ct-text-body">
            {narrative.risk_warning}
          </p>
        </div>
      ) : null}
    </Card>
  );
}

function BtcTacticalCard({ output }: { output: ScenarioOutput }) {
  const armedTriggers = output.btc_tactical.triggers.filter((t) => t.armed);

  return (
    <Card>
      <CardHeader className="mb-4">
        <CardTitle>BTC Tactical</CardTitle>
        <span className="stat-label">
          Target {output.btc_tactical.targetExposurePct.toFixed(0)}%
        </span>
      </CardHeader>

      <div className="flex flex-wrap gap-2">
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

      {armedTriggers.length > 0 && (
        <div className="mt-4 border-t border-[var(--ct-border-soft)] pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[var(--ct-tracking-wide)] ct-text-muted">
            Armed triggers
          </p>
          <ul className="space-y-1.5">
            {armedTriggers.map((t) => (
              <li key={t.id} className="flex items-start gap-2 text-sm">
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
        </div>
      )}
    </Card>
  );
}

// ── compact variant ───────────────────────────────────────────────────────────

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
          ? "border-l-[var(--ct-border-strong)]"
          : "border-l-[var(--ct-text-strong)]",
        "transition-opacity duration-[var(--ct-dur-fast)]",
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
        "relative space-y-4 transition-opacity duration-[var(--ct-dur-fast)]",
        isPending && "pointer-events-none opacity-50",
      )}
      aria-busy={isPending}
    >
      {isPending && (
        <div className="pointer-events-none absolute inset-0 z-[var(--ct-z-overlay)] flex items-center justify-center rounded-lg ct-surface-2/60 backdrop-blur-sm">
          <span className="text-sm ct-text-body">Computing…</span>
        </div>
      )}

      {/* Section 1: APY Hero */}
      <ApyHero output={output} variant="full" />

      {/* Section 2: PTAI block */}
      <PtaiBlock output={output} />

      {/* Section 2.5: AI Narrative (Kimi K2.6) */}
      {narrative !== undefined ? <NarrativeCard narrative={narrative} /> : null}

      {/* Section 3: 12-Month NAV Projection */}
      <NavSparkline output={output} />

      {/* Section 4: Risk & Mining 2×2 grid */}
      <ScoreGrid output={output} variant="full" />

      {/* Section 5: Vault Mode */}
      <VaultMode output={output} variant="full" />

      {/* Section 6: Allocation */}
      <AllocationSection output={output} variant="full" />

      {/* Section 7: BTC Tactical */}
      {output.btc_tactical.guardrails.length > 0 && (
        <BtcTacticalCard output={output} />
      )}

      {/* Section 8: Rebalancing Actions */}
      <RebalancingActions output={output} />

      {/* Section 9: Assumptions */}
      <Card>
        <CardHeader className="mb-4">
          <CardTitle>Assumptions</CardTitle>
        </CardHeader>
        <AssumptionsList assumptions={output.assumptions} />
      </Card>

      {/* Disclaimer */}
      <p className="border-t border-[var(--ct-border-soft)] pt-4 text-xs italic ct-text-muted">
        <span className="font-semibold not-italic ct-text-body">
          Not guaranteed.
        </span>{" "}
        Projections are conditional on stated assumptions. Methodology v1.0.
        Forward projections are conditional on the stated assumptions and are not
        guaranteed. Past performance does not predict future results.
      </p>
    </div>
  );
}
