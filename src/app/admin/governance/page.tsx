import Link from "next/link";

import { ProposalQueue } from "@/components/admin/governance/proposal-queue";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadProposalQueue } from "@/lib/governance/actions";
import type { ProposalState } from "@/lib/governance/state-machine";
import { cn } from "@/lib/cn";
import { canRunDemoProvider } from "@/lib/demo/guard";
import { buildDemoGovernanceQueue } from "@/lib/demo/admin/governance";

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
  await requireAdmin();

  const params = await searchParams;
  const rawTab = params["tab"];
  const activeTab: TabKey = isTabKey(rawTab) ? rawTab : "all";

  const queue = canRunDemoProvider()
    ? buildDemoGovernanceQueue()
    : await loadProposalQueue();
  const filtered = filterProposals(queue, activeTab);

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

      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Proposal queue">
        <div className="admin-doc-inline-row" role="tablist" aria-label="Filter proposals by status">
          {TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            const href =
              tab.key === "all" ? "/admin/governance" : `/admin/governance?tab=${tab.key}`;
            return (
              <Link
                key={tab.key}
                href={href}
                role="tab"
                aria-selected={isActive}
                className={cn("ct-pill", isActive && "accent")}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <ProposalQueue proposals={filtered} />
      </section>

      {canRunDemoProvider() ? (
        <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Dev tools">
          <h2 className="h2">Dev tools</h2>
          <Card hoverOverlay={false}>
            <DashboardPanelHeader
              eyebrow="Local only"
              title="Governance simulation"
              tone="quiet"
            />
            <p className="body-sm ct-prose-md ct-text-muted">
              Mock Tenderly-style proposal simulation — not wired to live execution.
              Available when <code>DEMO_PROVIDER_ENABLED=1</code>.
            </p>
            <Button variant="secondary" asChild size="sm" className="self-start">
              <Link href="/admin/governance/simulate-demo">Open simulation panel</Link>
            </Button>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
