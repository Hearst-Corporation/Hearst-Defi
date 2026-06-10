import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { HeroKpi } from "@/lib/data/cockpit";

interface HeroStripProps {
  kpis: HeroKpi[];
}

/**
 * Cockpit Admin — Hero Strip.
 *
 * Renders up to 6 cross-vault KPIs in a horizontal strip.
 * Tokens: --ct-* only. P0 alert cells get a danger tint.
 * Graceful when kpis array is empty.
 */
export function HeroStrip({ kpis }: HeroStripProps) {
  if (kpis.length === 0) {
    return (
      <div
        aria-label="Hero KPIs — no data"
        className="rounded-lg border border-[var(--ct-border-soft)] ct-surface-0 px-6 py-4"
      >
        <p className="body-sm ct-text-faint">No vault data available.</p>
      </div>
    );
  }

  return (
    <div
      aria-label="Cockpit hero KPIs"
      className="grid grid-cols-2 gap-px sm:grid-cols-3 lg:grid-cols-6 rounded-lg overflow-hidden border border-[var(--ct-border-soft)]"
    >
      {kpis.map((kpi) => (
        <HeroKpiCell key={kpi.label} kpi={kpi} />
      ))}
    </div>
  );
}

function HeroKpiCell({ kpi }: { kpi: HeroKpi }) {
  return (
    <div
      className={[
        "flex flex-col gap-1.5 px-5 py-4 glass-panel",
        kpi.alert
          ? "ct-status-danger-bg border-l-2 border-l-[var(--ct-status-danger)]"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={`${kpi.label}: ${kpi.value}`}
    >
      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <span className="stat-label ct-text-muted truncate">{kpi.label}</span>
        <ProvenanceBadge kind={kpi.provenance} />
      </div>

      {/* Value */}
      <span
        className={[
          "stat-value tabular leading-none",
          kpi.alert
            ? "ct-status-danger"
            : "ct-text-strong drop-shadow-[var(--ct-glow-subtle)]",
        ].join(" ")}
      >
        {kpi.value}
      </span>

      {/* Sublabel */}
      <span className="body-xs ct-text-faint truncate">{kpi.sublabel}</span>
    </div>
  );
}
