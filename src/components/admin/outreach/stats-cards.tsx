// Outreach stats row — presentational. Pure (no client interactivity), so it
// renders as a Server Component inside the outreach page. No data fetching here:
// the numbers are computed server-side by computeOutreachStats() and passed in.

import { Card } from "@/components/ui/card";
import type { OutreachStats } from "@/lib/data/outreach";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** rates from the loader are already 0–100 (one decimal). */
function pct(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0%";
  return `${value.toFixed(1)}%`;
}

interface StatDef {
  label: string;
  value: string;
}

/**
 * Five calm stat cards: prospects, sent, open-rate, click-rate, bounce-rate.
 * Rates are formatted as percentages; counts as plain integers. Mirrors the
 * stat-label / tabular-nums conventions used across the admin console.
 */
export function OutreachStatsCards({ stats }: { stats: OutreachStats }) {
  const items: StatDef[] = [
    { label: "Prospects", value: integer.format(stats.totalProspects) },
    { label: "Sent", value: integer.format(stats.emails.sent) },
    { label: "Open rate", value: pct(stats.rates.openRate) },
    { label: "Click rate", value: pct(stats.rates.clickRate) },
    { label: "Bounce rate", value: pct(stats.rates.bounceRate) },
  ];

  return (
    <div className="admin-stat-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label} className="admin-card--tight" hoverOverlay={false}>
          <p className="stat-label">{item.label}</p>
          <p className="mt-[var(--ct-space-1)] stat-value tabular-nums ct-text-strong">{item.value}</p>
        </Card>
      ))}
    </div>
  );
}
