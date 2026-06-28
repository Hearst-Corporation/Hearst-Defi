// Outreach stats row — presentational. Pure (no client interactivity), so it
// renders as a Server Component inside the outreach page. No data fetching here:
// the numbers are computed server-side by computeOutreachStats() and passed in.

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
 * Calm engagement stat cards: sent, open-rate, click-rate, bounce-rate.
 * `Prospects` is intentionally NOT here — it lives in the "Prospect directory (N)"
 * section heading, the single source for that count (no duplication).
 * Rates are formatted as percentages; counts as plain integers. Mirrors the
 * stat-label / tabular-nums conventions used across the admin console.
 */
export function OutreachStatsCards({ stats }: { stats: OutreachStats }) {
  const items: StatDef[] = [
    { label: "Sent", value: integer.format(stats.emails.sent) },
    { label: "Open rate", value: pct(stats.rates.openRate) },
    { label: "Click rate", value: pct(stats.rates.clickRate) },
    { label: "Bounce rate", value: pct(stats.rates.bounceRate) },
  ];

  return (
    <div className="flex flex-wrap items-center gap-5">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-1.5">
          <span className="ct-bento-label">{item.label}</span>
          <span className="ct-metric-value tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
