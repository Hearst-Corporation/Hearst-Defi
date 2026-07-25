import "server-only";

import { unstable_cache } from "next/cache";

import {
  ADMIN_DASHBOARD_REVALIDATE_SEC,
  coerceCachedDate,
  loadUnavailable,
  type Loaded,
} from "@/lib/data/admin-dashboard-cache";
import { prisma } from "@/lib/db";
import { loadLatestMiningMetricRow } from "@/lib/data/mining-metric-row";
import { loadLatestTimelineSnapshot } from "@/lib/data/timeline-snapshot";
import { adminSignalsVaultHref } from "@/lib/vaults/dashboard-scope";
import type { Provenance } from "@/lib/provenance";
// =============================================================================
// Cockpit Admin Dashboard — data loaders.
//
// All functions in this module are server-only. They supply the operator
// queue and the audit trail of /admin/dashboard.
//
// Honesty policy (non-negotiable): a failed DB read is reported as
// `unavailable` through the Loaded<T> envelope — NEVER as an empty array or a
// zero. "The read failed" and "the table is empty" are different facts; the
// UI must be able to render "unavailable — database read failed" instead of
// "Clear" / "Empty". No typed stub, no fabricated fallback.
// =============================================================================

// ---------------------------------------------------------------------------
// Types — Action Queue
// ---------------------------------------------------------------------------

export type ActionSeverity = "P0" | "P1" | "P2";

export type ActionType =
  | "multisig.sign"
  | "oracle.stale"
  | "vault.paused"
  | "distribution.approve"
  | "kyc.review"
  | "lp.redemption"
  | "rebalance.signal"
  | "memo.publish"
  | "mining.margin.red"
  | "attestation.overdue";

export interface ActionQueueItem {
  id: string;
  type: ActionType;
  severity: ActionSeverity;
  title: string;
  context: string;
  href?: string;
  /** ISO string */
  createdAt: string;
  /** Provenance travels FROM the loader — the render layer never invents it.
   *  Queue items are derived fresh from direct DB reads at load time. */
  provenance: Provenance;
}

// ---------------------------------------------------------------------------
// Types — Hero Strip KPIs
// ---------------------------------------------------------------------------
//
// `HeroKpi` is a PRESENTATION view-model, not a data DTO — it is built by the
// UI-presenter layer (src/lib/admin/*-kpi-strip.ts) and never emitted by the
// server-only loaders below. Its canonical home is the presenter layer; it is
// re-exported here only for backward compatibility with existing importers.
export type { HeroKpi, HeroKpiProvenance } from "@/lib/admin/kpi-strip-view";

// ---------------------------------------------------------------------------
// Types — Audit Trail
// ---------------------------------------------------------------------------

export interface AuditTrailEntry {
  id: string;
  occurredAt: string;
  actorWallet: string;
  action: string;
  entityType: string;
  entityId: string;
  /** AdminAudit rows are written by application code on operator actions —
   *  an applicative INSERT is `manual`, never `attested` (no third party). */
  provenance: Provenance;
}

// ---------------------------------------------------------------------------
// Types — Full Cockpit payload
// ---------------------------------------------------------------------------
//
// The retired fields (vaultMetrics / inngestJobs / sentryStats / onChainEvents)
// were computed on every load and rendered NOWHERE — dead weight removed
// 2026-07-26 (mission E1). Re-add a field only together with its consumer.

export interface CockpitPayload {
  actionQueue: Loaded<ActionQueueItem[]>;
  auditTrail: Loaded<AuditTrailEntry[]>;
}

// ---------------------------------------------------------------------------
// Operational thresholds — hand-tuned, no external source. These are operator
// judgment calls, not measurements; they are named so the copy that cites them
// cannot pretend they came from a spec or an oracle.
// ---------------------------------------------------------------------------

/** Mining margin score below this reads as critical (P0). Hand-tuned. */
const MINING_MARGIN_RED_THRESHOLD = 15;

/** Legacy payout rail approval threshold. Hand-set — the retired payout rail
 *  has NO quorum column in the schema (unlike VaultDeployment.requiredSigners
 *  and GovernanceProposal.requiredSigners). The queue copy says so. */
const LEGACY_PAYOUT_REQUIRED_APPROVALS = 2;

/** Oracle feed older than this reads as stale (P0). Hand-tuned. */
const ORACLE_STALE_CUTOFF_MS = 6 * 60 * 60 * 1000;

/** Mining attestation older than this reads as overdue (P1). Hand-tuned. */
const ATTESTATION_OVERDUE_MS = 30 * 24 * 60 * 60 * 1000;

/** Every queue item is derived fresh from direct DB reads at load time. */
const QUEUE_PROVENANCE: Provenance = "live";

/** Display cap of the audit trail read — stated in the UI copy. */
export const AUDIT_TRAIL_DISPLAY_CAP = 20;

// ---------------------------------------------------------------------------
// Derive action queue from live Prisma data.
// ---------------------------------------------------------------------------

async function buildActionQueue(): Promise<Loaded<ActionQueueItem[]>> {
  const items: ActionQueueItem[] = [];
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - ORACLE_STALE_CUTOFF_MS);
  const overdueCutoff = new Date(now.getTime() - ATTESTATION_OVERDUE_MS);

  try {
    const [
      latestSnapshot,
      latestMetric,
      pendingRebalance,
      overdueProof,
      signingProposals,
      pausedVaults,
      pendingApprovalGroups,
      approvedInvestorUserIds,
    ] = await Promise.all([
      loadLatestTimelineSnapshot(),
      loadLatestMiningMetricRow(),
      prisma.rebalanceEvent.findFirst({
        where: { status: "pending" },
        orderBy: { triggeredAt: "desc" },
        select: {
          id: true,
          triggeredAt: true,
          triggerText: true,
          vaultRef: true,
        },
      }),
      prisma.proof.findFirst({
        where: {
          proofType: "mining_attestation",
          postedAt: { lt: overdueCutoff },
        },
        orderBy: { postedAt: "asc" },
      }),
      prisma.governanceProposal.findMany({
        where: { state: "SIGNING" },
        include: {
          signatures: {
            where: { decision: "approve" },
            select: { signerAddress: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.vaultDeployment.findMany({
        where: { status: "paused" },
        orderBy: { pausedAt: "asc" },
        select: { id: true, name: true, ticker: true, pausedAt: true, createdAt: true },
      }),
      prisma.distributionApproval.groupBy({
        by: ["period"],
        _count: { signerWallet: true },
      }),
      prisma.investor.findMany({
        where: { kycStatus: "approved" },
        select: { userId: true },
      }),
    ]);

    const pendingKyc = await prisma.kycInquiry.findMany({
      where: {
        userId: {
          notIn: approvedInvestorUserIds.map((row) => row.userId),
        },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    if (latestSnapshot && latestSnapshot.miningMarginScore < MINING_MARGIN_RED_THRESHOLD) {
      items.push({
        id: "mining-margin-red",
        type: "mining.margin.red",
        severity: "P0",
        title: "Mining margin critical",
        context: `Margin score ${latestSnapshot.miningMarginScore}/100 · below the hand-set ${MINING_MARGIN_RED_THRESHOLD} threshold`,
        href: "/admin/dashboard",
        createdAt: (coerceCachedDate(latestSnapshot.takenAt) ?? latestSnapshot.takenAt).toISOString(),
        provenance: QUEUE_PROVENANCE,
      });
    }

    if (!latestMetric || latestMetric.takenAt < staleCutoff) {
      items.push({
        id: "oracle-stale",
        type: "oracle.stale",
        severity: "P0",
        title: "Oracle feed stale",
        context: latestMetric
          ? `Last market sync ${Math.round((now.getTime() - latestMetric.takenAt.getTime()) / 3_600_000)}h ago`
          : "No oracle update recorded",
        href: "/admin/monitoring",
        createdAt: latestMetric
          ? (coerceCachedDate(latestMetric.takenAt) ?? latestMetric.takenAt).toISOString()
          : now.toISOString(),
        provenance: QUEUE_PROVENANCE,
      });
    }

    if (pendingRebalance) {
      items.push({
        id: `rebalance-${pendingRebalance.id}`,
        type: "rebalance.signal",
        severity: "P1",
        title: "Rebalance signal awaiting action",
        context: pendingRebalance.triggerText ?? "Engine trigger armed for operator review",
        href: pendingRebalance.vaultRef
          ? adminSignalsVaultHref(pendingRebalance.vaultRef)
          : "/admin/signals",
        createdAt: pendingRebalance.triggeredAt.toISOString(),
        provenance: QUEUE_PROVENANCE,
      });
    }

    if (overdueProof) {
      items.push({
        id: `attestation-overdue-${overdueProof.id}`,
        type: "attestation.overdue",
        severity: "P1",
        title: "Attestation overdue",
        context: `Last mining attestation posted ${Math.round((now.getTime() - overdueProof.postedAt.getTime()) / 86_400_000)}d ago`,
        href: "/admin/proofs",
        createdAt: overdueProof.postedAt.toISOString(),
        provenance: QUEUE_PROVENANCE,
      });
    }

    for (const proposal of signingProposals) {
      const approvedCount = proposal.signatures.length;
      items.push({
        id: `multisig-sign-${proposal.id}`,
        type: "multisig.sign",
        severity: "P0",
        title: `Governance proposal requires signatures`,
        context: `${approvedCount} of ${proposal.requiredSigners} approvals · ${proposal.actionType}`,
        href: `/admin/governance/proposal/${proposal.id}`,
        createdAt: proposal.createdAt.toISOString(),
        provenance: QUEUE_PROVENANCE,
      });
    }

    for (const vault of pausedVaults) {
      items.push({
        id: `vault-paused-${vault.id}`,
        type: "vault.paused",
        severity: "P0",
        title: `Vault paused: ${vault.name}`,
        context: `${vault.ticker} · operator review required`,
        href: `/admin/vaults/${vault.id}`,
        createdAt: (vault.pausedAt ?? vault.createdAt).toISOString(),
        provenance: QUEUE_PROVENANCE,
      });
    }

    for (const group of pendingApprovalGroups) {
      const count = group._count.signerWallet;
      if (count < LEGACY_PAYOUT_REQUIRED_APPROVALS) {
        items.push({
          id: `distribution-approve-${group.period}`,
          type: "distribution.approve",
          severity: "P1",
          title: `Legacy payout approval pending: ${group.period}`,
          context: `${count} of ${LEGACY_PAYOUT_REQUIRED_APPROVALS} approvals recorded · threshold hand-set (retired rail, no quorum source)`,
          href: "/admin/distributions",
          createdAt: now.toISOString(),
          provenance: QUEUE_PROVENANCE,
        });
      }
    }

    for (const inquiry of pendingKyc) {
      items.push({
        id: `kyc-review-${inquiry.inquiryId}`,
        type: "kyc.review",
        severity: "P1",
        title: "KYC inquiry needs review",
        context: `Inquiry ${inquiry.inquiryId} · awaiting manual review`,
        href: `/admin/customers`,
        createdAt: inquiry.createdAt.toISOString(),
        provenance: QUEUE_PROVENANCE,
      });
    }

    // ── TODO: lp.redemption — no Redemption model exists yet (out of scope) ──
    // ── TODO: memo.publish  — no clear "ready to publish" data source yet    ──
  } catch (err) {
    // DB unavailable — say so. An unreadable queue is NOT a clear queue.
    return loadUnavailable(err);
  }

  // Sort: P0 first, then P1, then P2; within severity by createdAt desc
  const order: Record<ActionSeverity, number> = { P0: 0, P1: 1, P2: 2 };
  const sorted = items.sort(
    (a, b) =>
      order[a.severity] - order[b.severity] ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return { status: "ok", data: sorted };
}

// ---------------------------------------------------------------------------
// Audit trail — most recent AdminAudit rows (display cap stated in the UI)
// ---------------------------------------------------------------------------

async function buildAuditTrail(): Promise<Loaded<AuditTrailEntry[]>> {
  try {
    const rows = await prisma.adminAudit.findMany({
      orderBy: { occurredAt: "desc" },
      take: AUDIT_TRAIL_DISPLAY_CAP,
      select: {
        id: true,
        occurredAt: true,
        actorWallet: true,
        action: true,
        entityType: true,
        entityId: true,
      },
    });
    return {
      status: "ok",
      data: rows.map((r) => ({
        id: r.id,
        occurredAt: r.occurredAt.toISOString(),
        actorWallet: r.actorWallet,
        action: r.action,
        entityType: r.entityType,
        entityId: r.entityId,
        provenance: "manual",
      })),
    };
  } catch (err) {
    // DB unavailable — an unreadable trail is NOT an empty trail.
    return loadUnavailable(err);
  }
}

// ---------------------------------------------------------------------------
// Main entry — load everything in parallel
// ---------------------------------------------------------------------------

async function loadCockpitPayloadFromDb(): Promise<CockpitPayload> {
  const [actionQueue, auditTrail] = await Promise.all([
    buildActionQueue(),
    buildAuditTrail(),
  ]);

  return { actionQueue, auditTrail };
}

const fetchCockpitPayloadCached = unstable_cache(
  loadCockpitPayloadFromDb,
  ["admin-cockpit-payload"],
  {
    revalidate: ADMIN_DASHBOARD_REVALIDATE_SEC,
    tags: ["admin-cockpit"],
  },
);

export async function loadCockpitPayload(): Promise<CockpitPayload> {
  return fetchCockpitPayloadCached();
}
