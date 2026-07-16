import { ProposalQueue } from "@/components/admin/governance/proposal-queue";
import { AdminPageShell, AdminSectionCard } from "@/components/admin/admin-page-shell";
import { AdminUrlTabFilter } from "@/components/admin/admin-url-tab-filter";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
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
    <AdminPageShell
      titleLead="Governance"
      titleAccent="Console"
      contextLabel="Proof & System"
      headerActions={
        <CockpitButton
          href="/admin/governance/propose"
          variant="primary"
          shape="rect"
          size="lg"
        >
          New proposal
        </CockpitButton>
      }
    >
      <AdminSectionCard
        kpis={governanceKpis.length > 0 ? governanceKpis : undefined}
        kpiTitle="Governance"
        kpiSubtitle="Multisig action queue"
        ariaLabel="Proposal queue"
        title="Governance proposals"
        subtitle="Multisig action queue · sign, timelock, execute"
        headerTrailing={
          <AdminUrlTabFilter
            ariaLabel="Filter proposals by status"
            activeKey={activeTab}
            tabs={TABS.map((tab) => ({
              key: tab.key,
              label: tab.label,
              href:
                tab.key === "all"
                  ? "/admin/governance"
                  : `/admin/governance?tab=${tab.key}`,
            }))}
          />
        }
      >
        <ProposalQueue proposals={filtered} />
      </AdminSectionCard>
    </AdminPageShell>
  );
}
