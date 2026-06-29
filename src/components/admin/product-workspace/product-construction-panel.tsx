"use client";

import { useCallback, useState } from "react";

import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { Markdown } from "@/components/admin/markdown";
import { HcChartCard, HcFanChart } from "@/components/dataviz/his";
import type { HcSourceStatus } from "@/components/dataviz/his/types";
import type {
  ChartArtifact,
  ProductConstructionDraft,
} from "@/lib/agentic/swarm/live/types";

/**
 * Product Construction panel — the visible output of the six live-read swarms.
 *
 * The admin triggers the pipeline for the current objective; it fetches real
 * market/Telegram data, computes a seeded Monte-Carlo, and returns a numeric,
 * charted, written DRAFT. This panel renders the artefacts richly: a projection
 * fan (p5/p50/p95), the blended-yield allocation, the headline range, the audit
 * trail, and the long-form write-up. Read-only — nothing is created or deployed.
 */

function provenanceToSource(p: ChartArtifact["provenance"]): HcSourceStatus {
  switch (p) {
    case "Live":
      return "live";
    case "Oracle":
      return "oracle";
    case "Attested":
      return "attested";
    case "Estimated":
      return "estimated";
    case "Manual":
      return "manual";
    case "Stale":
      return "stale";
  }
}

function FanCard({
  chart,
  disclaimer,
}: {
  chart: ChartArtifact;
  disclaimer: string;
}) {
  const bands = (chart.fanBands ?? []).map((b) => ({
    m: b.m,
    p5: b.p5,
    p50: b.p50,
    p95: b.p95,
  }));
  const last = bands.at(-1);
  const metric = last ? `${last.p5}–${last.p95}%` : undefined;
  return (
    <HcChartCard
      title={chart.title}
      {...(metric ? { metric } : {})}
      source={provenanceToSource(chart.provenance)}
      disclaimer={disclaimer}
      height={300}
      aria-label={chart.ariaLabel}
    >
      <HcFanChart
        bands={bands}
        unit={chart.unit}
        {...(chart.seedLabel ? { seedLabel: chart.seedLabel } : {})}
        aria-label={chart.ariaLabel}
      />
    </HcChartCard>
  );
}

function AllocationCard({ chart }: { chart: ChartArtifact }) {
  const segments = chart.allocation ?? [];
  const total = segments.reduce((s, x) => s + x.valuePct, 0) || 1;
  return (
    <HcChartCard
      title={chart.title}
      source={provenanceToSource(chart.provenance)}
      height={120}
      aria-label={chart.ariaLabel}
    >
      <div className="flex flex-col gap-2 p-2">
        {segments.map((seg, i) => (
          <div key={seg.label} className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs text-[var(--ct-text-secondary)]">
              <span>{seg.label}</span>
              <span className="font-mono text-[var(--ct-text-strong)]">
                {seg.valuePct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-page">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${(seg.valuePct / total) * 100}%`,
                  background:
                    i === 0 ? "var(--ct-accent)" : "var(--ct-status-info)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </HcChartCard>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[var(--ct-border)] bg-surface-card p-4">
      <span className="ct-bento-label">{label}</span>
      <span className="font-mono text-base font-bold text-[var(--ct-text-strong)]">
        {value}
      </span>
    </div>
  );
}

export function ProductConstructionPanel({
  objective,
}: {
  objective: string | null;
}) {
  const [draft, setDraft] = useState<ProductConstructionDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const run = useCallback(async () => {
    if (!objective) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/product-construction/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setDraft((await res.json()) as ProductConstructionDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "request failed");
    } finally {
      setLoading(false);
    }
  }, [objective]);

  if (!objective) {
    return (
      <p className="body-sm ct-text-muted">
        Provide an objective to run the construction swarms.
      </p>
    );
  }

  const fan = draft?.charts.find((c) => c.kind === "fan");
  const allocation = draft?.charts.find((c) => c.kind === "allocation");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={() => void run()}
          disabled={loading}
        >
          {loading ? "Running swarms…" : "Run construction swarms"}
        </Button>
        <span className="text-xs text-[var(--ct-text-tertiary)]">
          live_read · fetches BTC + hashprice + Telegram + DeFi, computes a seeded
          Monte-Carlo · no write, no send, no deploy
        </span>
        {error ? (
          <span className="text-xs text-[var(--ct-status-danger)]">{error}</span>
        ) : null}
      </div>

      {draft ? (
        <div className="flex flex-col gap-5">
          {/* KPI strip — the headline numbers */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiTile
              label="Headline APY"
              value={`${(draft.quant.headlineRange.low * 100).toFixed(1)}–${(draft.quant.headlineRange.high * 100).toFixed(1)}%`}
            />
            <KpiTile
              label="BTC spot"
              value={`$${Math.round(draft.market.btcUsd).toLocaleString("en-US")}`}
            />
            <KpiTile
              label="Hashprice"
              value={`$${draft.market.hashpriceUsdPerThDay.toFixed(3)}/TH`}
            />
            <KpiTile
              label="P(below floor)"
              value={`${draft.quant.probBelowFloorPct}%`}
            />
          </div>

          {/* Charts — the very-visible artefacts */}
          <div className="grid gap-4 lg:grid-cols-2">
            {fan ? <FanCard chart={fan} disclaimer={draft.disclaimer} /> : null}
            {allocation ? <AllocationCard chart={allocation} /> : null}
          </div>

          {/* Write-up — the rich prose */}
          <div className="rounded-xl border border-[var(--ct-border)] bg-surface-card p-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="ct-section-title">{draft.writeup.title}</h3>
              <span className="ct-bento-label">
                {draft.writeup.llmAuthored ? "LLM-authored" : "deterministic"}
              </span>
            </div>
            <Markdown content={draft.writeup.prose} />
          </div>

          {/* Audit trail — provenance of each swarm */}
          <div className="rounded-xl border border-[var(--ct-border)] bg-surface-card p-4">
            <h3 className="ct-bento-label mb-2">Swarm audit</h3>
            <ul className="flex flex-col gap-1 font-mono text-xs text-[var(--ct-text-secondary)]">
              {draft.audit.map((a) => (
                <li key={a.stageId} className="flex items-center gap-3">
                  <span
                    className={
                      a.degraded
                        ? "text-[var(--ct-status-warning)]"
                        : "text-[var(--ct-accent)]"
                    }
                  >
                    {a.degraded ? "○" : "●"}
                  </span>
                  <span className="w-40 shrink-0">{a.stageId}</span>
                  <span className="w-20 shrink-0">{a.provenance}</span>
                  <span className="text-[var(--ct-text-tertiary)]">
                    {a.reasonCode}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[var(--ct-text-tertiary)]">
              {draft.disclaimer}
            </p>
          </div>

          {/* Raw drawer */}
          <div>
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="text-xs text-[var(--ct-text-muted)] underline-offset-2 hover:underline"
            >
              {showRaw ? "Hide" : "Show"} raw construction JSON
            </button>
            {showRaw ? (
              <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-[var(--ct-border)] bg-surface-page p-3 font-mono text-xs text-[var(--ct-text-muted)]">
                {JSON.stringify(draft, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
