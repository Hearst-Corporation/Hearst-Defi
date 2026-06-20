import Link from "next/link";

import { ProposalQueue } from "@/components/admin/governance/proposal-queue";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { AdminUrlTabFilter } from "@/components/admin/admin-url-tab-filter";
import { Button } from "@/components/ui/button";
import { loadProposalQueue } from "@/lib/governance/actions";
import type { ProposalState } from "@/lib/governance/state-machine";
import { buildGovernanceKpiStrip } from "@/lib/admin/governance-kpi-strip";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "all", label: "All" },
  { key: "signing", label: "Awaiting my signature" },
  { key: "timelock", label: "Timelock" },
  { key: "executable", label: "Executable" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isTabKey(v: unknown): v is TabKey {
  return TABS.some((t) => t.key === v);
}

function filterProposals(
  proposals: Awaited<ReturnType<typeof loadProposalQueue>>,
  tab: TabKey,
) {
  if (tab === "all") return proposals;
  const stateByTab: Partial<Record<TabKey, ProposalState>> = {
    signing: "SIGNING",
    timelock: "TIMELOCK",
    executable: "EXECUTABLE",
  };
  const state = stateByTab[tab];
  return state ? proposals.filter((p) => p.state === state) : proposals;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function GovernancePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawTab = params["tab"];
  const activeTab: TabKey = isTabKey(rawTab) ? rawTab : "all";

  const queue = await loadProposalQueue();
  const filtered = filterProposals(queue, activeTab);
  const governanceKpis = buildGovernanceKpiStrip(queue);

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Governance"
        description="Review operator proposals, signature status, and timelock readiness before execution."
        actions={
          <Button variant="primary" asChild size="md">
            <Link href="/admin/governance/propose">+ New proposal</Link>
          </Button>
        }
      />

      {governanceKpis.length > 0 ? (
        <AdminKpiStripPanel kpis={governanceKpis} />
      ) : null}

      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Proposal queue">
        <AdminUrlTabFilter
          ariaLabel="Filter proposals by status"
          activeKey={activeTab}
          tabs={TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            href:
              tab.key === "all" ? "/admin/governance" : `/admin/governance?tab=${tab.key}`,
          }))}
        />

        <ProposalQueue proposals={filtered} />
      </section>

    </div>
  );
}
