import type { HeroKpi } from "@/lib/data/cockpit";

interface FeedbackRow {
  resolved: boolean;
  itemId: string | null;
}

/**
 * Derives honest KPIs from the feedback list already loaded by the page.
 * No DB queries — pure derivation.
 *
 * Returns [] when there is no feedback (caller suppresses the strip).
 *
 * Provenance:
 * - All cells → "manual" (operator-submitted records, no inference).
 */
export function buildFeedbackKpiStrip(items: FeedbackRow[]): HeroKpi[] {
  if (items.length === 0) return [];

  const total = items.length;
  const resolved = items.filter((i) => i.resolved).length;
  const open = total - resolved;
  const linkedToRoadmap = items.filter((i) => i.itemId !== null).length;

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
