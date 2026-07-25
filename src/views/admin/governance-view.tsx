import Link from "next/link";

import { FORM_SURFACE } from "@/components/admin/admin-page-shell";
import {
  AdminUrlTabFilter,
  type AdminUrlTab,
} from "@/components/admin/admin-url-tab-filter";
import { ProposalQueue } from "@/components/admin/governance/proposal-queue";
import { buildGovernanceKpiStrip } from "@/lib/admin/governance-kpi-strip";
import type { loadProposalQueue } from "@/lib/governance/actions";
import { Button, Kpi, KpiGrid } from "@/ui";
import { PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";

type Queue = Awaited<ReturnType<typeof loadProposalQueue>>;

type TabKey = "all" | "signing" | "timelock" | "executable";

/**
 * "Awaiting my signature" is honest here: the tab filters on the per-operator
 * `awaitingMySignature` predicate computed server-side (SIGNING + no decision
 * recorded by the CURRENT operator), not on the bare SIGNING state.
 */
function buildTabs(queue: Queue): readonly AdminUrlTab[] {
  return [
    { key: "all", label: "All", href: "/admin/governance", count: queue.length },
    {
      key: "signing",
      label: "Awaiting my signature",
      href: "/admin/governance?tab=signing",
      count: queue.filter((p) => p.awaitingMySignature).length,
    },
    {
      key: "timelock",
      label: "Timelock",
      href: "/admin/governance?tab=timelock",
      count: queue.filter((p) => p.state === "TIMELOCK").length,
    },
    {
      key: "executable",
      label: "Executable",
      href: "/admin/governance?tab=executable",
      count: queue.filter((p) => p.state === "EXECUTABLE").length,
    },
  ];
}

export function AdminGovernanceView({
  proposals,
  queue,
  activeTab,
}: {
  proposals: Queue;
  queue: Queue;
  activeTab: TabKey;
}) {
  const governanceKpis = buildGovernanceKpiStrip(queue);

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Proof & system"
        title="Governance console"
        description="Multisig action queue — sign, timelock, execute."
        actions={
          <Link href="/admin/governance/propose">
            <Button>New proposal</Button>
          </Link>
        }
      />

      {governanceKpis.length > 0 ? (
        <KpiGrid>
          {governanceKpis.map((kpi) => (
            <Panel key={kpi.label}>
              <div className={FORM_SURFACE}>
                <Kpi
                  label={kpi.label}
                  value={kpi.value}
                  hint={kpi.sublabel}
                  provenance={kpi.provenance}
                />
              </div>
            </Panel>
          ))}
        </KpiGrid>
      ) : null}

      <Section title="Governance proposals">
        <Panel>
          <div className="border-b border-[var(--ct-border)] p-5">
            <AdminUrlTabFilter
              tabs={buildTabs(queue)}
              activeKey={activeTab}
              ariaLabel="Filter proposals by status"
            />
          </div>

          <div className={FORM_SURFACE}>
            <ProposalQueue proposals={proposals} />
          </div>
        </Panel>
      </Section>
    </PageLayout>
  );
}
