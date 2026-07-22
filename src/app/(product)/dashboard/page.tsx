// /dashboard — Series 1 investor overview.
//
// Server Component reading the vault through the ONE server-only passage point
// (`src/lib/chain/dynavault.ts`). No client fetch, no viem in this tree, no
// second data layer: the adapter's `Wired<T>` envelopes reach the Series 1
// dashboard intact, so an RPC outage never renders as "no data" and an
// undeployed contract never renders as a zero (docs/frontend-api-only-policy.md).
//
// This route composes only — the surface lives in
// `src/components/series1-dashboard/`, rebuilt from
// docs/front-dashboard-zero-rebuild-canon.md. It imports no `@/lib/data/*`,
// no Prisma, no viem, no ethers (architecture guard, canon F9).
//
// Today `NEXT_PUBLIC_DYNAVAULT_ADDRESS` is unset, so most reads resolve
// `unavailable` with a motive — that IS the honest state of the product. The
// rebuilt surface states that motive ONCE per group instead of printing it as
// the value of every KPI (canon F3).

import {
  getVaultMode,
  readElecStatus,
  readMiningMetrics,
  readOpsState,
  readProductDurationMonths,
  readStrategies,
  readVaultCore,
} from "@/lib/chain/dynavault";

import { Series1Dashboard } from "@/components/series1-dashboard/Series1Dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Overview · Hearst Bitcoin Reserve Vault — Series 1",
};

export default async function DashboardPage() {
  // One batch per concern; each returns its own envelope so a failing read
  // never drags a succeeding one down with it.
  const [core, strategies, mining, elec, ops, duration] = await Promise.all([
    readVaultCore(),
    readStrategies(),
    readMiningMetrics(),
    readElecStatus(),
    readOpsState(),
    readProductDurationMonths(),
  ]);

  return (
    <Series1Dashboard
      core={core}
      strategies={strategies}
      mining={mining}
      elec={elec}
      ops={ops}
      duration={duration}
      mode={getVaultMode()}
    />
  );
}
