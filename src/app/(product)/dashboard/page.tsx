// /dashboard — Series 1 investor overview.
//
// Server Component reading the vault from hearst-connect-backend (independent
// repository) over HTTP — see ./_data/dashboard-loader.ts. It imports no
// `@/lib/chain/dynavault`, no `@/lib/data/*`, no Prisma, no viem, no ethers
// (architecture guard, canon F9): a business fact has exactly one source, and
// it is the backend.
//
// The `Wired<T>` envelopes still reach the Series 1 tree intact — the loader
// rebuilds them from the backend's `Resolved<T>` blocks — so an outage never
// renders as "no data" and an undeployed contract never renders as a zero
// (docs/frontend-api-only-policy.md).
//
// This route composes only — the surface lives in
// `src/components/series1-dashboard/`, rebuilt from
// docs/front-dashboard-zero-rebuild-canon.md. When a group's fact is absent,
// the surface states that motive ONCE per group instead of printing it as the
// value of every KPI (canon F3).

import { Series1Dashboard } from "@/components/series1-dashboard/Series1Dashboard";
import {
  Series1DashboardPage,
  Series1DashboardSection,
} from "@/components/series1-dashboard/Series1DashboardSection";

import { loadDashboardPageData } from "./_data/dashboard-loader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Overview · Hearst Bitcoin Reserve Vault — Series 1",
};

export default async function DashboardPage() {
  const data = await loadDashboardPageData();

  // The backend never answered. Distinct from "nothing is configured yet":
  // this says we could not reach the data, and shows no figure at all rather
  // than a zero, a cached guess or a fixture.
  if (data.state === "error") {
    return (
      <Series1DashboardPage>
        <Series1DashboardSection title="We couldn’t reach the data">
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            The service that reports this vault’s state did not respond, so this overview is
            deliberately blank — nothing below has been estimated or filled in. This is a
            connectivity problem on our side, not a statement about your position.
          </p>
        </Series1DashboardSection>
      </Series1DashboardPage>
    );
  }

  return (
    <Series1Dashboard
      core={data.core}
      strategies={data.strategies}
      subscriptionCapacity={data.subscriptionCapacity}
      proofSnapshot={data.proofSnapshot}
      mining={data.mining}
      elec={data.elec}
      ops={data.ops}
      duration={data.duration}
      mode={data.runtimeMode}
    />
  );
}
