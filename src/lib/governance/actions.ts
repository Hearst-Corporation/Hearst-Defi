"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { routeForTransaction } from "@/lib/governance/routing";
import {
  canTransition,
  computeEta,
  isExecutable,
  isExpired,
  nextStateAfterSignature,
  type ProposalState,
  type SignatureCore,
} from "./state-machine";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ACTION_TYPES = [
  "deploy",
  "pause",
  "unpause",
  "updateFees",
  "updateCaps",
  "rotateSigners",
  "sweepFees",
  "emergencyShutdown",
] as const;

type ActionType = (typeof ACTION_TYPES)[number];

const ProposeSchema = z.object({
  vaultId: z.string().min(1),
  actionType: z.enum(ACTION_TYPES),
  calldata: z.string().optional(),
  justification: z.string().min(80, "Justification must be at least 80 characters"),
});

const SignSchema = z.object({
  proposalId: z.string().min(1),
  decision: z.enum(["approve", "reject", "cancel"]),
  reason: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface ProposalCreated {
  id: string;
  state: ProposalState;
}

export interface ProposalRow {
  id: string;
  vaultDeploymentId: string;
  vaultTicker: string;
  actionType: ActionType;
  state: ProposalState;
  proposedBy: string;
  requiredSigners: number;
  approvalCount: number;
  rejectionCount: number;
  cancelCount: number;
  createdAt: Date;
  submittedAt: Date | null;
  etaAt: Date | null;
  /**
   * True when the proposal is in SIGNING state AND the CURRENT operator has
   * not recorded any decision on it yet. Computed against the same identity
   * `signProposal` persists (`admin.userId`) — this is what makes the
   * "Awaiting my signature" tab honest instead of a mislabelled state filter.
   */
  awaitingMySignature: boolean;
}

export interface SignatureRow {
  id: string;
  signerAddress: string;
  decision: "approve" | "reject" | "cancel";
  reason: string | null;
  signedAt: Date;
}

export interface ProposalDetail extends ProposalRow {
  calldata: string | null;
  justification: string;
  queuedAt: Date | null;
  executedAt: Date | null;
  cancelledAt: Date | null;
  signatures: SignatureRow[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toProposalState(raw: string): ProposalState {
  const valid: ProposalState[] = [
    "DRAFT",
    "SIGNING",
    "QUEUED",
    "TIMELOCK",
    "EXECUTABLE",
    "EXECUTED",
    "CANCELLED",
    "REJECTED",
    "EXPIRED",
  ];
  if (valid.includes(raw as ProposalState)) return raw as ProposalState;
  throw new Error(`Unknown proposal state: ${raw}`);
}

function toDecision(raw: string): "approve" | "reject" | "cancel" {
  if (raw === "approve" || raw === "reject" || raw === "cancel") return raw;
  throw new Error(`Unknown decision: ${raw}`);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZERO_ADDRESS = "0x" + "0".repeat(40);

// ---------------------------------------------------------------------------
// proposeAction
// ---------------------------------------------------------------------------

/**
 * Creates a new governance proposal (state: DRAFT → SIGNING immediately,
 * since the proposer is implicitly submitting).
 */
export async function proposeAction(
  vaultId: string,
  actionType: ActionType,
  calldata: string | undefined,
  justification: string,
): Promise<ProposalCreated> {
  const admin = await requireAdmin();

  const parsed = ProposeSchema.parse({ vaultId, actionType, calldata, justification });

  const vault = await prisma.vaultDeployment.findUnique({
    where: { id: parsed.vaultId },
    select: { id: true, requiredSigners: true, ticker: true },
  });
  if (!vault) throw new Error("Vault not found");

  const now = new Date();

  const decision = await routeForTransaction({
    targetAddress: ZERO_ADDRESS,
    actionType: parsed.actionType,
  });

  const proposal = await prisma.governanceProposal.create({
    data: {
      vaultDeploymentId: vault.id,
      actionType: parsed.actionType,
      calldata: parsed.calldata ?? null,
      justification: parsed.justification,
      state: "SIGNING",
      proposedBy: admin.userId,
      requiredSigners: decision.policy.approveQuorum,
      cancelQuorum: decision.policy.cancelQuorum,
      timelockHours: decision.policy.timelockHours,
      graceWindowDays: 7,
      submittedAt: now,
    },
  });

  await recordAdminAudit({
    actorWallet: admin.userId,
    action: "governance.propose",
    entityType: "GovernanceProposal",
    entityId: proposal.id,
    before: null,
    after: {
      state: proposal.state,
      actionType: proposal.actionType,
      routing: { isAllowlisted: decision.isAllowlisted, reason: decision.reason },
    },
  });

  logger.info("Governance proposal created", { proposalId: proposal.id, actionType });

  revalidatePath("/admin/governance");

  return { id: proposal.id, state: toProposalState(proposal.state) };
}

// ---------------------------------------------------------------------------
// signProposal
// ---------------------------------------------------------------------------

/**
 * Records a signer's decision on a proposal and advances the state machine
 * if a quorum threshold is crossed.
 */
export async function signProposal(
  proposalId: string,
  decision: "approve" | "reject" | "cancel",
  reason?: string,
): Promise<ProposalState> {
  const admin = await requireAdmin();

  const parsed = SignSchema.parse({ proposalId, decision, reason });

  const proposal = await prisma.governanceProposal.findUnique({
    where: { id: parsed.proposalId },
    include: { signatures: true },
  });
  if (!proposal) throw new Error("Proposal not found");

  const currentState = toProposalState(proposal.state);

  // State guards: only accept relevant decisions per state
  if (currentState === "SIGNING" && parsed.decision === "cancel") {
    throw new Error("Cannot cancel a proposal that is still in SIGNING state");
  }
  if ((currentState === "QUEUED" || currentState === "TIMELOCK") && parsed.decision !== "cancel") {
    throw new Error(`Only 'cancel' decisions are accepted in ${currentState} state`);
  }
  if (!["SIGNING", "QUEUED", "TIMELOCK"].includes(currentState)) {
    throw new Error(`Proposal is in terminal state ${currentState} — no further signatures accepted`);
  }

  // Prevent duplicate signature from same signer+decision
  const existingSig = proposal.signatures.find(
    (s) => s.signerAddress === admin.userId && s.decision === parsed.decision,
  );
  if (existingSig) {
    throw new Error(`You have already submitted a '${parsed.decision}' decision on this proposal`);
  }

  // Compute quorum BEFORE any write. nextStateAfterSignature adds the new
  // signature to `allSigs` in-memory, so the transition decision does not
  // depend on the signature row being persisted first.
  const allSigs: SignatureCore[] = [
    ...proposal.signatures.map((s) => ({ decision: toDecision(s.decision) })),
    { decision: parsed.decision },
  ];

  const proposalCore = {
    state: currentState,
    requiredSigners: proposal.requiredSigners,
    cancelQuorum: proposal.cancelQuorum,
    timelockHours: proposal.timelockHours,
    graceWindowDays: proposal.graceWindowDays,
    submittedAt: proposal.submittedAt,
    etaAt: proposal.etaAt,
  };

  const nextState = nextStateAfterSignature(proposalCore, allSigs);

  const signatureCreate = {
    proposalId: proposal.id,
    signerAddress: admin.userId,
    decision: parsed.decision,
    reason: parsed.reason ?? null,
  };

  if (nextState !== currentState && canTransition(currentState, nextState)) {
    const now = new Date();
    const updateData: Record<string, unknown> = { state: nextState };

    if (nextState === "QUEUED") {
      updateData["queuedAt"] = now;
      // Auto-advance QUEUED → TIMELOCK immediately (mock, no on-chain)
      const eta = computeEta(proposal.submittedAt ?? now, proposal.timelockHours);
      updateData["state"] = "TIMELOCK";
      updateData["etaAt"] = eta;
    }
    if (nextState === "CANCELLED") {
      updateData["cancelledAt"] = now;
    }

    // D3: the new signature and the state advance must commit together — a
    // partial write (signature without the transition, or vice versa) would
    // corrupt the quorum computation on the next call. Audit + revalidate run
    // only after the transaction commits.
    await prisma.$transaction([
      prisma.proposalSignature.create({ data: signatureCreate }),
      prisma.governanceProposal.update({
        where: { id: proposal.id },
        data: updateData,
      }),
    ]);

    const finalState = toProposalState(
      nextState === "QUEUED" ? "TIMELOCK" : nextState,
    );

    await recordAdminAudit({
      actorWallet: admin.userId,
      action: `governance.${parsed.decision}`,
      entityType: "GovernanceProposal",
      entityId: proposal.id,
      before: { state: currentState },
      after: { state: finalState },
    });

    logger.info("Governance proposal state advanced", { proposalId, nextState: finalState });
    revalidatePath("/admin/governance");
    revalidatePath(`/admin/governance/proposal/${proposalId}`);

    return finalState;
  }

  // No state transition: only the signature is recorded (single write).
  await prisma.proposalSignature.create({ data: signatureCreate });

  await recordAdminAudit({
    actorWallet: admin.userId,
    action: `governance.${parsed.decision}`,
    entityType: "GovernanceProposal",
    entityId: proposal.id,
    before: { state: currentState },
    after: { state: currentState, note: "quorum not yet reached" },
  });

  revalidatePath(`/admin/governance/proposal/${proposalId}`);

  return currentState;
}

// ---------------------------------------------------------------------------
// executeProposal
// ---------------------------------------------------------------------------

/**
 * Marks an EXECUTABLE proposal as EXECUTED (mock — no on-chain call).
 * Also transitions TIMELOCK → EXECUTABLE if the ETA has passed.
 */
export async function executeProposal(proposalId: string): Promise<{ executed: boolean }> {
  const admin = await requireAdmin();

  const proposal = await prisma.governanceProposal.findUnique({
    where: { id: proposalId },
  });
  if (!proposal) throw new Error("Proposal not found");

  const now = new Date();
  let state = toProposalState(proposal.state);

  // Auto-advance TIMELOCK → EXECUTABLE if ETA is past
  if (state === "TIMELOCK") {
    const core = {
      state,
      requiredSigners: proposal.requiredSigners,
      cancelQuorum: proposal.cancelQuorum,
      timelockHours: proposal.timelockHours,
      graceWindowDays: proposal.graceWindowDays,
      submittedAt: proposal.submittedAt,
      etaAt: proposal.etaAt,
    };
    if (isExecutable(core, now)) {
      await prisma.governanceProposal.update({
        where: { id: proposalId },
        data: { state: "EXECUTABLE" },
      });
      state = "EXECUTABLE";
    }
  }

  if (state !== "EXECUTABLE") {
    throw new Error(`Proposal must be EXECUTABLE to execute (current: ${state})`);
  }

  // Check expiry
  const core = {
    state,
    requiredSigners: proposal.requiredSigners,
    cancelQuorum: proposal.cancelQuorum,
    timelockHours: proposal.timelockHours,
    graceWindowDays: proposal.graceWindowDays,
    submittedAt: proposal.submittedAt,
    etaAt: proposal.etaAt,
  };
  if (isExpired(core, now)) {
    await prisma.governanceProposal.update({
      where: { id: proposalId },
      data: { state: "EXPIRED" },
    });
    throw new Error("Proposal has expired — grace window elapsed");
  }

  await prisma.governanceProposal.update({
    where: { id: proposalId },
    data: { state: "EXECUTED", executedAt: now },
  });

  await recordAdminAudit({
    actorWallet: admin.userId,
    action: "governance.execute",
    entityType: "GovernanceProposal",
    entityId: proposalId,
    before: { state: "EXECUTABLE" },
    after: { state: "EXECUTED" },
  });

  logger.info("Governance proposal executed", { proposalId });

  revalidatePath("/admin/governance");
  revalidatePath(`/admin/governance/proposal/${proposalId}`);

  return { executed: true };
}

// ---------------------------------------------------------------------------
// loadProposalQueue
// ---------------------------------------------------------------------------

/** Returns all proposals ordered by most recent, with signature counts. */
export async function loadProposalQueue(): Promise<ProposalRow[]> {
  const admin = await requireAdmin();
  // Signatures are persisted with `signerAddress: admin.userId` (signProposal
  // above) — compare against the SAME identity, not walletAddress.
  const actor = admin.userId;

  const proposals = await prisma.governanceProposal.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      vault: { select: { ticker: true } },
      signatures: { select: { decision: true, signerAddress: true } },
    },
  });

  return proposals.map((p) => ({
    id: p.id,
    vaultDeploymentId: p.vaultDeploymentId,
    vaultTicker: p.vault.ticker,
    actionType: p.actionType as ActionType,
    state: toProposalState(p.state),
    proposedBy: p.proposedBy,
    requiredSigners: p.requiredSigners,
    approvalCount: p.signatures.filter((s) => s.decision === "approve").length,
    rejectionCount: p.signatures.filter((s) => s.decision === "reject").length,
    cancelCount: p.signatures.filter((s) => s.decision === "cancel").length,
    createdAt: p.createdAt,
    submittedAt: p.submittedAt,
    etaAt: p.etaAt,
    awaitingMySignature:
      toProposalState(p.state) === "SIGNING" &&
      !p.signatures.some((s) => s.signerAddress === actor),
  }));
}

// ---------------------------------------------------------------------------
// loadProposalDetail
// ---------------------------------------------------------------------------

/** Returns full proposal detail including all signatures. */
export async function loadProposalDetail(proposalId: string): Promise<ProposalDetail> {
  const admin = await requireAdmin();
  const actor = admin.userId;

  const p = await prisma.governanceProposal.findUnique({
    where: { id: proposalId },
    include: {
      vault: { select: { ticker: true } },
      signatures: { orderBy: { signedAt: "asc" } },
    },
  });
  if (!p) throw new Error("Proposal not found");

  return {
    id: p.id,
    vaultDeploymentId: p.vaultDeploymentId,
    vaultTicker: p.vault.ticker,
    actionType: p.actionType as ActionType,
    state: toProposalState(p.state),
    proposedBy: p.proposedBy,
    requiredSigners: p.requiredSigners,
    approvalCount: p.signatures.filter((s) => s.decision === "approve").length,
    rejectionCount: p.signatures.filter((s) => s.decision === "reject").length,
    cancelCount: p.signatures.filter((s) => s.decision === "cancel").length,
    createdAt: p.createdAt,
    submittedAt: p.submittedAt,
    etaAt: p.etaAt,
    awaitingMySignature:
      toProposalState(p.state) === "SIGNING" &&
      !p.signatures.some((s) => s.signerAddress === actor),
    calldata: p.calldata,
    justification: p.justification,
    queuedAt: p.queuedAt,
    executedAt: p.executedAt,
    cancelledAt: p.cancelledAt,
    signatures: p.signatures.map((s) => ({
      id: s.id,
      signerAddress: s.signerAddress,
      decision: toDecision(s.decision),
      reason: s.reason,
      signedAt: s.signedAt,
    })),
  };
}
