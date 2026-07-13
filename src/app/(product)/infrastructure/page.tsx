// /infrastructure — Phase 1 (Bitcoin Strategic Reserve reposition, read-only).
//
// HONEST STATE (verified by audit): no mining-site entity exists anywhere in
// the schema — no per-site country, power capacity, cooling system, energy
// source, or per-site uptime/BTC-produced. This page never fabricates a site
// register. It ships as a clear "awaiting infrastructure disclosure" surface,
// plus (optionally) the ONE real, fleet-level figure that already exists —
// `allocatedHashrate` from `MiningMetric` — labelled and badged honestly as an
// aggregate estimate, never a per-site number.
//
// Server Component — gated by the (product) layout (session required).

import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { StatBand } from "@/app/(product)/portfolio/preview/_charts/stat-band";
import { loadMiningMetrics } from "@/lib/data/mining-metrics";

export const dynamic = "force-dynamic";

export const metadata = { title: "Infrastructure — Hearst Connect" };

export default async function InfrastructurePage() {
  const miningMetrics = await loadMiningMetrics();

  return (
    <div className="dark flex flex-col gap-y-8 p-5 lg:p-6">
      <PortfolioLeafHeader
        titleLead="Mining"
        titleAccent="Infrastructure"
        kicker="SITES & CAPACITY"
      />

      <EmptySurface
        message="Infrastructure disclosure is not available yet."
        detail="Mining site details (country, power capacity, cooling system, energy source, uptime) will appear here once Hearst's site register is published."
      />

      {miningMetrics ? (
        <div className="flex flex-col gap-3">
          <StatBand
            items={[
              {
                label: "Fleet Hashrate (aggregate)",
                value: miningMetrics.allocatedHashrate,
                provenance: "estimated",
                valueTone: "btc",
                asset: "bitcoin",
              },
            ]}
          />
          <p className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
            Fleet-wide aggregate, not a per-site figure — no site register exists yet to break this down by location.
          </p>
        </div>
      ) : null}
    </div>
  );
}
