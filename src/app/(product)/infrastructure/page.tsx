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

import { Server } from "lucide-react";

import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { HcChartCard } from "@/components/dataviz/his/HcChartCard";
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

      {/*
        Premium "awaiting disclosure" treatment: the canonical `.ct-empty-surface--widget`
        chrome (card, border, radius) hosts a large muted glyph ABOVE the honest copy —
        composed here (icon as a sibling, text via `variant="inline"` so there's only ONE
        card boundary, not a nested box) rather than via `children` (which the component
        renders AFTER `detail`, i.e. below the text).
      */}
      <div className="ct-empty-surface ct-empty-surface--widget flex flex-col items-center gap-[var(--ct-space-3)] py-[var(--ct-space-12)]">
        <Server
          aria-hidden="true"
          strokeWidth={1.25}
          className="h-12 w-12 ct-text-faint"
        />
        <EmptySurface
          variant="inline"
          className="items-center text-center"
          message="Infrastructure disclosure is not available yet."
          detail="Mining site details (country, power capacity, cooling system, energy source, uptime) will appear here once Hearst's site register is published."
        />
      </div>

      {miningMetrics ? (
        // No time series exists for this fleet-level snapshot (one scalar, no
        // history) — the plot slot honestly renders `state="empty"` (the
        // component's own "No data yet" affordance) rather than a fabricated
        // trend or a dead blank box. The headline metric is the real figure.
        <HcChartCard
          title="Fleet Hashrate"
          subtitle="Allocated share of Hearst's deployed mining capacity."
          metric={miningMetrics.allocatedHashrate}
          metricCompact
          source="estimated"
          state="empty"
          height={56}
          disclaimer="Fleet-wide aggregate, not a per-site figure — no site register exists yet to break this down by location."
          aria-label="Fleet hashrate, allocated share"
        >
          <div className="h-full w-full" />
        </HcChartCard>
      ) : null}
    </div>
  );
}
