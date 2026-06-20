/**
 * ValueChart — recodé from scratch (2026-06-21).
 *
 * Courbe Portfolio Value, dark-only, tokens --ct-*. Aucune dépendance nouvelle :
 * tout le helper géométrique vit dans ce fichier (pas de module src/lib créé).
 *
 * Contrat de props IDENTIQUE à l'ancien value-chart.tsx (drop-in). Classes CSS
 * réutilisées telles quelles (pf-value-chart*, pf-vc-*). Le bug "11 mois plats +
 * saut terminal" est corrigé en amont dans buildPortfolioValueSeries (fenêtre
 * depuis le premier dépôt) — ce composant n'a plus à le compenser.
 *
 * Pour activer : remplacer le contenu de value-chart.tsx par celui-ci (ou
 * renommer ce fichier). Rien d'autre à toucher.
 */
import { useId } from "react";

import { ChartDisclaimerUnderlay } from "@/components/ui/chart-disclaimer-underlay";
import { ChartProvenanceCorner } from "@/components/ui/chart-provenance-corner";
import { type Provenance } from "@/components/ui/provenance-badge";
import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import { cn } from "@/lib/cn";
import type { PortfolioPosition } from "@/lib/data/portfolio";
import {
  buildIndicativeValueSeries,
  buildPortfolioValueSeries,
  type PortfolioValuePoint,
  type ValueSeriesTx,
} from "@/lib/portfolio/value-series";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { formatUsdCompact, formatUsdFull } from "@/lib/vaults/product-display";

/* ──────────────────────────────────────────────────────────────────────────
 * Geometry — viewBox 16:5, plot helpers. svg-geometry: viewBox + stroke/r sont
 * le seul endroit où des nombres bruts sont autorisés (pas de token CSS en SVG).
 * ────────────────────────────────────────────────────────────────────────── */
const VB_W = 200;
const VB_H = 62;
const PAD_Y = 5;

type Pt = { x: number; y: number };

/** Map values → SVG coords. Single point is centered; flat series stay mid-band. */
function project(values: number[]): Pt[] {
  const n = values.length;
  if (n === 0) return [];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const yLo = lo === hi ? lo - 1 : lo;
  const yHi = lo === hi ? hi + 1 : hi;
  const span = yHi - yLo || 1;
  const innerH = VB_H - PAD_Y * 2;
  return values.map((v, i) => ({
    x: n === 1 ? VB_W / 2 : (i / (n - 1)) * VB_W,
    y: PAD_Y + innerH - ((v - yLo) / span) * innerH,
  }));
}

/** Catmull-Rom → cubic Bézier : courbe lissée premium au lieu d'une polyline. */
function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  const d: string[] = [`M ${pts[0]!.x.toFixed(2)} ${pts[0]!.y.toFixed(2)}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d.push(
      `C ${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    );
  }
  return d.join(" ");
}

/** Ferme le tracé en zone (line → bas-droit → bas-gauche → close). */
function areaFromLine(linePath: string, pts: Pt[]): string {
  const last = pts[pts.length - 1];
  if (!last || !linePath) return "";
  return `${linePath} L ${last.x.toFixed(2)} ${VB_H} L ${pts[0]!.x.toFixed(2)} ${VB_H} Z`;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Series resolution — ledger anchors si dispo, sinon courbe indicative linéaire.
 * En zero-state (aucune position) : courbe PREVIEW ascendante, honnêtement
 * étiquetée (pas de faux badge Live) — un panneau vivant plutôt qu'une ligne
 * plate morte.
 * ────────────────────────────────────────────────────────────────────────── */
type SeriesMode = "ledger" | "indicative" | "preview";

const PREVIEW_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Courbe indicative de démarrage (250k → ~277k, ~11% APY sur 12 mois).
 *  Pur preview, JAMAIS de la vraie data — affichée sous chip "Preview". */
function buildPreviewSeries(asOf: Date): PortfolioValuePoint[] {
  const base = 250_000;
  const end = 277_500;
  const out: PortfolioValuePoint[] = [];
  for (let i = 0; i < 12; i++) {
    const m = new Date(
      Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() - 11 + i, 1),
    );
    const t = i / 11;
    const wave = Math.sin(i * 1.1) * 1_200; // micro-ondulation premium
    out.push({
      label: PREVIEW_MONTHS[m.getUTCMonth() % 12] ?? "",
      value: Math.round(base + (end - base) * t + wave),
      isDistribution: false,
    });
  }
  return out;
}

function resolveSeries(
  positions: PortfolioPosition[],
  totalValueUsdc: number,
  txs: ValueSeriesTx[],
  asOf: Date,
): { points: PortfolioValuePoint[]; mode: SeriesMode } {
  if (txs.length > 0) {
    return {
      points: buildPortfolioValueSeries(txs, totalValueUsdc, asOf),
      mode: "ledger",
    };
  }
  const startValue =
    positions.reduce((s, p) => s + p.principalUsdc, 0) || totalValueUsdc;
  const endValue = totalValueUsdc > 0 ? totalValueUsdc : startValue;
  return {
    points: buildIndicativeValueSeries(startValue, endValue, asOf),
    mode: "indicative",
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Dot overlay — distributions + endcap, positionnés en % pour l'overlay HTML.
 * ────────────────────────────────────────────────────────────────────────── */
type Dot = { leftPct: number; topPct: number; isEndcap?: boolean };

function buildDots(series: PortfolioValuePoint[], pts: Pt[]): Dot[] {
  const dots: Dot[] = [];
  pts.forEach((p, i) => {
    if (series[i]?.isDistribution) {
      dots.push({ leftPct: (p.x / VB_W) * 100, topPct: (p.y / VB_H) * 100 });
    }
  });
  const last = pts[pts.length - 1];
  if (last) {
    dots.push({
      leftPct: (last.x / VB_W) * 100,
      topPct: (last.y / VB_H) * 100,
      isEndcap: true,
    });
  }
  return dots;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Pure SVG plot.
 * ────────────────────────────────────────────────────────────────────────── */
interface PlotProps {
  series: PortfolioValuePoint[];
  /** Pas de fond/area — ligne seule (placeholder $0). */
  lineOnly?: boolean;
}

function Plot({ series, lineOnly = false }: PlotProps) {
  // ids uniques par instance — SSR-safe (useId marche en RSC), évite les
  // collisions <defs> si plusieurs ValueChart coexistent sur le document.
  const uid = useId();
  const titleId = `${uid}-t`;
  const descId = `${uid}-d`;
  const areaId = `${uid}-a`;

  const pts = project(series.map((d) => d.value));
  const linePath = smoothPath(pts);
  const areaPath = lineOnly ? "" : areaFromLine(linePath, pts);
  const last = pts[pts.length - 1];

  const distCount = series.filter((s) => s.isDistribution).length;
  const summary =
    series.length === 0
      ? "Placeholder portfolio value chart — awaiting first position."
      : `Portfolio value over the trailing window, ${distCount} monthly distribution markers.`;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="w-full h-full"
      preserveAspectRatio="none"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>Portfolio Value — trailing trend</title>
      <desc id={descId}>{summary}</desc>

      <defs>
        <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor="var(--ct-accent)"
            style={{ stopOpacity: "var(--ct-opacity-8)" }}
          />
          <stop
            offset="100%"
            stopColor="var(--ct-accent)"
            style={{ stopOpacity: "var(--ct-opacity-0, 0)" }}
          />
        </linearGradient>
      </defs>

      <g className="pf-vc-grid" aria-hidden="true">
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={`h-${f}`}
            x1="0"
            x2={VB_W}
            y1={(VB_H * f).toFixed(1)}
            y2={(VB_H * f).toFixed(1)}
          />
        ))}
        {[0.2, 0.4, 0.6, 0.8].map((f) => (
          <line
            key={`v-${f}`}
            y1="0"
            y2={VB_H}
            x1={(VB_W * f).toFixed(1)}
            x2={(VB_W * f).toFixed(1)}
          />
        ))}
        <line
          className="pf-vc-axis"
          x1="0"
          x2={VB_W}
          y1={VB_H - 0.5}
          y2={VB_H - 0.5}
        />
      </g>

      {areaPath ? (
        <path d={areaPath} fill={`url(#${areaId})`} aria-hidden="true" />
      ) : null}

      {linePath ? (
        <path
          d={linePath}
          fill="none"
          stroke="var(--ct-accent)"
          strokeWidth="1.15"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          opacity={lineOnly ? "var(--ct-opacity-70)" : undefined}
          aria-hidden="true"
          style={{
            strokeDasharray: 1000,
            strokeDashoffset: 1000,
            animation: "pf-line-draw 1.6s var(--ct-ease) forwards",
          }}
        />
      ) : null}

      {last ? (
        <circle
          cx={last.x.toFixed(2)}
          cy={last.y.toFixed(2)}
          r="1.6"
          className="pf-vc-endpoint"
          aria-hidden="true"
        />
      ) : null}
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Public component.
 * ────────────────────────────────────────────────────────────────────────── */
interface ValueChartProps {
  positions: PortfolioPosition[];
  totalValueUsdc: number;
  valueChartTransactions?: ValueSeriesTx[];
  source: "live" | "fallback";
  updatedAt?: Date;
  embedded?: boolean;
}

export function ValueChart({
  positions,
  totalValueUsdc,
  valueChartTransactions = [],
  source,
  updatedAt,
  embedded = false,
}: ValueChartProps) {
  const asOf = updatedAt ?? new Date();
  const isEmpty = totalValueUsdc === 0 && positions.length === 0;

  // Zero-state → courbe PREVIEW (honnête, sous chip "Preview", pas de badge Live).
  const { points: series, mode } = isEmpty
    ? { points: buildPreviewSeries(asOf), mode: "preview" as const }
    : resolveSeries(positions, totalValueUsdc, valueChartTransactions, asOf);

  const provenance: Provenance | undefined = isEmpty
    ? undefined
    : resolveProvenance(
        source,
        updatedAt,
        mode === "ledger" ? "live" : "estimated",
      );

  const chartValue = isEmpty ? 0 : totalValueUsdc;
  const pts = project(series.map((d) => d.value));
  // Pas de dots de distribution en preview ; juste l'endcap pour ancrer l'œil.
  const dots = buildDots(series, pts);

  return (
    <PfCockpitPanel
      variant="wide"
      chrome={embedded ? "embedded" : "panel"}
      aria-label={
        isEmpty
          ? "Portfolio value — awaiting first position"
          : "Portfolio value — trailing trend"
      }
      className={cn(
        "relative pf-value-chart",
        embedded && "pf-value-chart--hero-embedded",
      )}
    >
      {provenance ? <ChartProvenanceCorner kind={provenance} /> : null}

      {embedded ? (
        <header className="pf-cockpit-panel__header">
          <div className="pf-cockpit-panel__header-main min-w-0">
            <h3 className="pf-cockpit-panel__title--primary">Portfolio value</h3>
            {isEmpty ? (
              <p className="pf-cockpit-panel__subtitle body-xs ct-text-faint m-0 mono">
                Preview · indicative curve
              </p>
            ) : (
              <p className="pf-hero-kpi-block m-0">
                <span className="pf-hero-kpi-value tabular-nums">
                  {formatUsdFull(chartValue)}
                </span>
              </p>
            )}
          </div>
          {isEmpty ? <span className="pf-chip-accent">Preview</span> : null}
        </header>
      ) : (
        <PfCockpitPanelHeader
          title="Portfolio value over the trailing window"
          subtitle={
            isEmpty
              ? "Preview · indicative curve"
              : mode === "ledger"
                ? "Ledger-anchored · month-end marks"
                : "Indicative · principal to current value"
          }
          titleVariant="primary"
          trailing={
            isEmpty ? (
              <span className="pf-chip-accent">Preview</span>
            ) : (
              <span className="pf-hero-kpi-value tabular-nums">
                {formatUsdCompact(chartValue)}
              </span>
            )
          }
        />
      )}

      <div className="pf-value-chart__chart-wrapper pf-value-chart__plot">
        {isEmpty ? null : <ChartDisclaimerUnderlay />}
        <Plot series={series} lineOnly={false} />
        {dots.length > 0 ? (
          <div className="pf-vc-dots" aria-hidden="true">
            {dots.map((dot, i) => (
              <span
                key={i}
                className={cn("pf-vc-dot", dot.isEndcap && "pf-vc-dot--endcap")}
                style={{
                  left: `${dot.leftPct.toFixed(3)}%`,
                  top: `${dot.topPct.toFixed(3)}%`,
                }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div
        className="stat-label ct-text-muted relative mono pf-value-chart__month-labels"
        style={{ height: "1.5em" }}
      >
        {series.map((s, i) => {
          if (i % 3 !== 0 && i !== series.length - 1) return null;
          const pct =
            series.length === 1 ? 50 : (i / (series.length - 1)) * 100;
          let transform = "translateX(-50%)";
          if (i === 0) transform = "none";
          if (i === series.length - 1 && series.length > 1)
            transform = "translateX(-100%)";
          return (
            <span
              key={i}
              className="absolute top-0"
              style={{ left: `${pct}%`, transform }}
            >
              {s.label}
            </span>
          );
        })}
      </div>

      {isEmpty ? (
        <p className="body-xs ct-text-muted italic pf-value-chart__disclaimer">
          Placeholder chart until your first confirmed position.
        </p>
      ) : (
        <p className="body-xs ct-text-muted italic pf-value-chart__disclaimer">
          {mode === "ledger"
            ? "Month-end values interpolate between your deposit and payout ledger entries and the current live mark. Not guaranteed."
            : "Indicative path from subscribed principal to current value until ledger history is available. Not guaranteed."}
        </p>
      )}
    </PfCockpitPanel>
  );
}
