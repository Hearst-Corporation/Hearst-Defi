/**
 * Projection Report — pure, read-only presentational view.
 *
 * Renders a {@link ProjectionReportArtifact} as a readable product-projection
 * report (not a JSON table). No interactivity, no fetch, no state — a server- or
 * client-rendered function of the artifact. APY is shown only as a range; nothing
 * is framed as guaranteed; provenance and disclaimers are always visible.
 *
 * Scope note: this lot renders the deterministic v0 artifact. The Methodology v2
 * distribution (p5/p50/p95) is intentionally NOT rendered here yet.
 */

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
    <section className={cn("projpv-block ct-glass-panel ct-glass-panel--flat", className)}>
      <header className="projpv-block-head">
        <h3 className="projpv-block-title">{title}</h3>
        {hint ? <span className="projpv-block-hint">{hint}</span> : null}
      </header>
      {children}
    </section>
  );
}

function MissingNote({ label }: { label: string }) {
  return <p className="projpv-missing">Missing input — {label}</p>;
}

/* ── Chart renderers (CSS-only, no chart library, no fabricated data) ─────── */

function RangeBandChart({ data }: { data: unknown }) {
  const d = data as { apy?: { min: number; max: number; unit: string }; horizonMonths?: number };
  if (!d?.apy) return <MissingNote label="no APY range to plot" />;
  const span = Math.max(1, d.apy.max - d.apy.min);
  // Frame the band on a 0..(max*1.5) axis so the bar reads as a proportion.
  const axisMax = Math.max(d.apy.max * 1.5, d.apy.max + 1);
  const left = (d.apy.min / axisMax) * 100;
  const width = (span / axisMax) * 100;
  return (
    <div className="projpv-rangeband" role="img" aria-label={`APY range ${d.apy.min} to ${d.apy.max} percent`}>
      <div className="projpv-rangeband-track">
        <div className="projpv-rangeband-fill" style={{ left: `${left}%`, width: `${width}%` }} />
      </div>
      <div className="projpv-rangeband-scale">
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
    <div className="projpv-alloc">
      <div className="projpv-alloc-bar">
        {rows.map((r, i) => (
          <div
            key={r.label}
            className={cn("projpv-alloc-seg", `projpv-alloc-seg--${(i % 4) + 1}`)}
            style={{ width: `${r.weightPct}%` }}
            title={`${r.label} — ${r.weightPct}%`}
          />
        ))}
      </div>
      <ul className="projpv-alloc-legend">
        {rows.map((r, i) => (
          <li key={r.label}>
            <span className={cn("projpv-alloc-dot", `projpv-alloc-seg--${(i % 4) + 1}`)} />
            <span className="projpv-alloc-label">{r.label}</span>
            <span className="projpv-alloc-weight">{r.weightPct}%</span>
            <span className="projpv-badge projpv-badge--source">{r.source}</span>
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
    <div className="projpv-compare">
      {rows.map((s) => {
        const apy = s.metrics.find((m) => m.range)?.range;
        return (
          <div key={s.id} className="projpv-compare-col">
            <span className="projpv-compare-name">{s.id}</span>
            <span className="projpv-compare-val">{apy ? fmtRange(apy) : "—"}</span>
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
    <div className="projpv" data-testid="projection-report">
      {/* Hero summary */}
      <section className="projpv-hero ct-glass-panel">
        <div className="projpv-hero-top">
          <div className="projpv-hero-id">
            <h2 className="projpv-hero-name">{artifact.product.name}</h2>
            <span className="projpv-badge projpv-badge--type">{artifact.product.type}</span>
            <span className="projpv-badge projpv-badge--version">{artifact.version}</span>
          </div>
          <div className="projpv-hero-flags">
            {previewBadge ? <span className="projpv-badge projpv-badge--preview">Preview input</span> : null}
            <span className="projpv-badge projpv-badge--read">Read-only</span>
            <span className="projpv-badge projpv-badge--ok">No side effects</span>
            <span className="projpv-badge projpv-badge--conf">Confidence: {artifact.confidence}</span>
          </div>
        </div>
        <p className="projpv-hero-summary">{artifact.summary}</p>
      </section>

      {/* Headline metrics */}
      <div className="projpv-metrics">
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
        />
        <MetricCard
          label="Horizon"
          value={`${artifact.horizonMonths} months`}
          missing={null}
        />
      </div>

      {/* Scenarios */}
      <Block title="Scenarios" hint="Conditional framings — not forecasts or targets">
        <div className="projpv-scenarios">
          {artifact.scenarios.map((s) => {
            const apy = s.metrics.find((m) => m.range)?.range;
            return (
              <article key={s.id} className={cn("projpv-scenario", `projpv-scenario--${s.id}`)}>
                <header className="projpv-scenario-head">
                  <span className="projpv-scenario-tag">{s.label}</span>
                  <span className="projpv-scenario-apy">{apy ? fmtRange(apy) : "—"}</span>
                </header>
                <p className="projpv-scenario-desc">{s.description}</p>
              </article>
            );
          })}
        </div>
      </Block>

      {/* Methodology v2 — seeded p5/p50/p95 distribution (read-only) */}
      {artifact.version === "v2" ? <MethodologyV2Section artifact={artifact} /> : null}

      {/* Charts + assumptions */}
      <div className="projpv-row">
        <Block title="Charts" className="projpv-col-grow">
          {renderableCharts.length === 0 ? (
            <MissingNote label="no chart data available for this input" />
          ) : (
            <div className="projpv-charts">
              {renderableCharts.map((c) => (
                <div key={c.id} className="projpv-chart">
                  <span className="projpv-chart-title">{c.title}</span>
                  <ChartRenderer chart={c} />
                </div>
              ))}
            </div>
          )}
        </Block>

        <Block title="Assumptions" className="projpv-col-side">
          {artifact.assumptions.length === 0 ? (
            <MissingNote label="no assumptions provided" />
          ) : (
            <ul className="projpv-assumptions">
              {artifact.assumptions.map((a) => (
                <li key={a.key}>
                  <span className="projpv-assumption-key">{a.key}</span>
                  <span className="projpv-assumption-val">{a.value}</span>
                  <span className="projpv-badge projpv-badge--source">{a.source}</span>
                </li>
              ))}
            </ul>
          )}
        </Block>
      </div>

      {/* Risks + provenance */}
      <div className="projpv-row">
        <Block title="Risks" className="projpv-col-grow">
          <ul className="projpv-risks">
            {artifact.risks.map((r) => (
              <li key={r.id} className="projpv-risk">
                <span className={cn("projpv-sev", `projpv-sev--${r.severity}`)}>{r.severity}</span>
                <div className="projpv-risk-body">
                  <span className="projpv-risk-label">{r.label}</span>
                  <span className="projpv-risk-note">{r.note}</span>
                </div>
              </li>
            ))}
          </ul>
        </Block>

        <Block title="Provenance" className="projpv-col-side">
          <ul className="projpv-provenance">
            {artifact.provenance.map((p) => (
              <li key={p.metricId}>
                <span className="projpv-prov-metric">{p.metricId}</span>
                <span className="projpv-badge projpv-badge--source">{p.source}</span>
              </li>
            ))}
          </ul>
        </Block>
      </div>

      {/* Missing inputs */}
      {artifact.missingInputs.length > 0 ? (
        <Block title="Missing inputs" hint="Surfaced, never fabricated">
          <ul className="projpv-missing-list">
            {artifact.missingInputs.map((m) => (
              <li key={m} className="projpv-badge projpv-badge--missing">{m}</li>
            ))}
          </ul>
        </Block>
      ) : null}

      {/* Disclaimers */}
      <section className="projpv-disclaimers">
        {artifact.disclaimers.map((d) => (
          <p key={d} className="projpv-disclaimer">{d}</p>
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
    <div className={cn("projpv-metric ct-glass-panel ct-glass-panel--flat", accent && "projpv-metric--accent")}>
      <span className="projpv-metric-label">{label}</span>
      {value ? (
        <span className="projpv-metric-value">{value}</span>
      ) : (
        <span className="projpv-metric-missing">{missing ?? "—"}</span>
      )}
      {provenance ? <span className="projpv-metric-prov">{provenance}</span> : null}
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
    <section className="projpv-v2 ct-glass-panel">
      <header className="projpv-v2-head">
        <div className="projpv-v2-title">
          <h3 className="projpv-block-title">Methodology v2</h3>
          <span className="projpv-block-hint">Seeded scenario distribution — p5 / p50 / p95</span>
        </div>
        <div className="projpv-v2-meta">
          <span className="projpv-badge projpv-badge--source">seed: {method.seed}</span>
          <span className="projpv-badge projpv-badge--source">iterations: {method.iterations}</span>
          <span className="projpv-badge projpv-badge--source">{method.model}</span>
        </div>
      </header>

      <div className="projpv-v2-percentiles">
        <PercentileCard label="p5" caption="Low band" pct={p5.apyPct} yieldVal={p5.projectedYield} />
        <PercentileCard label="p50" caption="Median scenario" pct={p50.apyPct} yieldVal={p50.projectedYield} accent />
        <PercentileCard label="p95" caption="High band" pct={p95.apyPct} yieldVal={p95.projectedYield} />
      </div>

      <p className="projpv-v2-note">
        p50 is the median of a conditional distribution under the stated assumptions — it is not an
        expected return or a target. p5 and p95 frame a projection band, not a fixed outcome.
      </p>

      <PercentileBand bands={dist.bands} />

      {dist.methodology.limitations.length > 0 ? (
        <ul className="projpv-v2-limits">
          {dist.methodology.limitations.map((l) => (
            <li key={l} className="projpv-v2-limit">{l}</li>
          ))}
        </ul>
      ) : null}
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
    <div className={cn("projpv-pcard", accent && "projpv-pcard--accent")}>
      <span className="projpv-pcard-label">{label}</span>
      <span className="projpv-pcard-caption">{caption}</span>
      <span className="projpv-pcard-apy">{Number.isFinite(pct) ? `${fmtNum(pct)}%` : "—"}</span>
      {yieldVal ? (
        <span className="projpv-pcard-yield">
          {fmtNum(yieldVal.value)} {yieldVal.unit}
        </span>
      ) : null}
    </div>
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
      className="projpv-band"
      role="img"
      aria-label={`Projection band over ${last.horizonMonth} months: p5 ${fmtNum(finite[0]!.p5)} to p95 ${fmtNum(last.p95)} ${unit}`}
    >
      <div className="projpv-band-plot">
        {finite.map((b, i) => (
          <div className="projpv-band-col" key={b.horizonMonth} title={`m${b.horizonMonth}: p5 ${fmtNum(b.p5)} · p50 ${fmtNum(b.p50)} · p95 ${fmtNum(b.p95)} ${unit}`}>
            <div className="projpv-band-track">
              <div
                className="projpv-band-fill"
                style={{ bottom: pos(b.p5), top: `calc(100% - ${pos(b.p95)})` }}
              />
              <div className="projpv-band-median" style={{ bottom: pos(b.p50) }} />
            </div>
            <span className="projpv-band-x">{i % labelEvery === 0 || i === finite.length - 1 ? `${b.horizonMonth}m` : ""}</span>
          </div>
        ))}
      </div>
      <figcaption className="projpv-band-legend">
        <span className="projpv-band-key projpv-band-key--band">p5–p95 band</span>
        <span className="projpv-band-key projpv-band-key--median">p50 median</span>
        <span className="projpv-band-axis">axis 0 – {fmtNum(axisMax)} {unit}</span>
      </figcaption>
    </figure>
  );
}
