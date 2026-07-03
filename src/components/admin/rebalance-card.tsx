"use client";

import { useState, useTransition } from "react";
import { z } from "zod";
import type { RebalanceEvent } from "@prisma/client";

import { cn } from "@/lib/cn";
import { Ptai } from "@/components/catalyst/ptai";
import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { BentoPanel } from "@/components/catalyst/bento";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import {
  approveRebalance,
  rejectRebalance,
  executeRebalance,
} from "@/app/admin/signals/actions";
import { formatAdminDateTime } from "@/lib/vaults/product-display";
import { statusVariant } from "@/components/proof-center/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RebalanceAllocation {
  bucket: string;
  pct?: number;
  bps?: number;
}

const AllocationBucketSchema = z.object({
  bucket: z.string(),
  pct: z.number().optional(),
  bps: z.number().optional(),
});

const AllocationBucketArraySchema = z.array(AllocationBucketSchema);

interface RebalanceCardProps {
  event: RebalanceEvent;
  /** Required multisig threshold (default 2) */
  requiredSigners?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseAllocation(raw: string): RebalanceAllocation[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = AllocationBucketArraySchema.safeParse(parsed);
    return result.success ? result.data : [];
  } catch {
    return [];
  }
}

function parseSigners(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function abbrWallet(w: string): string {
  if (w.length <= 10) return w;
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

// Strip injected [REJECTED: ...] suffix from triggerText for display
function cleanTriggerText(text: string): string {
  return text.replace(/\s*\[REJECTED:.*\]$/, "");
}

// ---------------------------------------------------------------------------
// AllocationDiffTable
// ---------------------------------------------------------------------------

function AllocationDiffTable({
  from,
  to,
}: {
  from: RebalanceAllocation[];
  to: RebalanceAllocation[];
}) {
  const buckets = Array.from(
    new Set([...from.map((b) => b.bucket), ...to.map((b) => b.bucket)]),
  );

  if (buckets.length === 0) return null;

  return (
    <Table className="rounded-2xl border border-[var(--ct-border)] bg-surface-inset [&_table]:table-fixed [&_table]:tabular-nums">
      <TableHead>
        <TableRow className="border-b border-[var(--ct-border-soft)]">
          <TableHeader className="ct-bento-label w-[34%] px-5 py-3 text-left">
            Bucket
          </TableHeader>
          <TableHeader className="ct-bento-label w-[22%] px-5 py-3 text-right">
            Current %
          </TableHeader>
          <TableHeader className="ct-bento-label w-[22%] px-5 py-3 text-right">
            Target %
          </TableHeader>
          <TableHeader className="ct-bento-label w-[22%] px-5 py-3 text-right">
            Delta
          </TableHeader>
        </TableRow>
      </TableHead>
      <TableBody>
        {buckets.map((bucket) => {
          const f = from.find((b) => b.bucket === bucket);
          const t = to.find((b) => b.bucket === bucket);
          const fromPct = f?.pct ?? 0;
          const toPct = t?.pct ?? 0;
          const delta = toPct - fromPct;

          return (
            <TableRow
              key={bucket}
              className="border-b border-[var(--ct-border-soft)] last:border-0"
            >
              <TableCell className="ct-metric-caption truncate px-5 py-3 font-mono capitalize">
                {bucket.replace(/_/g, " ")}
              </TableCell>
              <TableCell className="ct-metric-caption px-5 py-3 text-right">
                {fromPct.toFixed(1)}%
              </TableCell>
              <TableCell className="ct-metric-caption px-5 py-3 text-right text-[var(--ct-text-secondary)]">
                {toPct.toFixed(1)}%
              </TableCell>
              <TableCell
                className={cn(
                  "ct-metric-caption px-5 py-3 text-right font-semibold",
                  delta > 0
                    ? "text-[var(--ct-accent)]"
                    : delta < 0
                      ? "text-[var(--ct-status-danger)]"
                      : "text-[var(--ct-text-secondary)]",
                )}
              >
                {delta > 0 ? "+" : ""}
                {delta.toFixed(1)}%
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// RebalanceCard
// ---------------------------------------------------------------------------

export function RebalanceCard({
  event,
  requiredSigners = 2,
}: RebalanceCardProps) {
  const [isPending, startTransition] = useTransition();
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Confirmation gate: null = no pending confirm, "approve" | "execute" = awaiting 2nd click
  const [confirmingAction, setConfirmingAction] = useState<"approve" | "execute" | null>(null);

  const signers = parseSigners(event.approvedBy);
  const fromAlloc = parseAllocation(event.fromAllocation);
  const toAlloc = parseAllocation(event.toAllocation);
  const signerCount = signers.length;

  function handleApprove() {
    setError(null);
    // First click → stage confirmation; second click (confirmingAction === "approve") → execute
    if (confirmingAction !== "approve") {
      setConfirmingAction("approve");
      return;
    }
    setConfirmingAction(null);
    startTransition(async () => {
      try {
        await approveRebalance(event.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Approve failed.");
      }
    });
  }

  function handleReject() {
    if (!rejectReason.trim()) {
      setError("Rejection reason is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await rejectRebalance(event.id, rejectReason.trim());
        setShowRejectForm(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Reject failed.");
      }
    });
  }

  function handleExecute() {
    setError(null);
    if (confirmingAction !== "execute") {
      setConfirmingAction("execute");
      return;
    }
    setConfirmingAction(null);
    startTransition(async () => {
      try {
        await executeRebalance(event.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Execute failed.");
      }
    });
  }

  return (
    <BentoPanel className="gap-5 p-5 lg:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent" className="font-mono">
              {event.ruleId}
            </Badge>
            <Badge variant={statusVariant(event.status)}>
              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
            </Badge>
          </div>
          <p className="ct-metric-caption">
            Triggered {formatAdminDateTime(new Date(event.triggeredAt))}
          </p>
        </div>
        <div className="text-right">
          <p className="ct-metric-caption tabular-nums">
            {signerCount}/{requiredSigners} sigs
          </p>
          {event.txHash && (
            <p className="ct-metric-caption font-mono">
              tx: {abbrWallet(event.txHash)}
            </p>
          )}
        </div>
      </div>

      {/* PTAI block — mandatory per CLAUDE.md #3 */}
      <Ptai
        projection={event.projection || "No projection data available."}
        trigger={cleanTriggerText(event.triggerText)}
        action={event.actionText}
        impact={event.impactText}
      />

      {/* Disclaimer — CLAUDE.md #10 */}
      <p className="ct-metric-caption text-[var(--ct-text-muted)]">
        Projections shown above are indicative only and not a commitment to any
        specific outcome. Past performance is not a reliable indicator of future
        results.
      </p>

      {/* Allocation diff */}
      {(fromAlloc.length > 0 || toAlloc.length > 0) && (
        <div className="flex flex-col gap-2">
          <p className="ct-bento-label">Allocation delta</p>
          <AllocationDiffTable from={fromAlloc} to={toAlloc} />
        </div>
      )}

      {/* Approved signers list */}
      {signers.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="ct-bento-label">Signers</p>
          <ul className="flex flex-col gap-1">
            {signers.map((w) => (
              <li key={w} className="ct-metric-caption font-mono">
                {abbrWallet(w)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error display */}
      <div aria-live="polite">
        {error && (
          <p className="ct-metric-caption rounded-lg border border-[color-mix(in_srgb,var(--ct-status-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--ct-status-danger)_10%,transparent)] px-3 py-2 text-[var(--ct-status-danger)]">
            {error}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {event.status === "pending" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {confirmingAction === "approve" ? (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApprove}
                    disabled={isPending}
                    aria-busy={isPending}
                  >
                    {isPending ? "Processing…" : "Confirm approve"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingAction(null)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApprove}
                    disabled={isPending}
                    aria-busy={isPending}
                  >
                    {`Approve (${signerCount}/${requiredSigners} sigs)`}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowRejectForm((v) => !v);
                      setError(null);
                    }}
                    disabled={isPending}
                  >
                    Reject
                  </Button>
                </>
              )}
            </div>
            {showRejectForm && (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rejection reason…"
                  className="ct-metric-value flex-1 rounded-lg border border-[var(--ct-border)] bg-surface-inset px-4 py-2.5 placeholder:text-[var(--ct-text-muted)] focus:border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] focus:outline-none"
                  disabled={isPending}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleReject}
                  disabled={isPending || !rejectReason.trim()}
                >
                  Confirm reject
                </Button>
              </div>
            )}
          </>
        )}

        {/* "approved" status is transient — auto-execute fires immediately on threshold.
            This branch handles signals that were approved before the oracle path landed. */}
        {event.status === "approved" && (
          <div className="flex flex-wrap items-center gap-2">
            {confirmingAction === "execute" ? (
              <>
                <Button variant="primary" size="sm" onClick={handleExecute} disabled={isPending} aria-busy={isPending}>
                  {isPending ? "Executing…" : "Confirm execute"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmingAction(null)} disabled={isPending}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button variant="primary" size="sm" onClick={handleExecute} disabled={isPending} aria-busy={isPending}>
                Execute (off-chain)
              </Button>
            )}
          </div>
        )}

        {event.status === "executed" && (
          <div className="flex flex-col gap-2">
            <p className="ct-metric-caption text-[var(--ct-accent)]">
              Auto-executed on approval · {formatAdminDateTime(new Date(event.executedAt))}
            </p>
            {event.txHash && (
              <p className="ct-metric-caption font-mono">
                tx: {event.txHash}
              </p>
            )}
          </div>
        )}

        {event.status === "cancelled" && (
          <p className="ct-metric-caption">
            Signal cancelled.{" "}
            {event.triggerText.includes("[REJECTED:")
              ? event.triggerText.match(/\[REJECTED:(.*)\]/)?.[1]?.trim()
              : null}
          </p>
        )}
      </div>
    </BentoPanel>
  );
}
