import Link from "next/link";

import { ProposalQueue } from "@/components/admin/governance/proposal-queue";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadProposalQueue } from "@/lib/governance/actions";
import type { ProposalState } from "@/lib/governance/state-machine";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "all", label: "All" },
  { key: "signing", label: "Awaiting my sig" },
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
  const filtered = filterProposals(await loadProposalQueue(), activeTab);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Governance"
        actions={
          <Button variant="primary" asChild size="md">
            <Link href="/admin/governance/propose">+ New proposal</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter proposals by status">
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
              className={cn("ct-pill text-xs font-semibold uppercase", isActive && "accent")}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      <ProposalQueue proposals={filtered} />
    </div>
  );
}
