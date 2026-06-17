// Demo builder — Admin Cockpit payload.
//
// Pure, deterministic builder. No Prisma, no fetch, no I/O.
// Called only when canRunDemoProvider() === true (never production).
//
// Honesty rules:
//   - onChainEvents carry txHash: undefined (field omitted) — no fake BaseScan link.
//   - miningMarginScore / riskScore are clearly indicative, provenance not "live".
//   - APY ranges are always shown as ranges (9.4–12.8 %), never a single point.
//   - No on-chain txHash is emitted (field intentionally omitted on all events),
//     so no fake BaseScan link is rendered.

import type {
  ActionQueueItem,
  AuditTrailEntry,
  CockpitPayload,
  InngestJob,
  OnChainEvent,
  SentryStats,
  VaultLiveMetric,
} from "@/lib/data/cockpit";

// ---------------------------------------------------------------------------
// Action Queue
// ---------------------------------------------------------------------------

function buildDemoActionQueue(): ActionQueueItem[] {
  const base = "2026-06-14T08:00:00.000Z";

  return [
    {
      id: "demo-oracle-stale",
      type: "oracle.stale",
      severity: "P0",
      title: "Oracle feed stale [DEMO]",
      context: "Simulated: last market sync 7h 12m ago · threshold 6h",
      href: "/admin/monitoring",
      createdAt: base,
    },
    {
      id: "demo-multisig-sign-1",
      type: "multisig.sign",
      severity: "P0",
      title: "Governance proposal requires signatures [DEMO]",
      context: "1 of 3 approvals · DISTRIBUTION_APPROVE",
      href: "/admin/governance",
      createdAt: "2026-06-14T07:30:00.000Z",
    },
    {
      id: "demo-rebalance-signal",
      type: "rebalance.signal",
      severity: "P1",
      title: "Rebalance signal awaiting action [DEMO]",
      context: "Simulated: BTC posture drift · hedge increase recommended",
      href: "/admin/signals",
      createdAt: "2026-06-14T06:00:00.000Z",
    },
    {
      id: "demo-distribution-approve",
      type: "distribution.approve",
      severity: "P1",
      title: "Distribution approval pending: 2026-06 [DEMO]",
      context: "1 of 2 approvals recorded",
      href: "/admin/distributions",
      createdAt: "2026-06-13T15:00:00.000Z",
    },
    {
      id: "demo-kyc-review",
      type: "kyc.review",
      severity: "P1",
      title: "KYC inquiry needs review [DEMO]",
      context: "Inquiry demo-inq-00001 · awaiting manual review",
      href: "/admin/customers",
      createdAt: "2026-06-13T10:00:00.000Z",
    },
  ];
}

// ---------------------------------------------------------------------------
// Vault Live Metrics
// ---------------------------------------------------------------------------

function buildDemoVaultMetrics(): VaultLiveMetric[] {
  return [
    {
      vaultId: "yield",
      vaultName: "Hearst Yield Vault [DEMO]",
      tvlUsdc: 25_000_000,
      miningMarginScore: 64,
      riskScore: 31,
      oracleDelayMs: 25_920_000, // 7.2 h — simulated stale to match P0 above
      btcPosture: "hedge",
      status: "live",
      href: "/admin/dashboard?vault=yield",
      hasTimelineData: true,
    },
    {
      vaultId: "defensive",
      vaultName: "Hearst Defensive Vault [DEMO]",
      tvlUsdc: 1_100_000,
      miningMarginScore: 81,
      riskScore: 18,
      oracleDelayMs: 3_600_000, // 1 h — healthy
      btcPosture: "neutral",
      status: "live",
      href: "/admin/dashboard?vault=defensive",
      hasTimelineData: true,
    },
  ];
}

// ---------------------------------------------------------------------------
// Inngest Jobs
// ---------------------------------------------------------------------------

function buildDemoInngestJobs(): InngestJob[] {
  return [
    {
      id: "rebalance",
      name: "Rebalance signal",
      status: "ok",
    },
    {
      id: "distrib",
      name: "Distribution",
      status: "pending",
    },
    {
      id: "oracle",
      name: "Oracle sync",
      status: "err",
    },
    {
      id: "proof-sync",
      name: "Proof sync",
      status: "ok",
    },
  ];
}

// ---------------------------------------------------------------------------
// Sentry Stats
// ---------------------------------------------------------------------------

function buildDemoSentryStats(): SentryStats {
  return {
    errors24h: 3,
    warnings24h: 7,
  };
}

// ---------------------------------------------------------------------------
// On-Chain Events
// NOTE: txHash is intentionally omitted (field is optional in OnChainEvent).
// This prevents any fake BaseScan link or attested badge from rendering.
// The DEMO_SENTINEL_HASH is NOT used here — it belongs only on proof digests,
// not on event tx pointers.
// ---------------------------------------------------------------------------

function buildDemoOnChainEvents(): OnChainEvent[] {
  return [
    {
      id: "demo-evt-001",
      type: "oracle_update",
      label: "Oracle heartbeat [DEMO — simulated]",
      occurredAt: "2026-06-14T01:00:00.000Z",
      // txHash omitted — no fake on-chain reference
    },
    {
      id: "demo-evt-002",
      type: "swap",
      label: "Rebalance swap BTC/USDC [DEMO — simulated]",
      occurredAt: "2026-06-13T18:30:00.000Z",
      // txHash omitted
    },
    {
      id: "demo-evt-003",
      type: "deposit",
      label: "Distribution 2026-05 [DEMO — simulated]",
      occurredAt: "2026-06-01T12:00:00.000Z",
      // txHash omitted
    },
    {
      id: "demo-evt-004",
      type: "sign",
      label: "Multisig approval — governance prop #1 [DEMO — simulated]",
      occurredAt: "2026-06-14T07:31:00.000Z",
      // txHash omitted
    },
  ];
}

// ---------------------------------------------------------------------------
// Audit Trail
// ---------------------------------------------------------------------------

function buildDemoAuditTrail(): AuditTrailEntry[] {
  return [
    {
      id: "demo-audit-001",
      occurredAt: "2026-06-14T08:01:00.000Z",
      actorWallet: "0xDemo…Admin1",
      action: "REBALANCE_SIGNAL_TRIGGERED",
      entityType: "RebalanceEvent",
      entityId: "demo-rebalance-signal",
    },
    {
      id: "demo-audit-002",
      occurredAt: "2026-06-14T07:31:00.000Z",
      actorWallet: "0xDemo…Signer1",
      action: "GOVERNANCE_PROPOSAL_SIGNED",
      entityType: "GovernanceProposal",
      entityId: "demo-multisig-sign-1",
    },
    {
      id: "demo-audit-003",
      occurredAt: "2026-06-13T15:05:00.000Z",
      actorWallet: "0xDemo…Admin1",
      action: "DISTRIBUTION_APPROVAL_SUBMITTED",
      entityType: "DistributionApproval",
      entityId: "demo-distribution-approve",
    },
    {
      id: "demo-audit-004",
      occurredAt: "2026-06-13T10:02:00.000Z",
      actorWallet: "0xDemo…Admin2",
      action: "KYC_REVIEW_OPENED",
      entityType: "KycInquiry",
      entityId: "demo-inq-00001",
    },
    {
      id: "demo-audit-005",
      occurredAt: "2026-06-12T09:00:00.000Z",
      actorWallet: "0xDemo…Admin1",
      action: "VAULT_STATUS_REVIEWED",
      entityType: "VaultDeployment",
      entityId: "yield",
    },
  ];
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function buildDemoCockpitPayload(): CockpitPayload {
  return {
    actionQueue: buildDemoActionQueue(),
    vaultMetrics: buildDemoVaultMetrics(),
    inngestJobs: buildDemoInngestJobs(),
    sentryStats: buildDemoSentryStats(),
    onChainEvents: buildDemoOnChainEvents(),
    auditTrail: buildDemoAuditTrail(),
  };
}
