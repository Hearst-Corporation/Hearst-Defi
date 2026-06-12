import "server-only";

import { prisma } from "@/lib/db";
import { loadLatestTimelineSnapshot } from "@/lib/data/timeline-snapshot";
import { adminDashboardVaultHref } from "@/lib/vaults/dashboard-scope";
import { listAllVaults } from "@/lib/vaults/resolver";
import { vaultLabel, vaultSlug } from "@/lib/vaults/slug";

// =============================================================================
// Cockpit Admin Dashboard — data loaders.
//
// All functions in this module are server-only. They supply the 3-column
// cockpit layout: Action Queue | Live Metrics | Live Ops + Audit Trail.
//
// Philosophy: prefer real Prisma data where available; fall back to a typed
// stub/mock so the UI never crashes on an empty dev DB.
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
}

// ---------------------------------------------------------------------------
// Types — Hero Strip KPIs
// ---------------------------------------------------------------------------

export interface HeroKpi {
  label: string;
  value: string;
  sublabel: string;
  provenance: "live" | "oracle" | "attested" | "estimated" | "manual" | "stale";
  /** true when value represents an alert / degraded state */
  alert?: boolean;
}

// ---------------------------------------------------------------------------
// Types — Live Metrics
// ---------------------------------------------------------------------------

export interface VaultLiveMetric {
  vaultId: string;
  vaultName: string;
  tvlUsdc: number;
  miningMarginScore: number;
  riskScore: number;
  /** milliseconds since last oracle update; null = unknown */
  oracleDelayMs: number | null;
  /** "neutral" | "long" | "short" | "hedge" */
  btcPosture: string;
  /** "live" | "paused" | "review" | "draft" | "closed" */
  status: string;
  /** Admin deep-link — dashboard fixture scope or deployment detail. */
  href: string;
  /** Yield vault timeline snapshot exists — other vaults stay empty until Phase 3. */
  hasTimelineData: boolean;
}

// ---------------------------------------------------------------------------
// Types — Live Ops
// ---------------------------------------------------------------------------

export type InngestJobStatus = "ok" | "err" | "pending" | "unknown";

export interface InngestJob {
  id: string;
  name: string;
  status: InngestJobStatus;
  /** last run ISO string or null */
  lastRunAt: string | null;
  /** error message if status === "err" */
  errorMsg: string | null;
}

export interface SentryStats {
  errors24h: number;
  warnings24h: number;
}

export interface OnChainEvent {
  id: string;
  type: "deposit" | "sign" | "swap" | "oracle_update" | "other";
  label: string;
  /** ISO string */
  occurredAt: string;
  txHash?: string;
}

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
}

// ---------------------------------------------------------------------------
// Types — Full Cockpit payload
// ---------------------------------------------------------------------------

export interface CockpitPayload {
  actionQueue: ActionQueueItem[];
  vaultMetrics: VaultLiveMetric[];
  inngestJobs: InngestJob[];
  sentryStats: SentryStats;
  onChainEvents: OnChainEvent[];
  auditTrail: AuditTrailEntry[];
}

// ---------------------------------------------------------------------------
// Stub Inngest job status.
// Inngest does not expose a public REST API for job health without its
// cloud dashboard; until we wire up a webhook / DB ping, we surface "unknown"
// for every job and let operators click through to the Inngest dashboard.
// ---------------------------------------------------------------------------

const INNGEST_JOB_STUBS: InngestJob[] = [
  { id: "rebalance", name: "Rebalance signal", status: "unknown", lastRunAt: null, errorMsg: null },
  { id: "distrib", name: "Distribution", status: "unknown", lastRunAt: null, errorMsg: null },
  { id: "oracle", name: "Oracle sync", status: "unknown", lastRunAt: null, errorMsg: null },
  { id: "proof-sync", name: "Proof sync", status: "unknown", lastRunAt: null, errorMsg: null },
];

// ---------------------------------------------------------------------------
// Infer Inngest job status from LlmRun history (proxy heuristic).
// Recent successful run within 2h → ok; recent failure → err; else unknown.
// ---------------------------------------------------------------------------

async function inferInngestJobs(): Promise<InngestJob[]> {
  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago
    const recentRuns = await prisma.llmRun.findMany({
      where: { createdAt: { gte: cutoff } },
      orderBy: { createdAt: "desc" },
      select: { agentName: true, status: true, createdAt: true },
      take: 100,
    });

    // Map agent names → canonical job ids
    const agentToJob: Record<string, string> = {
      "rebalancing-signal": "rebalance",
      "rebalance": "rebalance",
      "distribution": "distrib",
      "investor-memo": "distrib",
      "oracle": "oracle",
      "market-data": "oracle",
      "proof-sync": "proof-sync",
    };

    const jobMap = new Map<string, { status: InngestJobStatus; lastRunAt: string; errorMsg: string | null }>();

    for (const run of recentRuns) {
      const jobId = agentToJob[run.agentName] ?? null;
      if (!jobId || jobMap.has(jobId)) continue;
      const s: InngestJobStatus =
        run.status === "success" ? "ok" : run.status === "failed" ? "err" : "pending";
      jobMap.set(jobId, {
        status: s,
        lastRunAt: run.createdAt.toISOString(),
        errorMsg: run.status === "failed" ? `Last run failed (${run.agentName})` : null,
      });
    }

    return INNGEST_JOB_STUBS.map((stub) => {
      const found = jobMap.get(stub.id);
      if (!found) return stub;
      return { ...stub, ...found };
    });
  } catch {
    return INNGEST_JOB_STUBS;
  }
}

// ---------------------------------------------------------------------------
// Infer Sentry-equivalent stats from LlmRun failure counts (24h window).
// Replace with a real Sentry API call once the DSN is wired up.
// ---------------------------------------------------------------------------

async function inferSentryStats(): Promise<SentryStats> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [errors, timeouts] = await Promise.all([
      prisma.llmRun.count({ where: { status: "failed", createdAt: { gte: since } } }),
      prisma.llmRun.count({ where: { status: "timeout", createdAt: { gte: since } } }),
    ]);
    return { errors24h: errors, warnings24h: timeouts };
  } catch {
    return { errors24h: 0, warnings24h: 0 };
  }
}

// ---------------------------------------------------------------------------
// Derive action queue from live Prisma data.
// ---------------------------------------------------------------------------

async function buildActionQueue(): Promise<ActionQueueItem[]> {
  const items: ActionQueueItem[] = [];
  const now = new Date();

  try {
    // ── P0: Mining margin red (latest snapshot miningMarginScore < 15) ──────
    const latestSnapshot = await loadLatestTimelineSnapshot();
    if (latestSnapshot && latestSnapshot.miningMarginScore < 15) {
      items.push({
        id: "mining-margin-red",
        type: "mining.margin.red",
        severity: "P0",
        title: "Mining margin critical",
        context: `Margin score ${latestSnapshot.miningMarginScore}/100 — below 15 threshold`,
        href: "/admin/dashboard",
        createdAt: latestSnapshot.takenAt.toISOString(),
      });
    }

    // ── P0: Oracle stale (latest MiningMetric > 6h old) ─────────────────────
    const latestMetric = await prisma.miningMetric.findFirst({
      orderBy: { takenAt: "desc" },
    });
    const staleCutoff6h = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    if (!latestMetric || latestMetric.takenAt < staleCutoff6h) {
      items.push({
        id: "oracle-stale",
        type: "oracle.stale",
        severity: "P0",
        title: "Oracle feed stale",
        context: latestMetric
          ? `Last update ${Math.round((now.getTime() - latestMetric.takenAt.getTime()) / 3_600_000)}h ago`
          : "No oracle data on record",
        href: "/admin/monitoring",
        createdAt: latestMetric?.takenAt.toISOString() ?? now.toISOString(),
      });
    }

    // ── P1: Rebalance signal awaiting action (status = "pending") ────────────
    const pendingRebalance = await prisma.rebalanceEvent.findFirst({
      where: { status: "pending" },
      orderBy: { triggeredAt: "desc" },
    });
    if (pendingRebalance) {
      items.push({
        id: `rebalance-${pendingRebalance.id}`,
        type: "rebalance.signal",
        severity: "P1",
        title: "Rebalance signal awaiting action",
        context: pendingRebalance.triggerText ?? "Engine-proposed rebalancing",
        href: "/admin/signals",
        createdAt: pendingRebalance.triggeredAt.toISOString(),
      });
    }

    // ── P1: Attestation overdue (most recent mining proof > 30d old) ─────────
    const stale30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const overdueProof = await prisma.proof.findFirst({
      where: {
        proofType: "mining_attestation",
        postedAt: { lt: stale30d },
      },
      orderBy: { postedAt: "asc" },
    });
    if (overdueProof) {
      items.push({
        id: `attestation-overdue-${overdueProof.id}`,
        type: "attestation.overdue",
        severity: "P1",
        title: "Attestation overdue",
        context: `${overdueProof.proofType} proof last posted ${Math.round((now.getTime() - overdueProof.postedAt.getTime()) / 86_400_000)}d ago`,
        href: "/admin/proofs",
        createdAt: overdueProof.postedAt.toISOString(),
      });
    }

    // ── P0: Multisig proposals in SIGNING state (awaiting required signatures) ──
    const signingProposals = await prisma.governanceProposal.findMany({
      where: { state: "SIGNING" },
      include: {
        signatures: {
          where: { decision: "approve" },
          select: { signerAddress: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    for (const proposal of signingProposals) {
      const approvedCount = proposal.signatures.length;
      items.push({
        id: `multisig-sign-${proposal.id}`,
        type: "multisig.sign",
        severity: "P0",
        title: `Governance proposal requires signatures`,
        context: `${approvedCount} of ${proposal.requiredSigners} signatures — ${proposal.actionType}`,
        href: `/admin/governance/proposal/${proposal.id}`,
        createdAt: proposal.createdAt.toISOString(),
      });
    }

    // ── P0: Vault deployments with status "paused" ───────────────────────────
    const pausedVaults = await prisma.vaultDeployment.findMany({
      where: { status: "paused" },
      orderBy: { pausedAt: "asc" },
      select: { id: true, name: true, ticker: true, pausedAt: true, createdAt: true },
    });
    for (const vault of pausedVaults) {
      items.push({
        id: `vault-paused-${vault.id}`,
        type: "vault.paused",
        severity: "P0",
        title: `Vault paused: ${vault.name}`,
        context: vault.ticker,
        href: `/admin/vaults/${vault.id}`,
        createdAt: (vault.pausedAt ?? vault.createdAt).toISOString(),
      });
    }

    // ── P1: Distribution periods with approvals started but below threshold ──
    // Mirror of distributions/actions.ts: REQUIRED_SIGNERS = 2.
    // A period is actionable when at least one approval exists but count < threshold.
    const DISTRIBUTION_REQUIRED_SIGNERS = 2;
    const pendingApprovalGroups = await prisma.distributionApproval.groupBy({
      by: ["period"],
      _count: { signerWallet: true },
    });
    for (const group of pendingApprovalGroups) {
      const count = group._count.signerWallet;
      if (count < DISTRIBUTION_REQUIRED_SIGNERS) {
        items.push({
          id: `distribution-approve-${group.period}`,
          type: "distribution.approve",
          severity: "P1",
          title: `Distribution approval pending: ${group.period}`,
          context: `${count} of ${DISTRIBUTION_REQUIRED_SIGNERS} signers confirmed`,
          href: "/admin/distributions",
          createdAt: now.toISOString(),
        });
      }
    }

    // ── P1: KYC inquiries that need admin review ─────────────────────────────
    // KycInquiry rows represent server-claimed inquiry links (created before the
    // webhook arrives). Rows with no matching approved KycEvent are flagged for
    // review. We proxy this by looking for KycInquiry rows whose userId does not
    // map to an Investor with kycStatus "approved".
    const pendingKyc = await prisma.kycInquiry.findMany({
      where: {
        userId: {
          // Exclude investors already fully approved
          notIn: await prisma.investor.findMany({
            where: { kycStatus: "approved" },
            select: { userId: true },
          }).then((rows) => rows.map((r) => r.userId)),
        },
      },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    for (const inquiry of pendingKyc) {
      items.push({
        id: `kyc-review-${inquiry.inquiryId}`,
        type: "kyc.review",
        severity: "P1",
        title: "KYC inquiry needs review",
        context: `Inquiry ${inquiry.inquiryId}`,
        href: `/admin/customers`,
        createdAt: inquiry.createdAt.toISOString(),
      });
    }

    // ── TODO: lp.redemption — no Redemption model exists yet (out of scope) ──
    // ── TODO: memo.publish  — no clear "ready to publish" data source yet    ──
  } catch {
    // DB unavailable — return empty queue (no false P0s)
  }

  // Sort: P0 first, then P1, then P2; within severity by createdAt desc
  const order: Record<ActionSeverity, number> = { P0: 0, P1: 1, P2: 2 };
  return items.sort(
    (a, b) =>
      order[a.severity] - order[b.severity] ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

// ---------------------------------------------------------------------------
// Live metrics per vault
// ---------------------------------------------------------------------------

async function buildVaultMetrics(): Promise<VaultLiveMetric[]> {
  try {
    const [vaultRefs, latestSnapshot, latestMetric] = await Promise.all([
      listAllVaults({ status: "live-or-paused" }),
      loadLatestTimelineSnapshot(),
      prisma.miningMetric.findFirst({ orderBy: { takenAt: "desc" } }),
    ]);

    const oracleDelayMs = latestMetric
      ? Date.now() - latestMetric.takenAt.getTime()
      : null;

    return vaultRefs.map((ref) => {
      const name =
        ref.kind === "fixture"
          ? ref.fixture.label
          : vaultLabel(ref);
      const isYield =
        ref.kind === "fixture"
          ? ref.fixture.id === "yield"
          : false;
      const hasTimelineData = isYield && latestSnapshot !== null;

      const href =
        ref.kind === "fixture"
          ? adminDashboardVaultHref(ref.fixture.id)
          : `/admin/vaults/${vaultSlug(ref)}`;

      return {
        vaultId:
          ref.kind === "fixture" ? ref.fixture.id : ref.deployment.id,
        vaultName: name,
        tvlUsdc: hasTimelineData ? (latestSnapshot.aumUsdc.toNumber() ?? 0) : 0,
        miningMarginScore: hasTimelineData ? latestSnapshot.miningMarginScore : 0,
        riskScore: hasTimelineData ? latestSnapshot.riskScore : 0,
        oracleDelayMs,
        btcPosture: hasTimelineData ? latestSnapshot.mode : "neutral",
        status: ref.kind === "fixture" ? "live" : ref.deployment.status,
        href,
        hasTimelineData,
      };
    });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// On-chain events from RebalanceEvent + Distribution (last 5)
// ---------------------------------------------------------------------------

async function buildOnChainEvents(): Promise<OnChainEvent[]> {
  try {
    const [rebalances, distributions] = await Promise.all([
      prisma.rebalanceEvent.findMany({
        orderBy: { triggeredAt: "desc" },
        take: 3,
        select: { id: true, triggeredAt: true, status: true, triggerText: true },
      }),
      prisma.distribution.findMany({
        orderBy: { distributedAt: "desc" },
        take: 2,
        select: { id: true, distributedAt: true, period: true },
      }),
    ]);

    const events: OnChainEvent[] = [
      ...rebalances.map((r) => ({
        id: r.id,
        type: "swap" as const,
        label: `Rebalance · ${r.triggerText ?? r.status}`,
        occurredAt: r.triggeredAt.toISOString(),
      })),
      ...distributions.map((d) => ({
        id: d.id,
        type: "deposit" as const,
        label: `Distribution ${d.period ?? d.id.slice(0, 8)}`,
        occurredAt: d.distributedAt.toISOString(),
      })),
    ];

    return events
      .sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
      )
      .slice(0, 5);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Audit trail — last 20 AdminAudit rows
// ---------------------------------------------------------------------------

async function buildAuditTrail(): Promise<AuditTrailEntry[]> {
  try {
    const rows = await prisma.adminAudit.findMany({
      orderBy: { occurredAt: "desc" },
      take: 20,
      select: {
        id: true,
        occurredAt: true,
        actorWallet: true,
        action: true,
        entityType: true,
        entityId: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      occurredAt: r.occurredAt.toISOString(),
      actorWallet: r.actorWallet,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
    }));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main entry — load everything in parallel
// ---------------------------------------------------------------------------

export async function loadCockpitPayload(): Promise<CockpitPayload> {
  const [actionQueue, vaultMetrics, inngestJobs, sentryStats, onChainEvents, auditTrail] =
    await Promise.all([
      buildActionQueue(),
      buildVaultMetrics(),
      inferInngestJobs(),
      inferSentryStats(),
      buildOnChainEvents(),
      buildAuditTrail(),
    ]);

  return {
    actionQueue,
    vaultMetrics,
    inngestJobs,
    sentryStats,
    onChainEvents,
    auditTrail,
  };
}
