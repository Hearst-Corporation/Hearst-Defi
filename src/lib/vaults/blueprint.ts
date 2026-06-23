// src/lib/vaults/blueprint.ts
//
// Vault Product Blueprint — the CANONICAL source of truth for a vault/product.
//
// Architecture decision this file encodes (Admin Vault Deployment A→Z):
//   A projection is a *derived output*, never a source of truth. The product
//   (this blueprint) must exist and be complete BEFORE a projection can run,
//   and a vault may only be published when this blueprint clears every gate.
//   "Can we start from the projection?" → NO. The blueprint comes first;
//   projection inputs hang off it, not the reverse.
//
// Purity: this module is plain data + pure functions. No DB, no fetch, no
// Date.now(), no Math.random(), no process.env — so it is fully testable and
// can run anywhere (engine-adjacent, admin server action, or a test). It does
// NOT add a Prisma model or a migration: it normalises whatever the existing
// VaultDeployment row (or a draft) already carries into one readiness contract.
//
// Field names mirror the live VaultDeployment columns (basis points, day
// counts, bps allocations summing to 10000) so this layer reads an admin draft
// or a deployed row with zero translation.

/** Lifecycle status — mirrors VaultDeployment.status verbatim. */
export type VaultBlueprintStatus =
  | "draft"
  | "review"
  | "deployed"
  | "live"
  | "paused"
  | "closed";

/** Allocation sleeves, in basis points. Must sum to 10000 when complete. */
export interface VaultAllocationBps {
  miningBps: number;
  btcTacticalBps: number;
  usdcBaseBps: number;
  stableReserveBps: number;
}

/** Commercial + structural terms. */
export interface VaultTerms {
  minTicketUsdc: number;
  capacityUsdc: number;
  softLockupDays: number;
  mgmtFeeBps: number;
  perfFeeBps: number;
  hurdleBps: number;
  /** Target APY range in basis points. low MUST be < high (#1: never a point). */
  targetApyLowBps: number;
  targetApyHighBps: number;
}

/** Inputs the projection engine needs. Without these, no projection can run. */
export interface VaultProjectionInputs {
  allocation: VaultAllocationBps;
  /** Whether terms (fees, lockup) are present for the projection to net out. */
  hasTerms: boolean;
}

/** Eligibility / onboarding requirements a live vault must declare. */
export interface VaultOnboardingRequirements {
  /** Investors must attest accreditation before subscribing. */
  requiresAccreditation: boolean;
  /** Investors must clear KYC before subscribing. */
  requiresKyc: boolean;
  /** Investors must link a wallet before subscribing. */
  requiresWallet: boolean;
}

/**
 * The canonical product blueprint. A vault is fully defined by this object;
 * everything downstream (projection, investor page, agent copy) derives from it.
 */
export interface VaultProductBlueprint {
  id: string;
  name: string;
  status: VaultBlueprintStatus;
  strategy: string;
  assetType: string;
  jurisdiction: string;
  investorPersona: string;
  terms: VaultTerms;
  projectionInputs: VaultProjectionInputs;
  /** Free-text risk disclosure / risk profile. Empty → not disclosed. */
  riskProfile: string;
  /** Compliance / legal disclaimers. Empty → blocks publish. */
  complianceNotes: string;
  /** Investor documents that must exist before publish (e.g. PPM, LPA). */
  requiredDocuments: string[];
  onboardingRequirements: VaultOnboardingRequirements;
  /** Multisig approval: distinct signers who have approved. */
  approvals: { distinctApprovers: number; requiredSigners: number };
}

// ---------------------------------------------------------------------------
// Adapter: VaultDeployment row → blueprint
// ---------------------------------------------------------------------------

/**
 * Plain shape of the VaultDeployment fields the blueprint needs. Declared as a
 * loose structural type (not the Prisma type) so this module stays DB-free and
 * testable; the caller passes the row's relevant columns + the live approval
 * count. Keeps the readiness contract usable from a server action or a test.
 */
export interface DeploymentBlueprintSource {
  id: string;
  name: string;
  status: string;
  strategy: string;
  spvJurisdiction: string;
  minTicketUsdc: number;
  capacityUsdc: number;
  softLockupDays: number;
  mgmtFeeBps: number;
  perfFeeBps: number;
  hurdleBps: number;
  targetApyLowBps: number;
  targetApyHighBps: number;
  targetMiningBps: number;
  targetBtcTacticalBps: number;
  targetUsdcBaseBps: number;
  targetStableReserveBps: number;
  disclaimers: string;
  /** Distinct signers that have approved (caller counts from approvals). */
  distinctApprovers: number;
  requiredSigners: number;
  /** Investor documents declared for this vault (default: none). */
  requiredDocuments?: string[];
}

/** Coerce a possibly-Decimal/numeric column to a finite number (0 fallback). */
function toNum(v: number | { toString(): string } | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

/**
 * Normalise a deployment row into the canonical blueprint. The deployment row
 * IS the source of truth; this just projects it into the readiness contract.
 * Eligibility requirements are fixed institutional invariants for every Hearst
 * vault (accreditation + KYC + wallet), so they are asserted here rather than
 * read from a per-vault column that does not exist.
 */
export function deploymentToBlueprint(
  src: DeploymentBlueprintSource,
): VaultProductBlueprint {
  const allocation: VaultAllocationBps = {
    miningBps: toNum(src.targetMiningBps),
    btcTacticalBps: toNum(src.targetBtcTacticalBps),
    usdcBaseBps: toNum(src.targetUsdcBaseBps),
    stableReserveBps: toNum(src.targetStableReserveBps),
  };
  const terms: VaultTerms = {
    minTicketUsdc: toNum(src.minTicketUsdc),
    capacityUsdc: toNum(src.capacityUsdc),
    softLockupDays: toNum(src.softLockupDays),
    mgmtFeeBps: toNum(src.mgmtFeeBps),
    perfFeeBps: toNum(src.perfFeeBps),
    hurdleBps: toNum(src.hurdleBps),
    targetApyLowBps: toNum(src.targetApyLowBps),
    targetApyHighBps: toNum(src.targetApyHighBps),
  };
  return {
    id: src.id,
    name: src.name,
    status: (src.status as VaultBlueprintStatus) ?? "draft",
    strategy: src.strategy,
    assetType: "structured-yield",
    jurisdiction: src.spvJurisdiction,
    investorPersona: "qualified-institutional",
    terms,
    projectionInputs: { allocation, hasTerms: termsArePresent(terms) },
    riskProfile: src.disclaimers ?? "",
    complianceNotes: src.disclaimers ?? "",
    requiredDocuments: src.requiredDocuments ?? [],
    onboardingRequirements: {
      requiresAccreditation: true,
      requiresKyc: true,
      requiresWallet: true,
    },
    approvals: {
      distinctApprovers: toNum(src.distinctApprovers),
      requiredSigners: toNum(src.requiredSigners),
    },
  };
}

// ---------------------------------------------------------------------------
// Readiness verdicts
// ---------------------------------------------------------------------------

export type ReadinessLevel = "ready" | "warning" | "blocked";

export interface ReadinessReport {
  level: ReadinessLevel;
  /** Hard blockers — each prevents the gated action entirely. */
  blockers: string[];
  /** Non-fatal warnings — the action can proceed but should be reviewed. */
  warnings: string[];
}

const FULL_ALLOCATION_BPS = 10_000;

/** True when the four sleeves are all present and sum to exactly 10000 bps. */
function allocationIsComplete(a: VaultAllocationBps): boolean {
  const sum = a.miningBps + a.btcTacticalBps + a.usdcBaseBps + a.stableReserveBps;
  return sum === FULL_ALLOCATION_BPS;
}

/** True when the APY target is a real range (#1: low strictly below high). */
function apyIsRange(t: VaultTerms): boolean {
  return (
    Number.isFinite(t.targetApyLowBps) &&
    Number.isFinite(t.targetApyHighBps) &&
    t.targetApyLowBps >= 0 &&
    t.targetApyHighBps > t.targetApyLowBps
  );
}

/** True when commercial terms are populated (non-zero ticket + capacity). */
function termsArePresent(t: VaultTerms): boolean {
  return t.minTicketUsdc > 0 && t.capacityUsdc > 0 && apyIsRange(t);
}

/**
 * Can a projection run for this blueprint?
 *
 * A projection is an OUTPUT of the product, so it requires the product's
 * inputs to be complete first. This answers `projectionCanRun` and surfaces
 * exactly what is missing — proving a projection is never a standalone source.
 */
export function evaluateVaultProjectionReadiness(
  blueprint: VaultProductBlueprint,
): ReadinessReport & { projectionCanRun: boolean } {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!termsArePresent(blueprint.terms)) {
    blockers.push("Missing terms: min ticket, capacity, or a valid APY range.");
  }
  if (!blueprint.projectionInputs.hasTerms) {
    blockers.push("Projection inputs incomplete: terms not wired to the engine.");
  }
  if (!allocationIsComplete(blueprint.projectionInputs.allocation)) {
    blockers.push("Allocation sleeves must sum to 10000 bps before projecting.");
  }
  if (blueprint.riskProfile.trim().length === 0) {
    // A projection can technically run without a risk note, but surfacing one
    // unattached to a risk disclosure is a known footgun — warn, don't block.
    warnings.push("No risk disclosure attached to the projection yet.");
  }

  const projectionCanRun = blockers.length === 0;
  return {
    level: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready",
    blockers,
    warnings,
    projectionCanRun,
  };
}

/**
 * Can this vault be PUBLISHED (go live)?
 *
 * Stricter than projection readiness: a live vault is investor-facing, so it
 * must carry terms, risk disclosure, a runnable projection, eligibility rules,
 * investor documents, and a cleared multisig approval. This is the gate
 * `markAsLive()` lacks today — no vault may go live from an incomplete blueprint.
 */
export function evaluateVaultPublishReadiness(
  blueprint: VaultProductBlueprint,
): ReadinessReport & { publishCanHappen: boolean } {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!termsArePresent(blueprint.terms)) {
    blockers.push("No complete terms (ticket, capacity, APY range).");
  }
  if (blueprint.riskProfile.trim().length === 0) {
    blockers.push("No risk disclosure — required before a vault is investor-facing.");
  }
  if (blueprint.complianceNotes.trim().length === 0) {
    blockers.push("No compliance disclaimers.");
  }

  // Projection must be runnable (its own blockers roll up here).
  const projection = evaluateVaultProjectionReadiness(blueprint);
  if (!projection.projectionCanRun) {
    blockers.push("Projection cannot run — complete the blueprint inputs first.");
  }

  // Eligibility must be defined: a real institutional vault requires all three.
  const e = blueprint.onboardingRequirements;
  if (!e.requiresAccreditation || !e.requiresKyc || !e.requiresWallet) {
    blockers.push(
      "Eligibility incomplete: accreditation, KYC, and wallet must all be required.",
    );
  }

  if (blueprint.requiredDocuments.length === 0) {
    blockers.push("No investor documents declared (e.g. PPM / LPA).");
  }

  if (blueprint.approvals.distinctApprovers < blueprint.approvals.requiredSigners) {
    blockers.push(
      `Approval missing: ${blueprint.approvals.distinctApprovers}/${blueprint.approvals.requiredSigners} signers.`,
    );
  }

  // A blueprint not yet through review going straight to live is suspicious.
  if (blueprint.status === "draft") {
    warnings.push("Blueprint is still a draft — submit for review before publishing.");
  }

  const publishCanHappen = blockers.length === 0;
  return {
    level: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready",
    blockers,
    warnings,
    publishCanHappen,
  };
}

/**
 * Runtime go-live gate for a real VaultDeployment row.
 *
 * `evaluateVaultPublishReadiness` is the FULL doctrinal contract (it also
 * requires declared investor documents + explicit per-vault eligibility flags).
 * This narrower gate enforces only the invariants the live data model actually
 * backs today — complete terms, a valid APY range, a risk disclosure, an
 * allocation that sums to 10000 bps, and a cleared approval quorum — so it can
 * be wired into `markAsLive()` without falsely bricking the existing flow on
 * fields that have no column yet. Documents/eligibility remain enforced at the
 * doctrinal layer (and in tests) until a backing model exists.
 */
export function evaluateDeploymentLiveGate(
  blueprint: VaultProductBlueprint,
): ReadinessReport & { canGoLive: boolean } {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!termsArePresent(blueprint.terms)) {
    blockers.push("No complete terms (ticket, capacity, APY range).");
  }
  if (blueprint.riskProfile.trim().length === 0) {
    blockers.push("No risk disclosure / disclaimers — cannot go live.");
  }
  if (!allocationIsComplete(blueprint.projectionInputs.allocation)) {
    blockers.push("Allocation sleeves must sum to 10000 bps.");
  }
  if (blueprint.approvals.distinctApprovers < blueprint.approvals.requiredSigners) {
    blockers.push(
      `Approval missing: ${blueprint.approvals.distinctApprovers}/${blueprint.approvals.requiredSigners} signers.`,
    );
  }
  if (blueprint.requiredDocuments.length === 0) {
    warnings.push("No investor documents declared yet (PPM / LPA).");
  }

  const canGoLive = blockers.length === 0;
  return {
    level: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "warning" : "ready",
    blockers,
    warnings,
    canGoLive,
  };
}

// ---------------------------------------------------------------------------
// Agent action matrix
// ---------------------------------------------------------------------------

/** What an agent may do to a vault, and under which guard. */
export type AgentVaultAction =
  | "draft_blueprint"
  | "propose_projection_assumptions"
  | "generate_investor_copy"
  | "flag_compliance_gaps"
  | "prepare_approval_memo"
  | "run_projection"
  | "modify_blueprint"
  | "publish_vault";

export type AgentActionGuard =
  | "none" // read / propose / draft — safe, no confirmation
  | "inputs_complete" // allowed only when projection inputs are complete
  | "confirmation" // requires admin two-step confirmation
  | "confirmation_and_approval"; // high-risk: confirmation + cleared approval

export interface AgentActionPolicy {
  action: AgentVaultAction;
  guard: AgentActionGuard;
  /** Whether the agent itself may finalise it, or only stage a draft. */
  draftOnly: boolean;
  note: string;
}

/**
 * Canonical policy. Mirrors ADR-017: every write is draft-only + human-in-the-
 * loop; no agent auto-executes. Publish is the highest bar and can NEVER fire
 * from an incomplete blueprint — the publish-readiness gate is the backstop.
 */
export const VAULT_AGENT_ACTION_MATRIX: readonly AgentActionPolicy[] = [
  {
    action: "draft_blueprint",
    guard: "none",
    draftOnly: true,
    note: "Agent may draft a blueprint proposal; nothing is persisted live.",
  },
  {
    action: "propose_projection_assumptions",
    guard: "none",
    draftOnly: true,
    note: "Agent may propose assumptions; admin reviews before they bind.",
  },
  {
    action: "generate_investor_copy",
    guard: "none",
    draftOnly: true,
    note: "Copy is forbidden-words + APY-range guarded; draft only.",
  },
  {
    action: "flag_compliance_gaps",
    guard: "none",
    draftOnly: true,
    note: "Read/analyse only — surfaces gaps, never mutates.",
  },
  {
    action: "prepare_approval_memo",
    guard: "none",
    draftOnly: true,
    note: "Drafts a governance/approval memo; persisted as DRAFT.",
  },
  {
    action: "run_projection",
    guard: "inputs_complete",
    draftOnly: false,
    note: "Allowed only when projection inputs are complete (deterministic, pure).",
  },
  {
    action: "modify_blueprint",
    guard: "confirmation",
    draftOnly: false,
    note: "Mutating the source of truth requires admin two-step confirmation.",
  },
  {
    action: "publish_vault",
    guard: "confirmation_and_approval",
    draftOnly: false,
    note: "High-risk: confirmation + cleared approval + a passing publish gate.",
  },
] as const;

/**
 * Resolve whether an agent may take an action given the blueprint state.
 * This is the single decision point a tool layer should consult — it folds the
 * static policy together with the live readiness gates so no agent can, e.g.,
 * publish from an incomplete blueprint even if a caller forgot to check.
 */
export function resolveAgentVaultAction(
  action: AgentVaultAction,
  blueprint: VaultProductBlueprint,
): { allowed: boolean; requiresConfirmation: boolean; reason: string } {
  const policy = VAULT_AGENT_ACTION_MATRIX.find((p) => p.action === action);
  if (!policy) {
    return { allowed: false, requiresConfirmation: false, reason: "Unknown action." };
  }

  switch (policy.guard) {
    case "none":
      return {
        allowed: true,
        requiresConfirmation: false,
        reason: "Read/propose/draft — no confirmation required.",
      };
    case "inputs_complete": {
      const ready = evaluateVaultProjectionReadiness(blueprint).projectionCanRun;
      return {
        allowed: ready,
        requiresConfirmation: false,
        reason: ready
          ? "Projection inputs complete."
          : "Projection inputs incomplete — cannot run.",
      };
    }
    case "confirmation":
      return {
        allowed: true,
        requiresConfirmation: true,
        reason: "Blueprint mutation requires admin confirmation.",
      };
    case "confirmation_and_approval": {
      const publish = evaluateVaultPublishReadiness(blueprint);
      return {
        allowed: publish.publishCanHappen,
        requiresConfirmation: true,
        reason: publish.publishCanHappen
          ? "Publish allowed — confirmation still required."
          : `Publish blocked: ${publish.blockers[0] ?? "incomplete blueprint"}`,
      };
    }
    default:
      return { allowed: false, requiresConfirmation: false, reason: "Unhandled guard." };
  }
}
