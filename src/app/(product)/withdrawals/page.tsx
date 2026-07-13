// /withdrawals — institutional BTC withdrawal requests.
//
// THE MOST SENSITIVE CUSTODIAL SURFACE IN THE PRODUCT (non-negotiable #5: no
// financial/custodial action from the chat, ever). This page is request-only:
// submitting the form creates a `pending` Withdrawal row and moves ZERO funds.
// Only custody operations (an admin, requireAdmin-gated, multisig quorum) can
// approve, and only a human-entered real tx hash — recorded after an
// out-of-band custody release — can ever mark a request "completed". No
// Inngest job, no cron, no automatic settlement anywhere.
//
// Server Component — gated by `requireInvestor` (same pattern as
// /bitcoin-reserve). The investor's own withdrawal history renders from a
// direct, owner-scoped Prisma query (investorId from the resolved session).

import { Badge } from "@/components/catalyst/badge";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { StepTimeline, type StepTimelineItem } from "@/components/catalyst/step-timeline";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/catalyst/table";
import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getInvestor } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { loadBitcoinReserveView } from "@/lib/data/bitcoin-reserve-view";
import { formatBtc } from "@/lib/format/btc";
import { formatUsdFull } from "@/lib/vaults/product-display";
import { explorerTxUrl, isPlaceholderTxHash } from "@/lib/chain/explorer";

import { WithdrawForm } from "./withdraw-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Withdrawals — Hearst Connect" };

/** Bare-hairline support surface (matches /portfolio + /bitcoin-reserve SUPPORT recipe). */
const SUPPORT =
  "rounded-2xl border border-[var(--ct-border)] bg-surface-card overflow-hidden";

const REQUEST_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

type WithdrawalStatus = "pending" | "approved" | "rejected" | "completed";

const STATUS_BADGE: Record<WithdrawalStatus, { label: string; color: "zinc" | "amber" | "blue" | "green" | "red" }> = {
  pending: { label: "Pending review", color: "amber" },
  approved: { label: "Approved", color: "blue" },
  completed: { label: "Completed", color: "green" },
  rejected: { label: "Rejected", color: "red" },
};

function buildStatusTimeline(status: WithdrawalStatus): StepTimelineItem[] {
  const rejected = status === "rejected";
  return [
    {
      title: "Requested",
      description: "Withdrawal request submitted — no funds moved yet.",
      tone: "neutral",
    },
    {
      title: "Under review",
      description: "Custody operations reviews the request (multisig quorum).",
      tone: rejected ? "danger" : status === "pending" ? "warning" : "neutral",
    },
    {
      title: "Approved",
      description: "Quorum reached — awaiting off-platform custody release.",
      tone: rejected ? "danger" : status === "approved" ? "warning" : status === "completed" ? "neutral" : "neutral",
    },
    {
      title: "Settled",
      description: rejected
        ? "Request was rejected — no funds were moved."
        : "Funds released; transaction hash recorded.",
      tone: rejected ? "danger" : status === "completed" ? "accent" : "neutral",
    },
  ];
}

export default async function WithdrawalsPage() {
  await requireInvestor("/withdrawals");
  const investor = await getInvestor();

  const [btcView, withdrawals] = await Promise.all([
    loadBitcoinReserveView(),
    investor
      ? prisma.withdrawal.findMany({
          where: { investorId: investor.id },
          orderBy: { requestedAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const hasWithdrawals = withdrawals.length > 0;
  const mostRecentActive = withdrawals.find(
    (w) => w.status === "pending" || w.status === "approved",
  );

  return (
    <div className="dark flex flex-col gap-y-8 p-5 lg:p-6">
      <PortfolioLeafHeader
        titleLead="BTC"
        titleAccent="Withdrawals"
        kicker="CUSTODY OPERATIONS"
      />

      <div className={SUPPORT}>
        <div className="flex flex-col gap-1 p-5 lg:p-6">
          <span className="body-sm ct-text-strong font-medium">
            Requests are reviewed and settled by custody operations.
          </span>
          <span className="body-xs ct-text-muted">
            No funds move until approval. Submitting a request below only
            creates a pending review item — it never triggers a transfer.
          </span>
        </div>
      </div>

      {/* ── Request form ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-4 pt-2">
          <h2 className="ct-section-title shrink-0">New withdrawal request</h2>
          <span aria-hidden="true" className="h-px flex-1" style={{ background: "var(--ct-border-soft)" }} />
        </div>
        <div className={SUPPORT}>
          <div className="p-5 lg:p-6">
            <WithdrawForm btcPriceUsd={btcView.btcPrice.value} />
          </div>
        </div>
      </section>

      {/* ── Most recent active request — status timeline ───────────────── */}
      {mostRecentActive ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-4 pt-2">
            <h2 className="ct-section-title shrink-0">Current request status</h2>
            <span aria-hidden="true" className="h-px flex-1" style={{ background: "var(--ct-border-soft)" }} />
          </div>
          <div className={SUPPORT}>
            <div className="p-5 lg:p-6">
              <StepTimeline
                steps={buildStatusTimeline(mostRecentActive.status as WithdrawalStatus)}
                aria-label="Withdrawal request status"
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Withdrawal history ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-4 pt-2">
          <h2 className="ct-section-title shrink-0">Withdrawal history</h2>
          <span aria-hidden="true" className="h-px flex-1" style={{ background: "var(--ct-border-soft)" }} />
          {hasWithdrawals && (
            <span className="ct-metric-caption shrink-0 tabular-nums">
              {withdrawals.length} request{withdrawals.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {hasWithdrawals ? (
          <div className={SUPPORT}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Amount BTC</TableHeader>
                  <TableHeader>USD Snapshot</TableHeader>
                  <TableHeader>Network</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Transaction</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {withdrawals.map((w) => {
                  const status = w.status as WithdrawalStatus;
                  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.pending;
                  const hasExplorerLink = w.txHash && !isPlaceholderTxHash(w.txHash);

                  return (
                    <TableRow key={w.id}>
                      <TableCell>
                        <span className="tabular-nums ct-text-strong">
                          {REQUEST_DATE.format(w.requestedAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums ct-text-strong">
                          {formatBtc(w.amountBtc.toNumber(), { unit: true })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums ct-text-strong">
                          {formatUsdFull(w.amountUsdcSnapshot.toNumber())}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="body-xs ct-text-muted capitalize">{w.network}</span>
                      </TableCell>
                      <TableCell>
                        <Badge color={badge.color}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {hasExplorerLink ? (
                          <a
                            href={explorerTxUrl(w.txHash as string)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="body-xs ct-text-muted underline underline-offset-2 decoration-[var(--ct-border)] transition-colors hover:ct-text-strong"
                          >
                            View on BaseScan
                          </a>
                        ) : (
                          <span className="body-xs ct-text-faint">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptySurface
            message="No withdrawal requests yet."
            detail="Submit a request above — it will appear here once created, and again once custody operations reviews it."
          />
        )}
      </section>

      <p className="ct-metric-caption text-[length:var(--ct-text-nano)] leading-snug">
        Withdrawal requests are reviewed and settled by custody operations
        under multisig approval. Submitting a request does not move funds;
        only a completed request — carrying a real, human-recorded
        transaction hash — reflects an actual custody release.
      </p>
    </div>
  );
}
