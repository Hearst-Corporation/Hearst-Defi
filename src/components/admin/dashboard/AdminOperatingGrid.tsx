// AdminOperatingGrid — the four operator domains as a real grid of cards.
//
// Replaces the single `divide-x` slab of `platform-overview-band.tsx`. Each
// domain is now its own L2 card that RISES off the page (canon §4), instead of
// four panes sharing one black surface separated by hairlines.
//
// The data is unchanged: `buildOverviewClustersView` still produces the
// Capital / Clients / Governance / Exposure clusters from the real Prisma
// aggregates (platform totals, overview clusters). Only the surface changed.

import type { OverviewClustersView } from "@/lib/admin/overview-clusters-view";

import { AdminDomainCard } from "./AdminDomainCard";

/** Per-domain caption — states what the cluster counts, in operator words. */
const DOMAIN_CAPTION: Record<string, string> = {
  Capital: "Deployed across every vault",
  Clients: "Investor base and verification",
  Governance: "Proposals awaiting signature or execution",
  Exposure: "Reserve events and allocation",
};

export function AdminOperatingGrid({ view }: { view: OverviewClustersView }) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-[var(--ct-space-4)] md:grid-cols-2 xl:grid-cols-4">
      {view.clusters.map((cluster) => (
        <AdminDomainCard
          key={cluster.label}
          label={cluster.label}
          href={cluster.href}
          kpis={cluster.kpis}
          caption={DOMAIN_CAPTION[cluster.label]}
        />
      ))}
    </div>
  );
}
