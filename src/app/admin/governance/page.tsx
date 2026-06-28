import { ProposalQueue } from "@/components/admin/governance/proposal-queue";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { AdminUrlTabFilter } from "@/components/admin/admin-url-tab-filter";
import { Button } from "@/components/catalyst/button";
import { CATALYST_ACCENT_BTN } from "@/lib/ui/catalyst-accent";
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
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Governance"
          titleAccent="Console"
          contextLabel="Proof & System"
          actions={
            <Button href="/admin/governance/propose" className={CATALYST_ACCENT_BTN}>
              New proposal
            </Button>
          }
        />

        {governanceKpis.length > 0 ? (
          <AdminKpiStripPanel kpis={governanceKpis} />
        ) : null}

        <section
          className="flex flex-col overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm"
          aria-label="Proposal queue"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ct-border-soft)] p-5">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="ct-section-title">Governance proposals</h2>
              <p className="ct-metric-caption">
                Multisig action queue · sign, timelock, execute
              </p>
            </div>
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
          </div>
          <div className="p-5 lg:p-6">
            <ProposalQueue proposals={filtered} />
          </div>
        </section>
      </div>
    </div>
  );
}
