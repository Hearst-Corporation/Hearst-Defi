"use client";

import { useState, useTransition } from "react";
import { z } from "zod";
import type { RebalanceEvent } from "@prisma/client";

import { cn } from "@/lib/cn";
import { Ptai } from "@/components/ui/ptai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  approveRebalance,
  rejectRebalance,
  executeRebalance,
} from "@/app/admin/signals/actions";
import { formatAdminDateTime } from "@/lib/vaults/product-display";

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

function statusVariant(
  status: string,
): "default" | "success" | "warning" | "danger" | "brand" {
  switch (status) {
    case "pending":
      return "warning";
    case "approved":
      return "brand";
    case "executed":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "default";
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
    <div className="overflow-hidden">
      <table className="w-full table-fixed body-sm tabular">
        <thead>
          <tr>
            <th className="w-[34%] text-left stat-label ct-table-header">
              Bucket
            </th>
            <th className="w-[22%] text-right stat-label ct-table-header">
              Current %
            </th>
            <th className="w-[22%] text-right stat-label ct-table-header">
              Target %
            </th>
            <th className="w-[22%] text-right stat-label ct-table-header">
              Delta
            </th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => {
            const f = from.find((b) => b.bucket === bucket);
            const t = to.find((b) => b.bucket === bucket);
            const fromPct = f?.pct ?? 0;
            const toPct = t?.pct ?? 0;
            const delta = toPct - fromPct;

            return (
              <tr key={bucket} className="border-t border-(--ct-border-soft)">
                <td className="ct-table-cell ct-text-body mono body-xs capitalize truncate">
                  {bucket.replace(/_/g, " ")}
                </td>
                <td className="ct-table-cell text-right ct-text-muted tabular">
                  {fromPct.toFixed(1)}%
                </td>
                <td className="ct-table-cell text-right ct-text-body tabular">
                  {toPct.toFixed(1)}%
                </td>
                <td
                  className={cn(
                    "ct-table-cell text-right font-semibold tabular",
                    delta > 0
                      ? "ct-status-success"
                      : delta < 0
                        ? "ct-status-danger"
                        : "ct-text-muted",
                  )}
                >
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
    <Card>
      <div className="admin-doc-stack admin-doc-stack--roomy">
        {/* Header */}
        <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start admin-doc-inline-row--relaxed">
          <div className="admin-doc-stack admin-doc-stack--compact">
            <div className="admin-doc-inline-row">
              <span className="ct-pill accent mono body-xs">
                {event.ruleId}
              </span>
              <Badge variant={statusVariant(event.status)}>
                {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
              </Badge>
            </div>
            <p className="body-sm ct-text-muted">
              Triggered {formatAdminDateTime(new Date(event.triggeredAt))}
            </p>
          </div>
          <div className="text-right">
            <p className="body-xs ct-text-muted tabular">
              {signerCount}/{requiredSigners} sigs
            </p>
            {event.txHash && (
              <p className="body-xs mono ct-text-muted">
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
        <p className="body-xs ct-text-faint">
          Projections shown above are indicative only and not a commitment to any
          specific outcome. Past performance is not a reliable indicator of future
          results.
        </p>

        {/* Allocation diff */}
        {(fromAlloc.length > 0 || toAlloc.length > 0) && (
          <div className="admin-doc-stack admin-doc-stack--tight">
            <p className="stat-label">Allocation delta</p>
            <AllocationDiffTable from={fromAlloc} to={toAlloc} />
          </div>
        )}

        {/* Approved signers list */}
        {signers.length > 0 && (
          <div className="admin-doc-stack admin-doc-stack--compact">
            <p className="stat-label">Signers</p>
            <ul className="admin-doc-stack admin-doc-stack--micro">
              {signers.map((w) => (
                <li key={w} className="body-xs mono ct-text-muted">
                  {abbrWallet(w)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Error display */}
        {error && (
          <p className="body-xs ct-status-danger-bg px-3 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="admin-doc-stack admin-doc-stack--actions">
          {event.status === "pending" && (
            <>
              <div className="admin-doc-inline-row">
                {confirmingAction === "approve" ? (
                  <>
                    <Button
                      variant="primary"
                      onClick={handleApprove}
                      disabled={isPending}
                    >
                      {isPending ? "Processing…" : "Confirm approve"}
                    </Button>
                    <Button
                      variant="ghost"
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
                      onClick={handleApprove}
                      disabled={isPending}
                    >
                      {`Approve (${signerCount}/${requiredSigners} sigs)`}
                    </Button>
                    <Button
                      variant="ghost"
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
                <div className="admin-doc-inline-row">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Rejection reason…"
                    className="ct-input flex-1 body-sm"
                    disabled={isPending}
                  />
                  <Button
                    variant="secondary"
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
            <div className="admin-doc-inline-row">
              {confirmingAction === "execute" ? (
                <>
                  <Button variant="primary" onClick={handleExecute} disabled={isPending}>
                    {isPending ? "Executing…" : "Confirm execute"}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmingAction(null)} disabled={isPending}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button variant="primary" onClick={handleExecute} disabled={isPending}>
                  Execute (off-chain)
                </Button>
              )}
            </div>
          )}

          {event.status === "executed" && (
            <div className="admin-doc-stack admin-doc-stack--compact">
              <p className="body-xs ct-status-success">
                Auto-executed on approval · {formatAdminDateTime(new Date(event.executedAt))}
              </p>
              {event.txHash && (
                <p className="body-xs mono ct-text-muted">
                  tx: {event.txHash}
                </p>
              )}
            </div>
          )}

          {event.status === "cancelled" && (
            <p className="body-xs ct-text-muted">
              Signal cancelled.{" "}
              {event.triggerText.includes("[REJECTED:")
                ? event.triggerText.match(/\[REJECTED:(.*)\]/)?.[1]?.trim()
                : null}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
