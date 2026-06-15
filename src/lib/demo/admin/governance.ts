// Demo governance proposal queue builder.
//
// Pure, deterministic — no Prisma, no fetch, no I/O. Returns a ProposalRow[]
// that matches the shape emitted by loadProposalQueue() in
// src/lib/governance/actions.ts so the GovernancePage component receives a
// structurally identical payload in demo mode.
//
// Provenance: "simulated" — not drawn from any real signer, vault, or on-chain
// event. IDs use "demo-gov-*" prefix so they are visually distinguishable.
//
// PTAI narrative is embedded in the justification fields of ProposalDetail
// (not ProposalRow — the queue only shows metadata). For the queue rows the
// actionType + state combination already conveys the full lifecycle arc.
//
// Forbidden words NOT present: guarantee, promise, certain, will deliver, risk-free.

import type { ProposalRow } from "@/lib/governance/actions";

// ---------------------------------------------------------------------------
// Shared demo constants
// ---------------------------------------------------------------------------

/** Vault id / ticker referenced by every demo proposal — mirrors builders.ts. */
const DEMO_VAULT_DEPLOYMENT_ID = "demo-vault-deployment-hyv-a";
const DEMO_VAULT_TICKER = "HYV-A";

/** A stable demo proposer address (not a real signer). */
const DEMO_PROPOSER = "0xDe000000000000000000000000000000000000A1";

/** Required signer quorum used across all demo proposals. */
const REQUIRED_SIGNERS = 2;

// ---------------------------------------------------------------------------
// Time helpers — relative to call time so the queue always reads "recent"
// ---------------------------------------------------------------------------

function daysAgo(d: number, now: Date): Date {
  return new Date(now.getTime() - d * 86_400_000);
}

function hoursFromNow(h: number, now: Date): Date {
  return new Date(now.getTime() + h * 3_600_000);
}

// ---------------------------------------------------------------------------
// buildDemoGovernanceQueue
// ---------------------------------------------------------------------------

/**
 * Returns a set of simulated governance proposals covering the four active
 * states (DRAFT, SIGNING, TIMELOCK, QUEUED) plus one terminal state
 * (EXECUTED) so the queue renders a realistic lifecycle arc.
 *
 * Ordered newest-first, mirroring the live loadProposalQueue() orderBy.
 */
export function buildDemoGovernanceQueue(): ProposalRow[] {
  const now = new Date();

  const proposals: ProposalRow[] = [
    // ---- 1. DRAFT — fee schedule review just initiated ----
    {
      id: "demo-gov-draft-fees",
      vaultDeploymentId: DEMO_VAULT_DEPLOYMENT_ID,
      vaultTicker: DEMO_VAULT_TICKER,
      actionType: "updateFees",
      state: "DRAFT",
      proposedBy: DEMO_PROPOSER,
      requiredSigners: REQUIRED_SIGNERS,
      approvalCount: 0,
      rejectionCount: 0,
      cancelCount: 0,
      createdAt: daysAgo(0, now),
      submittedAt: null,
      etaAt: null,
    },

    // ---- 2. SIGNING — capacity cap increase, 1 of 2 sigs collected ----
    {
      id: "demo-gov-signing-caps",
      vaultDeploymentId: DEMO_VAULT_DEPLOYMENT_ID,
      vaultTicker: DEMO_VAULT_TICKER,
      actionType: "updateCaps",
      state: "SIGNING",
      proposedBy: DEMO_PROPOSER,
      requiredSigners: REQUIRED_SIGNERS,
      approvalCount: 1,
      rejectionCount: 0,
      cancelCount: 0,
      createdAt: daysAgo(2, now),
      submittedAt: daysAgo(2, now),
      etaAt: null,
    },

    // ---- 3. TIMELOCK — fee sweep approved, 48-hour timelock in progress ----
    {
      id: "demo-gov-timelock-sweep",
      vaultDeploymentId: DEMO_VAULT_DEPLOYMENT_ID,
      vaultTicker: DEMO_VAULT_TICKER,
      actionType: "sweepFees",
      state: "TIMELOCK",
      proposedBy: DEMO_PROPOSER,
      requiredSigners: REQUIRED_SIGNERS,
      approvalCount: 2,
      rejectionCount: 0,
      cancelCount: 0,
      createdAt: daysAgo(5, now),
      submittedAt: daysAgo(5, now),
      // ETA = 48 h after submission; still ~19 h ahead
      etaAt: hoursFromNow(19, now),
    },

    // ---- 4. QUEUED — signer rotation queued, waiting for timelock clock ----
    {
      id: "demo-gov-queued-signers",
      vaultDeploymentId: DEMO_VAULT_DEPLOYMENT_ID,
      vaultTicker: DEMO_VAULT_TICKER,
      actionType: "rotateSigners",
      state: "QUEUED",
      proposedBy: DEMO_PROPOSER,
      requiredSigners: REQUIRED_SIGNERS,
      approvalCount: 2,
      rejectionCount: 0,
      cancelCount: 0,
      createdAt: daysAgo(7, now),
      submittedAt: daysAgo(7, now),
      etaAt: hoursFromNow(5, now),
    },

    // ---- 5. EXECUTED — unpause after scheduled maintenance (terminal) ----
    {
      id: "demo-gov-executed-unpause",
      vaultDeploymentId: DEMO_VAULT_DEPLOYMENT_ID,
      vaultTicker: DEMO_VAULT_TICKER,
      actionType: "unpause",
      state: "EXECUTED",
      proposedBy: DEMO_PROPOSER,
      requiredSigners: REQUIRED_SIGNERS,
      approvalCount: 2,
      rejectionCount: 0,
      cancelCount: 0,
      createdAt: daysAgo(14, now),
      submittedAt: daysAgo(14, now),
      etaAt: daysAgo(12, now),
    },
  ];

  return proposals;
}
