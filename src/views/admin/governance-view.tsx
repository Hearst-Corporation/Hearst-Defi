import Link from "next/link";

import { ProposalQueue } from "@/components/admin/governance/proposal-queue";
import { buildGovernanceKpiStrip } from "@/lib/admin/governance-kpi-strip";
import type { loadProposalQueue } from "@/lib/governance/actions";
import { cn } from "@/lib/cn";
import { Badge, Button, Kpi, KpiGrid } from "@/ui";
import { PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";

const TABS = [
  { key: "all", label: "All" },
  { key: "signing", label: "Awaiting my signature" },
  { key: "timelock", label: "Timelock" },
  { key: "executable", label: "Executable" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function AdminGovernanceView({
  proposals,
  queue,
  activeTab,
}: {
  proposals: Awaited<ReturnType<typeof loadProposalQueue>>;
  queue: Awaited<ReturnType<typeof loadProposalQueue>>;
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
              <div className="p-5">
                <Kpi
                  label={kpi.label}
                  value={kpi.value}
                  hint={kpi.sublabel}
                  provenance="manual"
                />
              </div>
            </Panel>
          ))}
        </KpiGrid>
      ) : null}

      <Section title="Governance proposals">
        <Panel>
          <nav
            className="flex flex-wrap gap-2 border-b border-[var(--ct-border)] p-5"
            aria-label="Filter proposals by status"
          >
            {TABS.map((tab) => {
              const href =
                tab.key === "all"
                  ? "/admin/governance"
                  : `/admin/governance?tab=${tab.key}`;
              const active = tab.key === activeTab;

              return (
                <Link key={tab.key} href={href}>
                  <Badge
                    variant={active ? "accent" : "outline"}
                    className={cn("cursor-pointer px-3 py-1")}
                  >
                    {tab.label}
                  </Badge>
                </Link>
              );
            })}
          </nav>

          <div className="p-5">
            <ProposalQueue proposals={proposals} />
          </div>
        </Panel>
      </Section>
    </PageLayout>
  );
}
