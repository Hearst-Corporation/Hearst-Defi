import type { HeroKpi } from "@/lib/data/cockpit";

/**
 * Whole-table aggregates for /admin/feedback — Prisma count() without take,
 * loaded by the page. The KPI strip is derived from THESE, never from the
 * 100-row window rendered in the log table.
 */
export interface FeedbackAggregates {
  /** COUNT(*) over the whole Feedback table. */
  total: number;
  /** COUNT(*) where resolved = true. */
  resolved: number;
  /** COUNT(*) where itemId IS NOT NULL. */
  linkedToRoadmap: number;
}

/**
 * Derives honest KPIs from whole-table aggregates. Pure presenter — no DB
 * queries here.
 *
 * Returns [] when there is no feedback (caller suppresses the strip).
 *
 * Provenance:
 * - All cells → "manual" (operator-submitted records, no inference). The
 *   provenance travels WITH each cell — the view renders `kpi.provenance`,
 *   never a literal.
 */
export function buildFeedbackKpiStrip(agg: FeedbackAggregates): HeroKpi[] {
  if (agg.total === 0) return [];

  const { total, resolved, linkedToRoadmap } = agg;
  const open = total - resolved;

  const kpis: HeroKpi[] = [
    {
      label: "Total feedback",
      value: String(total),
      sublabel: "submissions on record",
      provenance: "manual",
    },
    {
      label: "Open",
      value: String(open),
      sublabel: "awaiting resolution",
      provenance: "manual",
      alert: open > 0,
    },
    {
      label: "Resolved",
      value: String(resolved),
      sublabel: `${total > 0 ? Math.round((resolved / total) * 100) : 0}% of total`,
      provenance: "manual",
      accent: resolved > 0 && open === 0,
    },
  ];

  if (linkedToRoadmap > 0) {
    kpis.push({
      label: "Roadmap-linked",
      value: String(linkedToRoadmap),
      sublabel: "tied to a roadmap item",
      provenance: "manual",
    });
  }

  return kpis;
}
