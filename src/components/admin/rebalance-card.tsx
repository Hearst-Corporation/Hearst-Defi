"use client";

import { useState, useTransition } from "react";
import { z } from "zod";
import type { RebalanceEvent } from "@prisma/client";

import { cn } from "@/lib/cn";
import { Ptai } from "@/components/ui/ptai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BentoPanel } from "@/components/ui/bento";
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
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#15191C]">
      <table className="w-full table-fixed text-left text-[13px] tabular-nums">
        <thead>
          <tr className="border-b border-white/5">
            <th className="w-[34%] px-5 py-3 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
              Bucket
            </th>
            <th className="w-[22%] px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
              Current %
            </th>
            <th className="w-[22%] px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
              Target %
            </th>
            <th className="w-[22%] px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
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
              <tr key={bucket} className="border-b border-white/5 last:border-0">
                <td className="truncate px-5 py-3 font-mono text-[12px] capitalize text-zinc-300">
                  {bucket.replace(/_/g, " ")}
                </td>
                <td className="px-5 py-3 text-right text-zinc-400">
                  {fromPct.toFixed(1)}%
                </td>
                <td className="px-5 py-3 text-right text-zinc-300">
                  {toPct.toFixed(1)}%
                </td>
                <td
                  className={cn(
                    "px-5 py-3 text-right font-semibold",
                    delta > 0
                      ? "text-[#A7FB90]"
                      : delta < 0
                        ? "text-red-400"
                        : "text-zinc-400",
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
          <p className="text-[13px] text-zinc-400">
            Triggered {formatAdminDateTime(new Date(event.triggeredAt))}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12px] tabular-nums text-zinc-400">
            {signerCount}/{requiredSigners} sigs
          </p>
          {event.txHash && (
            <p className="font-mono text-[12px] text-zinc-400">
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
      <p className="text-[12px] text-zinc-600">
        Projections shown above are indicative only and not a commitment to any
        specific outcome. Past performance is not a reliable indicator of future
        results.
      </p>

      {/* Allocation diff */}
      {(fromAlloc.length > 0 || toAlloc.length > 0) && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
            Allocation delta
          </p>
          <AllocationDiffTable from={fromAlloc} to={toAlloc} />
        </div>
      )}

      {/* Approved signers list */}
      {signers.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
            Signers
          </p>
          <ul className="flex flex-col gap-1">
            {signers.map((w) => (
              <li key={w} className="font-mono text-[12px] text-zinc-400">
                {abbrWallet(w)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error display */}
      <div aria-live="polite">
        {error && (
          <p className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-[12px] text-red-400">
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
                  className="flex-1 rounded-lg border border-white/10 bg-[#15191C] px-4 py-2.5 text-[13px] text-white placeholder:text-zinc-600 focus:border-[#A7FB90]/40 focus:outline-none"
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
            <p className="text-[12px] text-[#A7FB90]">
              Auto-executed on approval · {formatAdminDateTime(new Date(event.executedAt))}
            </p>
            {event.txHash && (
              <p className="font-mono text-[12px] text-zinc-400">
                tx: {event.txHash}
              </p>
            )}
          </div>
        )}

        {event.status === "cancelled" && (
          <p className="text-[12px] text-zinc-400">
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
