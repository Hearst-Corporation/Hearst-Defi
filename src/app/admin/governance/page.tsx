import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadProposalQueue } from "@/lib/governance/actions";
import type { ProposalState } from "@/lib/governance/state-machine";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

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

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// ---------------------------------------------------------------------------
// State pill helper
// ---------------------------------------------------------------------------

function stateVariant(
  state: ProposalState,
): "default" | "warning" | "success" | "danger" | "accent" {
  switch (state) {
    case "DRAFT":
      return "default";
    case "SIGNING":
      return "warning";
    case "QUEUED":
    case "TIMELOCK":
      return "accent";
    case "EXECUTABLE":
      return "success";
    case "EXECUTED":
      return "success";
    case "CANCELLED":
    case "REJECTED":
    case "EXPIRED":
      return "danger";
  }
}

function stateLabel(state: ProposalState): string {
  return state.charAt(0) + state.slice(1).toLowerCase();
}

function formatAge(d: Date): string {
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function GovernancePage({ searchParams }: PageProps) {
  await requireAdmin();

  const params = await searchParams;
  const rawTab = params["tab"];
  const activeTab: TabKey = isTabKey(rawTab) ? rawTab : "all";

  const allProposals = await loadProposalQueue();

  const filtered = allProposals.filter((p) => {
    if (activeTab === "all") return true;
    if (activeTab === "signing") return p.state === "SIGNING";
    if (activeTab === "timelock") return p.state === "TIMELOCK";
    if (activeTab === "executable") return p.state === "EXECUTABLE";
    return true;
  });

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

      {/* Filter tabs */}
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
              className={
                isActive
                  ? "ct-pill accent text-xs font-semibold uppercase tracking-[var(--ct-tracking-wide)]"
                  : "ct-pill text-xs font-semibold uppercase tracking-[var(--ct-tracking-wide)]"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card>
          <p className="body-md ct-text-muted text-center py-8">
            No proposals found.{" "}
            <Link
              href="/admin/governance/propose"
              className="ct-text-primary underline underline-offset-2"
            >
              Create the first one.
            </Link>
          </p>
        </Card>
      )}

      {/* Proposal list */}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((proposal) => (
            <Link
              key={proposal.id}
              href={`/admin/governance/proposal/${proposal.id}`}
              className="block"
            >
              <Card className="p-4 hover:border-[var(--ct-border-strong)] transition-colors cursor-pointer">
                <div className="flex items-center gap-4">
                  {/* Vault + action */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="ct-pill text-xs mono">{proposal.vaultTicker}</span>
                      <span className="body-md font-semibold ct-text-strong truncate">
                        {proposal.actionType}
                      </span>
                    </div>
                    <p className="text-xs ct-text-muted">
                      Proposed by{" "}
                      <span className="mono">
                        {proposal.proposedBy.slice(0, 8)}…
                      </span>
                      {" · "}
                      {formatAge(proposal.createdAt)}
                    </p>
                  </div>

                  {/* Signatures count */}
                  <div className="text-xs ct-text-muted text-right shrink-0">
                    <span className="font-semibold ct-text-primary">
                      {proposal.approvalCount}/{proposal.requiredSigners}
                    </span>{" "}
                    approved
                    {proposal.rejectionCount > 0 && (
                      <span className="ml-2 text-[var(--ct-status-danger)]">
                        {proposal.rejectionCount} rejected
                      </span>
                    )}
                  </div>

                  {/* State pill */}
                  <Badge variant={stateVariant(proposal.state)}>
                    {stateLabel(proposal.state)}
                  </Badge>
                </div>

                {/* ETA countdown for TIMELOCK */}
                {proposal.state === "TIMELOCK" && proposal.etaAt && (
                  <div className="mt-3 pt-3 border-t border-[var(--ct-border-soft)] text-xs ct-text-muted">
                    Timelock ETA:{" "}
                    <span className="ct-text-primary mono">
                      {proposal.etaAt.toISOString().replace("T", " ").slice(0, 19)} UTC
                    </span>
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
