// Admin · Agentic Control Tower — Command Summary KPI strip (presentational).
//
// READ-ONLY. Renders the headline metrics as the CANON admin KPI strip — via
// AdminKpiStripPanel (embedded) so it gets the grey inset surface + centred
// cells + boundary separators, exactly like /admin/customers & /admin/vaults.
// A bare DashboardKpiStrip is transparent + left-aligned (it sat on the card's
// black surface, mis-centred) — that's the bug this replaces. The first tile is
// platform health; the rest are the tower metrics. Attention items (watch/alert)
// stay as tight warning lines below the strip.

import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import type { HeroKpi } from "@/lib/data/cockpit";
import type { TowerSummary, TowerMetric } from "@/lib/agentic/system-map/tower-summary";

const HEALTH_LABEL: Record<TowerSummary["health"], string> = {
  healthy: "All clear",
  watch: "Watch",
  alert: "Needs attention",
  no_data: "Limited data",
};

// Colour discipline mirrors /admin/customers: ONE accent (the key positive)
// + ONE alert (the key risk), everything else neutral white — not one colour
// per metric. So only "autonomous" reads green and only "forbidden" reads red;
// gated/agents/crews/platform stay white.
function metricKpiFlags(id: TowerMetric["id"]): Pick<HeroKpi, "alert" | "accent"> {
  if (id === "autonomous") return { accent: true };
  if (id === "forbidden") return { alert: true };
  return {};
}

export function AgenticStatusLine({
  summary,
}: {
  summary: TowerSummary | null | undefined;
}) {
  if (!summary) return null;
  const { health, metrics, attention } = summary;

  // Canon KPI tiles: platform health first, then each tower metric. sublabel =
  // the metric's one-line meaning; provenance is "manual" (a static registry
  // read), matching the rest of the agentic control tower's read-only posture.
  const kpis: HeroKpi[] = [
    {
      label: "Platform",
      value: HEALTH_LABEL[health],
      sublabel: "overall agentic health",
      provenance: "manual",
      // Platform health stays neutral white unless it's a real alert (red).
      ...(health === "alert" ? { alert: true } : {}),
    },
    ...metrics.map(
      (m): HeroKpi => ({
        label: m.label,
        value: m.value,
        sublabel: m.hint,
        provenance: "manual",
        ...metricKpiFlags(m.id),
      }),
    ),
  ];

  return (
    <div className="flex flex-col" aria-label="Agentic command summary">
      <AdminKpiStripPanel kpis={kpis} embedded />

      {attention.length > 0 && (
        <ul
          className="flex flex-col gap-1 p-5"
          aria-label="Attention items"
        >
          {attention.map((a) => (
            <li
              key={a}
              className="flex items-start gap-2 rounded-sm border-l-2 border-[var(--ct-status-warning)] bg-[var(--ct-status-warning-soft)] px-3 py-1.5 text-[length:var(--ct-text-xs)] text-[var(--ct-text-body)]"
            >
              {a}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
