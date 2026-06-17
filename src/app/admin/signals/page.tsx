import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import Link from "next/link";

import { FixtureVaultPills } from "@/components/admin/fixture-vault-pills";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ManualSignalTrigger } from "@/components/admin/manual-signal-trigger";
import { RebalanceCard } from "@/components/admin/rebalance-card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { requestManualSignal } from "./actions";
import { cn } from "@/lib/cn";
import {
  adminSignalsVaultHref,
  resolveFixtureVaultId,
  withAdminVaultQuery,
} from "@/lib/vaults/dashboard-scope";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatusFilter = "pending" | "approved" | "executed" | "cancelled" | "all";

const VALID_STATUSES: StatusFilter[] = [
  "all",
  "pending",
  "approved",
  "executed",
  "cancelled",
];

function toFilter(raw: unknown): StatusFilter {
  if (typeof raw === "string" && VALID_STATUSES.includes(raw as StatusFilter)) {
    return raw as StatusFilter;
  }
  return "pending";
}

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

const TABS: { label: string; value: StatusFilter }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Executed", value: "executed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "All", value: "all" },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface SignalsPageProps {
  searchParams: Promise<{ status?: string; vault?: string }>;
}

export default async function SignalsPage({ searchParams }: SignalsPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const activeStatus = toFilter(params.status);
  const vaultId = resolveFixtureVaultId(params.vault);
  const vaultQuery = params.vault ?? null;

  const where: Prisma.RebalanceEventWhereInput =
    activeStatus === "all" ? {} : { status: activeStatus };

  const events = await prisma.rebalanceEvent.findMany({
    where,
    orderBy: { triggeredAt: "desc" },
    take: 100,
  });

  // Count badges per status
  const counts = await prisma.rebalanceEvent.groupBy({
    by: ["status"],
    _count: { id: true },
  });
  const countMap = Object.fromEntries(
    counts.map((c) => [c.status, c._count.id]),
  );

  const isDev = process.env.NODE_ENV === "development";

  const manualSignalAction = async (ruleId: string, scopeVaultId?: string): Promise<string> => {
    "use server";
    return requestManualSignal(ruleId, scopeVaultId);
  };

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Rebalancing"
        actions={
          <div className="admin-doc-inline-row admin-doc-inline-row--actions">
            <FixtureVaultPills
              activeVaultId={vaultId}
              resolveHref={adminSignalsVaultHref}
            />
            {isDev && (
              <ManualSignalTrigger
                action={manualSignalAction}
                vaultId={vaultQuery ?? undefined}
              />
            )}
          </div>
        }
      />

      <div className="admin-doc-inline-row" role="tablist" aria-label="Signal status filter">
        {TABS.map((tab) => {
          const count = tab.value === "all"
            ? Object.values(countMap).reduce((a, b) => a + b, 0)
            : (countMap[tab.value] ?? 0);

          return (
            <Link
              key={tab.value}
              href={withAdminVaultQuery("/admin/signals", vaultQuery, {
                status: tab.value,
              })}
              role="tab"
              aria-selected={activeStatus === tab.value}
              className={cn("ct-pill", activeStatus === tab.value && "accent")}
            >
              {tab.label}
              {count > 0 && (
                <span className="tabular">{count}</span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Event list */}
      {events.length === 0 ? (
        <EmptySurface
          variant="widget"
          message={`No rebalance signals with status "${activeStatus}".`}
          detail="Signals are created automatically by the Inngest rebalancing-signal function when engine rules fire."
          className="min-h-32"
        />
      ) : (
        <section className="admin-doc-stack admin-doc-stack--relaxed">
          <p className="body-xs font-semibold ct-text-body">
            {events.length} signal{events.length !== 1 ? "s" : ""}
          </p>
          <div className="admin-doc-stack admin-doc-stack--relaxed">
            {events.map((event) => (
              <RebalanceCard key={event.id} event={event} requiredSigners={2} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
