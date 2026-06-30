/**
 * Projection Report — pure, read-only presentational view.
 *
 * Renders a {@link ProjectionReportArtifact} as a readable product-projection
 * report (not a JSON table). No interactivity, no fetch, no state — a server- or
 * client-rendered function of the artifact. APY is shown only as a range; nothing
 * is framed as guaranteed; provenance and disclaimers are always visible.
 *
 * Bento Tailwind (Portfolio canon): graphite-opaque panels, neutral borders
 * everywhere, single green accent (#A7FB90) reserved for emphasised VALUES/text —
 * never as a tile/scenario border.
 *
 * Scope note: this lot renders the deterministic v0 artifact. The Methodology v2
 * distribution (p5/p50/p95) is intentionally NOT rendered here yet.
 */

import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { cn } from "@/lib/cn";
import type {
  ProjectionReportArtifact,
  ProjectionChart,
  ProjectionDistribution,
} from "@/lib/agentic/product-projection";

function fmtRange(r?: { min: number; max: number; unit: string }): string | null {
  if (!r) return null;
  return `${r.min}–${r.max}${r.unit === "%" ? "%" : ` ${r.unit}`}`;
}

const PANEL = "rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col";
const SUBTILE = "rounded-xl border border-[var(--ct-border)] bg-surface-inset";

function Block({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(PANEL, className)}>
      <header className="flex items-end justify-between gap-3 p-5 border-b border-[var(--ct-border-soft)]">
        <h3 className="ct-bento-label leading-none">{title}</h3>
        {hint ? <span className="ct-metric-caption text-right">{hint}</span> : null}
      </header>
      <div className="p-5 flex flex-col gap-4 min-w-0">{children}</div>
    </section>
  );
}

function MissingNote({ label }: { label: string }) {
  return <p className="ct-metric-caption m-0 text-[var(--ct-status-warning)]">Missing input — {label}</p>;
}

function SourceChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="ct-bento-label inline-flex items-center rounded-full border border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] px-2 py-0.5 font-mono whitespace-nowrap">
      {children}
    </span>
  );
}

/* ── Chart renderers (CSS-only, no chart library, no fabricated data) ─────── */
// Accent segment fills — single green via color-mix tints, last bucket neutral.
const SEG_FILLS = [
  "bg-[var(--ct-accent)]",
  "bg-[color-mix(in_srgb,var(--ct-accent)_70%,transparent)]",
  "bg-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)]",
  "bg-[color-mix(in_srgb,var(--ct-text-strong)_20%,transparent)]",
] as const;
const DOT_FILLS = SEG_FILLS;

function RangeBandChart({ data }: { data: unknown }) {
  const d = data as { apy?: { min: number; max: number; unit: string }; horizonMonths?: number };
  if (!d?.apy) return <MissingNote label="no APY range to plot" />;
  const span = Math.max(1, d.apy.max - d.apy.min);
  // Frame the band on a 0..(max*1.5) axis so the bar reads as a proportion.
  const axisMax = Math.max(d.apy.max * 1.5, d.apy.max + 1);
  const left = (d.apy.min / axisMax) * 100;
  const width = (span / axisMax) * 100;
  return (
    <div
      className="flex flex-col gap-1.5"
      role="img"
      aria-label={`APY range ${d.apy.min} to ${d.apy.max} percent`}
    >
      <div className="relative h-2.5 rounded-full bg-surface-inset border border-[var(--ct-border-soft)] overflow-hidden">
        <div
          className="absolute top-0 bottom-0 bg-[var(--ct-accent)] rounded-full"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </div>
      <div className="ct-metric-caption flex justify-between font-mono">
        <span>{d.apy.min}%</span>
        <span>{d.apy.max}%</span>
      </div>
    </div>
  );
}

function AllocationMixChart({ data }: { data: unknown }) {
  const rows = Array.isArray(data)
    ? (data as Array<{ label: string; weightPct: number; source: string }>)
    : [];
  if (rows.length === 0) return <MissingNote label="no allocation provided" />;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 rounded-full overflow-hidden bg-surface-inset border border-[var(--ct-border-soft)]">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={cn("h-full", SEG_FILLS[i % SEG_FILLS.length])}
            style={{ width: `${r.weightPct}%` }}
            title={`${r.label} — ${r.weightPct}%`}
          />
        ))}
      </div>
      <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
        {rows.map((r, i) => (
          <li key={r.label} className="ct-metric-caption flex items-center gap-2">
            <span className={cn("size-2 rounded-full flex-none", DOT_FILLS[i % DOT_FILLS.length])} />
            <span className="flex-1 min-w-0">{r.label}</span>
            <span className="ct-metric-value font-mono">{r.weightPct}%</span>
            <SourceChip>{r.source}</SourceChip>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScenarioCompareChart({ data }: { data: unknown }) {
  const rows = Array.isArray(data)
    ? (data as Array<{ id: string; metrics: Array<{ label: string; range?: { min: number; max: number; unit: string }; value?: string }> }>)
    : [];
  if (rows.length === 0) return <MissingNote label="no scenarios to compare" />;
  return (
    <div className="flex gap-3">
      {rows.map((s) => {
        const apy = s.metrics.find((m) => m.range)?.range;
        return (
          <div
            key={s.id}
            className={cn(SUBTILE, "flex-1 flex flex-col gap-1 p-3 text-center")}
          >
            <span className="ct-bento-label">{s.id}</span>
            <span className="ct-metric-value font-medium text-[var(--ct-accent)]">{apy ? fmtRange(apy) : "—"}</span>
          </div>
        );
      })}
    </div>
  );
}

function ChartRenderer({ chart }: { chart: ProjectionChart }) {
  switch (chart.type) {
    case "range_band":
      return <RangeBandChart data={chart.data} />;
    case "allocation_mix":
      return <AllocationMixChart data={chart.data} />;
    case "scenario_compare":
      return <ScenarioCompareChart data={chart.data} />;
    default:
      // percentile_band (Methodology v2) is not rendered in this lot.
      return <MissingNote label={`${chart.type} not rendered yet`} />;
  }
}

/* ── Main view ────────────────────────────────────────────────────────────── */

export function ProjectionReportView({
  artifact,
  previewBadge = true,
}: {
  artifact: ProjectionReportArtifact;
  previewBadge?: boolean;
}) {
  const apyMetric = artifact.metrics.find((m) => m.id === "target_apy");
  const capitalMetric = artifact.metrics.find((m) => m.id === "capital_base");
  const yieldMetric = artifact.metrics.find((m) => m.id === "projected_yield");
  const renderableCharts = artifact.charts.filter((c) => c.type !== "percentile_band");

  return (
    <div className="flex flex-col gap-4 min-w-0" data-testid="projection-report">
      {/* Hero summary */}
      <section className={cn(PANEL, "gap-3 p-5")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h2 className="ct-section-title m-0">{artifact.product.name}</h2>
            <Badge variant="default" className="font-mono normal-case tracking-normal">{artifact.product.type}</Badge>
            <Badge variant="default" className="font-mono normal-case tracking-normal">{artifact.version}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {previewBadge ? <Badge variant="accent">Preview input</Badge> : null}
            <Badge variant="accent">Read-only</Badge>
            <Badge variant="accent">No side effects</Badge>
            <Badge variant="default">Confidence: {artifact.confidence}</Badge>
          </div>
        </div>
        <p className="ct-metric-caption m-0 max-w-[80ch]">{artifact.summary}</p>
      </section>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Capital base"
          value={capitalMetric?.value ?? null}
          missing={capitalMetric ? null : "capitalBase not provided"}
          provenance={capitalMetric?.provenance}
        />
        <MetricCard
          label="Target APY"
          value={fmtRange(apyMetric?.range)}
          missing={apyMetric?.range ? null : "apyRange not provided"}
          provenance={apyMetric?.provenance}
          accent
        />
        <MetricCard
          label="Projected yield"
          value={fmtRange(yieldMetric?.range)}
          missing={yieldMetric?.range ? null : "needs apyRange + capitalBase"}
          provenance={yieldMetric?.provenance}
          accent
        />
        <MetricCard
          label="Horizon"
          value={`${artifact.horizonMonths} months`}
          missing={null}
        />
      </div>

      {/* Scenarios */}
      <Block title="Scenarios" hint="Conditional framings — not forecasts or targets">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {artifact.scenarios.map((s) => {
            const apy = s.metrics.find((m) => m.range)?.range;
            return (
              <article key={s.id} className={cn(SUBTILE, "flex flex-col gap-2 p-4")}>
                <header className="flex items-baseline justify-between gap-2">
                  <span className="ct-bento-label">{s.label}</span>
                  <span className="ct-metric-value font-medium text-[var(--ct-accent)]">{apy ? fmtRange(apy) : "—"}</span>
                </header>
                <p className="ct-metric-caption m-0">{s.description}</p>
              </article>
            );
          })}
        </div>
      </Block>

      {/* Methodology v2 — seeded p5/p50/p95 distribution (read-only) */}
      {artifact.version === "v2" ? <MethodologyV2Section artifact={artifact} /> : null}

      {/* Charts + assumptions */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <Block title="Charts">
          {renderableCharts.length === 0 ? (
            <MissingNote label="no chart data available for this input" />
          ) : (
            <div className="flex flex-col gap-5">
              {renderableCharts.map((c) => (
                <div key={c.id} className="flex flex-col gap-2">
                  <span className="ct-metric-caption">{c.title}</span>
                  <ChartRenderer chart={c} />
                </div>
              ))}
            </div>
          )}
        </Block>

        <Block title="Assumptions">
          {artifact.assumptions.length === 0 ? (
            <MissingNote label="no assumptions provided" />
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-2">
              {artifact.assumptions.map((a) => (
                <li key={a.key} className="ct-metric-caption flex items-center gap-2">
                  <span className="ct-metric-value min-w-0 font-mono">{a.key}</span>
                  <span className="flex-1 min-w-0">{a.value}</span>
                  <SourceChip>{a.source}</SourceChip>
                </li>
              ))}
            </ul>
          )}
        </Block>
      </div>

      {/* Risks + provenance */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <Block title="Risks">
          <ul className="list-none m-0 p-0 flex flex-col gap-3">
            {artifact.risks.map((r) => (
              <li key={r.id} className="flex gap-3 items-start">
                <SeverityChip severity={r.severity} />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="ct-metric-value">{r.label}</span>
                  <span className="ct-metric-caption">{r.note}</span>
                </div>
              </li>
            ))}
          </ul>
        </Block>

        <Block title="Provenance">
          <ul className="list-none m-0 p-0 flex flex-col gap-2">
            {artifact.provenance.map((p) => (
              <li key={p.metricId} className="ct-metric-caption flex items-center gap-2">
                <span className="ct-metric-value min-w-0 font-mono">{p.metricId}</span>
                <SourceChip>{p.source}</SourceChip>
              </li>
            ))}
          </ul>
        </Block>
      </div>

      {/* Missing inputs */}
      {artifact.missingInputs.length > 0 ? (
        <Block title="Missing inputs" hint="Surfaced, never fabricated">
          <ul className="list-none m-0 p-0 flex flex-row flex-wrap gap-2">
            {artifact.missingInputs.map((m) => (
              <li key={m}>
                <Badge variant="warning" className="font-mono normal-case tracking-normal">{m}</Badge>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {/* Disclaimers */}
      <section className="rounded-xl border border-[var(--ct-border)] bg-surface-inset p-4 flex flex-col gap-1.5">
        {artifact.disclaimers.map((d) => (
          <p key={d} className="ct-metric-caption m-0">{d}</p>
        ))}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  missing,
  provenance,
  accent,
}: {
  label: string;
  value: string | null;
  missing: string | null;
  provenance?: string;
  accent?: boolean;
}) {
  return (
    <div className={cn(SUBTILE, "flex flex-col gap-2 p-5 min-w-0")}>
      <span className="ct-bento-label">{label}</span>
      {value ? (
        <span className={cn("text-[length:var(--ct-text-xl-fixed)] font-medium tabular-nums leading-none", accent ? "text-[var(--ct-accent)]" : "text-[var(--ct-text-strong)]")}>
          {value}
        </span>
      ) : (
        <span className="ct-metric-caption text-[var(--ct-status-warning)]">{missing ?? "—"}</span>
      )}
      {provenance ? <span className="ct-bento-label font-mono normal-case">{provenance}</span> : null}
    </div>
  );
}

/* ── Methodology v2 (seeded p5/p50/p95) ───────────────────────────────────── */

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function MethodologyV2Section({ artifact }: { artifact: ProjectionReportArtifact }) {
  const dist = artifact.distribution;
  const method = artifact.methodology;

  // v2 requested but no distribution (e.g. apyRange missing): surface, don't fake.
  if (!dist || !method) {
    return (
      <Block title="Methodology v2" hint="Seeded scenario distribution">
        <MissingNote label="no distribution available for this input (needs an APY range)" />
      </Block>
    );
  }

  const { p5, p50, p95 } = dist.percentiles;
  return (
    <section className={PANEL}>
      <header className="flex flex-wrap items-start justify-between gap-3 p-5 border-b border-[var(--ct-border-soft)]">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="ct-bento-label leading-none">Methodology v2</h3>
          <span className="ct-metric-caption">Seeded scenario distribution — p5 / p50 / p95</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <SourceChip>seed: {method.seed}</SourceChip>
          <SourceChip>iterations: {method.iterations}</SourceChip>
          <SourceChip>{method.model}</SourceChip>
        </div>
      </header>

      <div className="p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PercentileCard label="p5" caption="Low band" pct={p5.apyPct} yieldVal={p5.projectedYield} />
          <PercentileCard label="p50" caption="Median scenario" pct={p50.apyPct} yieldVal={p50.projectedYield} accent />
          <PercentileCard label="p95" caption="High band" pct={p95.apyPct} yieldVal={p95.projectedYield} />
        </div>

        <p className="ct-metric-caption m-0 max-w-[80ch]">
          p50 is the median of a conditional distribution under the stated assumptions — it is not an
          expected return or a target. p5 and p95 frame a projection band, not a fixed outcome.
        </p>

        <PercentileBand bands={dist.bands} />

        {dist.methodology.limitations.length > 0 ? (
          <ul className="list-none m-0 p-0 flex flex-col gap-1">
            {dist.methodology.limitations.map((l) => (
              <li key={l} className="ct-metric-caption relative pl-3 before:content-['—'] before:absolute before:left-0 before:text-[var(--ct-text-muted)]">
                {l}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function PercentileCard({
  label,
  caption,
  pct,
  yieldVal,
  accent,
}: {
  label: string;
  caption: string;
  pct: number;
  yieldVal?: { value: number; unit: string };
  accent?: boolean;
}) {
  return (
    <div className={cn(SUBTILE, "flex flex-col gap-1 p-4")}>
      <span className="ct-bento-label font-mono">{label}</span>
      <span className="ct-metric-caption">{caption}</span>
      <span className={cn("text-[length:var(--ct-text-xl-fixed)] font-medium tabular-nums leading-none", accent ? "text-[var(--ct-accent)]" : "text-[var(--ct-text-strong)]")}>
        {Number.isFinite(pct) ? `${fmtNum(pct)}%` : "—"}
      </span>
      {yieldVal ? (
        <span className="ct-metric-caption font-mono">
          {fmtNum(yieldVal.value)} {yieldVal.unit}
        </span>
      ) : null}
    </div>
  );
}

function SeverityChip({ severity }: { severity: "low" | "medium" | "high" }) {
  const tone =
    severity === "high"
      ? "border-[color-mix(in_srgb,var(--ct-status-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-status-danger)_10%,transparent)] text-[var(--ct-status-danger)]"
      : severity === "medium"
        ? "border-[color-mix(in_srgb,var(--ct-status-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-status-warning)_10%,transparent)] text-[var(--ct-status-warning)]"
        : "border-[var(--ct-border)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] text-[var(--ct-text-muted)]";
  return (
    <span
      className={cn(
        "ct-bento-label inline-flex items-center rounded-full border px-2 py-0.5 leading-none flex-none",
        tone,
      )}
    >
      {severity}
    </span>
  );
}

function PercentileBand({ bands }: { bands: ProjectionDistribution["bands"] }) {
  const finite = bands.filter(
    (b) =>
      Number.isFinite(b.p5) &&
      Number.isFinite(b.p50) &&
      Number.isFinite(b.p95) &&
      Number.isFinite(b.horizonMonth),
  );
  const axisMax = finite.reduce((m, b) => Math.max(m, b.p95), 0);
  if (finite.length === 0 || axisMax <= 0) {
    return <MissingNote label="no percentile band data to plot" />;
  }
  const unit = finite[0]?.unit ?? "";
  const last = finite[finite.length - 1]!;
  const labelEvery = Math.max(1, Math.ceil(finite.length / 6));
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / axisMax) * 100))}%`;

  return (
    <figure
      className="m-0 flex flex-col gap-2"
      role="img"
      aria-label={`Projection band over ${last.horizonMonth} months: p5 ${fmtNum(finite[0]!.p5)} to p95 ${fmtNum(last.p95)} ${unit}`}
    >
      <div className="flex items-end gap-1 h-[132px] pt-2">
        {finite.map((b, i) => (
          <div
            className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full"
            key={b.horizonMonth}
            title={`m${b.horizonMonth}: p5 ${fmtNum(b.p5)} · p50 ${fmtNum(b.p50)} · p95 ${fmtNum(b.p95)} ${unit}`}
          >
            <div className="relative w-full max-w-[18px] flex-1 rounded-sm bg-surface-inset border border-[var(--ct-border-soft)]">
              <div
                className="absolute left-0 right-0 rounded-sm bg-[color-mix(in_srgb,var(--ct-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)]"
                style={{ bottom: pos(b.p5), top: `calc(100% - ${pos(b.p95)})` }}
              />
              <div className="absolute -left-px -right-px h-0.5 bg-[var(--ct-accent)]" style={{ bottom: pos(b.p50) }} />
            </div>
            <span className="ct-metric-caption font-mono h-3">
              {i % labelEvery === 0 || i === finite.length - 1 ? `${b.horizonMonth}m` : ""}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="ct-metric-caption flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[color-mix(in_srgb,var(--ct-accent)_15%,transparent)] border border-[color-mix(in_srgb,var(--ct-accent)_30%,transparent)]" />
          p5–p95 band
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-[var(--ct-accent)]" />
          p50 median
        </span>
        <span className="font-mono">axis 0 – {fmtNum(axisMax)} {unit}</span>
      </figcaption>
    </figure>
  );
}
