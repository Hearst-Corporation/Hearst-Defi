import { loadProposalQueue } from "@/lib/governance/actions";
import type { ProposalState } from "@/lib/governance/state-machine";
import { AdminGovernanceView } from "@/views/admin/governance-view";

export const dynamic = "force-dynamic";

const TAB_KEYS = ["all", "signing", "timelock", "executable"] as const;

type TabKey = (typeof TAB_KEYS)[number];

function isTabKey(v: unknown): v is TabKey {
  return TAB_KEYS.some((k) => k === v);
}

function filterProposals(
  proposals: Awaited<ReturnType<typeof loadProposalQueue>>,
  tab: TabKey,
) {
  if (tab === "all") return proposals;
  // "Awaiting my signature" is a REAL per-operator predicate (SIGNING and no
  // decision recorded by the current operator), not a bare state filter —
  // computed server-side in loadProposalQueue against the signer identity.
  if (tab === "signing") return proposals.filter((p) => p.awaitingMySignature);
  const stateByTab: Partial<Record<TabKey, ProposalState>> = {
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

  return (
    <AdminGovernanceView
      proposals={filtered}
      queue={queue}
      activeTab={activeTab}
    />
  );
}
