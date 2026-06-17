"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { parseStringArray } from "@/lib/admin/parse-string-array";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  containsForbidden,
  FORBIDDEN_WORDS,
} from "@/lib/agents/forbidden-words";

/** Admin vault actions rate limit: 30 requests / 60s / admin. */
const VAULT_RATE_MAX = 30;
const VAULT_RATE_WINDOW_MS = 60_000;

// ---------------------------------------------------------------------------
// Forbidden words in disclaimers (CLAUDE.md non-négociable #5)
//
// All matching delegates to the canonical module `@/lib/agents/forbidden-words`
// so the wizard inline check, the agent output validator, the notification
// template loader, and these server-side refines all stay in lock-step.
// See `docs/audit/coherence-2026-05-26/06-forbidden-words.md` (P0₃, P1₃, P2₂).
// ---------------------------------------------------------------------------

const FORBIDDEN_WORDS_HUMAN = FORBIDDEN_WORDS.join(" / ");

function containsForbiddenWord(text: string): string | null {
  const result = containsForbidden(text);
  return result ? result.found[0] ?? null : null;
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

const StrategyEnum = z.enum(["mining_yield", "btc_tactical", "stable_reserve"]);
const SpvEnum = z.enum(["cayman", "bvi", "delaware", "lux"]);
const RegExemptionEnum = z.enum(["regD_506c", "regS", "art2_lux"]);

// ---------------------------------------------------------------------------
// Shared schema
// ---------------------------------------------------------------------------

const CreateDraftSchema = z.object({
  ticker: z
    .string()
    .regex(/^[A-Z0-9-]{3,12}$/, "Ticker must be 3-12 uppercase letters/digits/hyphens"),
  name: z.string().min(3).max(80),
  description: z.string().optional(),
  strategy: StrategyEnum,
  colorTag: z.string().optional(),
  minTicketUsdc: z.number().min(1000),
  capacityUsdc: z.number().min(1000),
  mgmtFeeBps: z.number().min(0).max(500),
  perfFeeBps: z.number().min(0).max(3000),
  hurdleBps: z.number().min(0).max(2000).default(0),
  softLockupDays: z.number().min(0).max(365),
  targetApyLowBps: z.number().min(0),
  targetApyHighBps: z.number().min(0),
  spvJurisdiction: SpvEnum,
  shareClass: z
    .string()
    .regex(/^[A-Z]$/, "Share class must be a single uppercase letter"),
  regExemption: RegExemptionEnum,
  disclaimers: z
    .string()
    .min(80, "Disclaimers must be at least 80 characters")
    .refine((v) => {
      const hit = containsForbiddenWord(v);
      return hit === null;
    }, `Disclaimers contain a forbidden word (${FORBIDDEN_WORDS_HUMAN})`),
  targetMiningBps: z.number().min(0).max(10000),
  targetBtcTacticalBps: z.number().min(0).max(10000),
  targetUsdcBaseBps: z.number().min(0).max(10000),
  targetStableReserveBps: z.number().min(0).max(10000),
  signersWhitelist: z
    .array(z.string().min(1))
    .min(2, "At least 2 signers required")
    .max(5, "At most 5 signers allowed"),
  requiredSigners: z
    .number()
    .int()
    .min(2, "Required signers must be at least 2")
    .max(5, "Required signers must be at most 5"),
})
  .refine(
    (d) => d.targetApyHighBps > d.targetApyLowBps,
    {
      message: "targetApyHighBps must be strictly greater than targetApyLowBps",
      path: ["targetApyHighBps"],
    },
  )
  .refine(
    (d) =>
      d.targetMiningBps +
        d.targetBtcTacticalBps +
        d.targetUsdcBaseBps +
        d.targetStableReserveBps ===
      10_000,
    {
      message:
        "Allocation bps must sum to exactly 10000 (targetMiningBps + targetBtcTacticalBps + targetUsdcBaseBps + targetStableReserveBps)",
      path: ["targetMiningBps"],
    },
  )
  .refine(
    (d) => {
      if (!d.description) return true;
      return containsForbiddenWord(d.description) === null;
    },
    {
      message: `Description contains a forbidden word (${FORBIDDEN_WORDS_HUMAN})`,
      path: ["description"],
    },
  )
  .refine(
    (d) => d.requiredSigners <= d.signersWhitelist.length,
    {
      message:
        "requiredSigners cannot exceed the number of signers in signersWhitelist",
      path: ["requiredSigners"],
    },
  )
  .refine(
    (d) => containsForbiddenWord(d.name) === null,
    {
      message: `Name contains a forbidden word (${FORBIDDEN_WORDS_HUMAN})`,
      path: ["name"],
    },
  );

export type CreateDraftInput = z.infer<typeof CreateDraftSchema>;

export type VaultActionResult =
  | { ok: true; id: string }
  | { ok: false; issues: z.ZodIssue[] | string };

// ---------------------------------------------------------------------------
// Allowed status transitions (state machine)
// ---------------------------------------------------------------------------

type VaultStatus = "draft" | "review" | "deployed" | "live" | "paused" | "closed";

const ALLOWED_TRANSITIONS: Record<VaultStatus, VaultStatus[]> = {
  draft: ["review"],
  review: ["deployed", "draft"], // reject pushes back to draft
  deployed: ["live"],
  live: ["paused"],
  paused: ["live", "closed"],
  closed: [],
};

function assertTransition(current: string, next: VaultStatus): void {
  const allowed = ALLOWED_TRANSITIONS[current as VaultStatus] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(
      `Transition ${current} → ${next} is not allowed. Allowed: [${allowed.join(", ")}]`,
    );
  }
}

// ---------------------------------------------------------------------------
// createDraftVault
// ---------------------------------------------------------------------------

export async function createDraftVault(
  input: CreateDraftInput,
): Promise<VaultActionResult> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:vaults:${admin.userId}`,
      VAULT_RATE_MAX,
      VAULT_RATE_WINDOW_MS,
    );
  } catch {
    return { ok: false, issues: "Too many requests" };
  }

  const parsed = CreateDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues };
  }

  const d = parsed.data;

  try {
    const vault = await prisma.vaultDeployment.create({
      data: {
        ticker: d.ticker,
        name: d.name,
        description: d.description ?? null,
        strategy: d.strategy,
        colorTag: d.colorTag ?? "accent",
        status: "draft",
        minTicketUsdc: d.minTicketUsdc,
        capacityUsdc: d.capacityUsdc,
        mgmtFeeBps: d.mgmtFeeBps,
        perfFeeBps: d.perfFeeBps,
        hurdleBps: d.hurdleBps,
        softLockupDays: d.softLockupDays,
        targetApyLowBps: d.targetApyLowBps,
        targetApyHighBps: d.targetApyHighBps,
        spvJurisdiction: d.spvJurisdiction,
        shareClass: d.shareClass,
        regExemption: d.regExemption,
        disclaimers: d.disclaimers,
        targetMiningBps: d.targetMiningBps,
        targetBtcTacticalBps: d.targetBtcTacticalBps,
        targetUsdcBaseBps: d.targetUsdcBaseBps,
        targetStableReserveBps: d.targetStableReserveBps,
        signersWhitelist: JSON.stringify(d.signersWhitelist),
        requiredSigners: d.requiredSigners,
        createdBy: admin.walletAddress ?? admin.userId,
        shareClasses: {
          create: [{
            code: d.shareClass,
            minTicket: d.minTicketUsdc,
            lockupDays: d.softLockupDays,
            mgmtFeeBps: d.mgmtFeeBps,
            perfFeeBps: d.perfFeeBps,
          }],
        },
      },
    });

    await recordAdminAudit({
      actorWallet: admin.walletAddress ?? admin.userId,
      action: "vault.createDraft",
      entityType: "VaultDeployment",
      entityId: vault.id,
      before: null,
      after: { status: "draft", ticker: vault.ticker },
    });

    revalidatePath("/admin/vaults");
    logger.info("vault draft created", { vaultId: vault.id, ticker: vault.ticker });
    return { ok: true, id: vault.id };
  } catch (err) {
    logger.error("createDraftVault failed", { ticker: d.ticker }, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// updateDraftVault
// ---------------------------------------------------------------------------

export async function updateDraftVault(
  id: string,
  input: CreateDraftInput,
): Promise<VaultActionResult> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:vaults:${admin.userId}`,
      VAULT_RATE_MAX,
      VAULT_RATE_WINDOW_MS,
    );
  } catch {
    return { ok: false, issues: "Too many requests" };
  }

  const parsed = CreateDraftSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues };
  }

  const d = parsed.data;

  const existing = await prisma.vaultDeployment.findUnique({ where: { id } });
  if (!existing) throw new Error("Not found");
  if (existing.status !== "draft") {
    throw new Error("Only draft vaults can be edited");
  }

  try {
    // D3: the deployment update and the ShareClass sync must commit together —
    // a partial write would leave the vault terms and its share class out of
    // sync. Wrap both in an interactive $transaction; audit + revalidate run
    // only after the transaction commits (pattern: rejectDeployment).
    const vault = await prisma.$transaction(async (tx) => {
      const updated = await tx.vaultDeployment.update({
        where: { id },
        data: {
          ticker: d.ticker,
          name: d.name,
          description: d.description ?? null,
          strategy: d.strategy,
          colorTag: d.colorTag ?? "accent",
          minTicketUsdc: d.minTicketUsdc,
          capacityUsdc: d.capacityUsdc,
          mgmtFeeBps: d.mgmtFeeBps,
          perfFeeBps: d.perfFeeBps,
          hurdleBps: d.hurdleBps,
          softLockupDays: d.softLockupDays,
          targetApyLowBps: d.targetApyLowBps,
          targetApyHighBps: d.targetApyHighBps,
          spvJurisdiction: d.spvJurisdiction,
          shareClass: d.shareClass,
          regExemption: d.regExemption,
          disclaimers: d.disclaimers,
          targetMiningBps: d.targetMiningBps,
          targetBtcTacticalBps: d.targetBtcTacticalBps,
          targetUsdcBaseBps: d.targetUsdcBaseBps,
          targetStableReserveBps: d.targetStableReserveBps,
          signersWhitelist: JSON.stringify(d.signersWhitelist),
          requiredSigners: d.requiredSigners,
        },
      });

      // Keep ShareClass row in sync with the draft terms (upsert in case the
      // class code changed between edits, or the row was never seeded).
      await tx.shareClass.upsert({
        where: { vaultId_code: { vaultId: id, code: d.shareClass } },
        create: {
          vaultId: id,
          code: d.shareClass,
          minTicket: d.minTicketUsdc,
          lockupDays: d.softLockupDays,
          mgmtFeeBps: d.mgmtFeeBps,
          perfFeeBps: d.perfFeeBps,
        },
        update: {
          minTicket: d.minTicketUsdc,
          lockupDays: d.softLockupDays,
          mgmtFeeBps: d.mgmtFeeBps,
          perfFeeBps: d.perfFeeBps,
        },
      });

      return updated;
    });

    await recordAdminAudit({
      actorWallet: admin.walletAddress ?? admin.userId,
      action: "vault.updateDraft",
      entityType: "VaultDeployment",
      entityId: id,
      before: { status: existing.status, ticker: existing.ticker },
      after: { status: vault.status, ticker: vault.ticker },
    });

    revalidatePath("/admin/vaults");
    revalidatePath(`/admin/vaults/${id}`);
    return { ok: true, id };
  } catch (err) {
    logger.error("updateDraftVault failed", { id }, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// submitForReview
// ---------------------------------------------------------------------------

export async function submitForReview(id: string): Promise<void> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:vaults:${admin.userId}`,
      VAULT_RATE_MAX,
      VAULT_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }

  const vault = await prisma.vaultDeployment.findUnique({ where: { id } });
  if (!vault) throw new Error("Not found");

  assertTransition(vault.status, "review");

  try {
    await prisma.vaultDeployment.update({
      where: { id },
      data: { status: "review", submittedAt: new Date() },
    });

    await recordAdminAudit({
      actorWallet: admin.walletAddress ?? admin.userId,
      action: "vault.submitForReview",
      entityType: "VaultDeployment",
      entityId: id,
      before: { status: vault.status },
      after: { status: "review" },
    });

    revalidatePath("/admin/vaults");
    revalidatePath(`/admin/vaults/${id}`);
  } catch (err) {
    logger.error("submitForReview failed", { id }, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// signApproval
// ---------------------------------------------------------------------------

export async function signApproval(
  id: string,
  decision: "approve" | "reject",
  reason?: string,
): Promise<void> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:vaults:${admin.userId}`,
      VAULT_RATE_MAX,
      VAULT_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }
  const actorWallet = admin.walletAddress ?? admin.userId;

  const vault = await prisma.vaultDeployment.findUnique({
    where: { id },
    include: { approvals: true },
  });
  if (!vault) throw new Error("Not found");
  if (vault.status !== "review") {
    throw new Error("Only vaults in review status can be signed");
  }

  // Check signer is in the whitelist
  const whitelist = parseStringArray(vault.signersWhitelist, "signer whitelist");
  if (!whitelist.includes(actorWallet)) {
    throw new Error("Signer not in the whitelist");
  }

  try {
    // Upsert approval (overwrite if same signer signs again)
    await prisma.vaultDeploymentApproval.upsert({
      where: { deploymentId_signerWallet: { deploymentId: id, signerWallet: actorWallet } },
      create: {
        deploymentId: id,
        signerWallet: actorWallet,
        decision,
        reason: reason ?? null,
      },
      update: {
        decision,
        reason: reason ?? null,
        signedAt: new Date(),
      },
    });

    await recordAdminAudit({
      actorWallet,
      action: `vault.sign.${decision}`,
      entityType: "VaultDeployment",
      entityId: id,
      before: { status: vault.status },
      after: { decision, reason },
    });

    // Auto-promote to deployed if enough distinct approvals
    if (decision === "approve") {
      const freshApprovals = await prisma.vaultDeploymentApproval.findMany({
        where: { deploymentId: id, decision: "approve" },
      });
      const distinctApprovers = new Set(freshApprovals.map((a) => a.signerWallet));
      if (distinctApprovers.size >= vault.requiredSigners) {
        await prisma.vaultDeployment.update({
          where: { id },
          data: { status: "deployed", deployedAt: new Date() },
        });
        await recordAdminAudit({
          actorWallet,
          action: "vault.autoDeployed",
          entityType: "VaultDeployment",
          entityId: id,
          before: { status: "review" },
          after: { status: "deployed" },
        });
      }
    }

    revalidatePath("/admin/vaults");
    revalidatePath(`/admin/vaults/${id}`);
  } catch (err) {
    logger.error("signApproval failed", { id, decision }, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// reconcileDeployment (force-promote review → deployed when quorum is met)
//
// Safety net for the auto-promotion in signApproval: that path only flips to
// `deployed` when the LAST approval arrives through the Server Action. If a
// signer was added out-of-band, or the SA was replayed out of sequence, the
// vault can stay stuck in `review` despite already having enough distinct
// `approve` votes. This action re-counts the persisted approvals and promotes
// if (and only if) the quorum is genuinely satisfied — no votes are fabricated.
// ---------------------------------------------------------------------------

export async function reconcileDeployment(id: string): Promise<void> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:vaults:${admin.userId}`,
      VAULT_RATE_MAX,
      VAULT_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }
  const actorWallet = admin.walletAddress ?? admin.userId;

  const vault = await prisma.vaultDeployment.findUnique({ where: { id } });
  if (!vault) throw new Error("Not found");
  if (vault.status !== "review") {
    throw new Error(
      `Cannot reconcile this deployment: status is "${vault.status}" (expected "review").`,
    );
  }

  // Count DISTINCT approvers with an `approve` decision — same quorum rule as
  // signApproval's auto-promotion (Set over signerWallet).
  const approvals = await prisma.vaultDeploymentApproval.findMany({
    where: { deploymentId: id, decision: "approve" },
  });
  const approveCount = new Set(approvals.map((a) => a.signerWallet)).size;

  if (approveCount < vault.requiredSigners) {
    throw new Error(
      `Quorum not met: ${approveCount}/${vault.requiredSigners} distinct approvals. Cannot deploy.`,
    );
  }

  try {
    assertTransition(vault.status, "deployed");

    await prisma.vaultDeployment.update({
      where: { id },
      data: { status: "deployed", deployedAt: new Date() },
    });

    await recordAdminAudit({
      actorWallet,
      action: "vault.reconcile",
      entityType: "VaultDeployment",
      entityId: id,
      before: { status: "review" },
      after: { status: "deployed", approveCount, required: vault.requiredSigners },
    });

    revalidatePath("/admin/vaults");
    revalidatePath(`/admin/vaults/${id}`);
    logger.info("vault deployment reconciled", { vaultId: id, approveCount });
  } catch (err) {
    logger.error("reconcileDeployment failed", { id }, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// rejectDeployment (admin hard-reject, pushes back to draft)
// ---------------------------------------------------------------------------

export async function rejectDeployment(id: string, reason: string): Promise<void> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:vaults:${admin.userId}`,
      VAULT_RATE_MAX,
      VAULT_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }
  const actorWallet = admin.walletAddress ?? admin.userId;

  const vault = await prisma.vaultDeployment.findUnique({ where: { id } });
  if (!vault) throw new Error("Not found");

  // P0-C — Sécurité : seul un signer whitelisté peut hard-reject (cohérent multisig).
  // Sans ce check, n'importe quel admin pouvait annuler un quorum en cours via POST direct.
  const whitelist = parseStringArray(vault.signersWhitelist, "signer whitelist");
  if (!whitelist.includes(actorWallet)) {
    throw new Error("Only whitelisted signers can hard-reject a deployment");
  }

  // P1 — UX : si une race condition a fait avancer le vault (ex. quorum atteint
  // entre la lecture et le click), on renvoie un message clair plutôt que le
  // throw technique d'assertTransition.
  if (vault.status !== "review") {
    throw new Error(
      `Cannot reject this deployment: status is now "${vault.status}" (was likely approved or modified by another admin). Refresh the page to see the current state.`,
    );
  }

  try {
    // P0-B — Purge des votes du round précédent dans la même transaction.
    // Sans cette purge, un nouveau `submitForReview` réutilisait les approvals
    // existantes et le quorum pouvait être franchi avec 1 seul vote du nouveau
    // round. `submittedAt: null` reset le timestamp de soumission.
    await prisma.$transaction([
      prisma.vaultDeploymentApproval.deleteMany({ where: { deploymentId: id } }),
      prisma.vaultDeployment.update({
        where: { id },
        data: { status: "draft", submittedAt: null },
      }),
    ]);

    await recordAdminAudit({
      actorWallet,
      action: "vault.rejectDeployment",
      entityType: "VaultDeployment",
      entityId: id,
      before: { status: vault.status },
      after: { status: "draft", reason },
    });

    revalidatePath("/admin/vaults");
    revalidatePath(`/admin/vaults/${id}`);
  } catch (err) {
    logger.error("rejectDeployment failed", { id }, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// markAsLive
// ---------------------------------------------------------------------------

export async function markAsLive(id: string): Promise<void> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:vaults:${admin.userId}`,
      VAULT_RATE_MAX,
      VAULT_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }

  const vault = await prisma.vaultDeployment.findUnique({ where: { id } });
  if (!vault) throw new Error("Not found");

  assertTransition(vault.status, "live");

  try {
    // Set contractAddress so isPlaceholderVault() passes and the vault shows
    // on the investor-facing /vaults page. Use env for the on-chain address;
    // fall back to the Base Sepolia testnet deployment for local development.
    const defaultContractAddress =
      process.env.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS ||
      "0x2bd14d52518a04f4c12949c51df03a161a9e329e";

    await prisma.vaultDeployment.update({
      where: { id },
      data: {
        status: "live",
        contractAddress: vault.contractAddress || defaultContractAddress,
      },
    });

    await recordAdminAudit({
      actorWallet: admin.walletAddress ?? admin.userId,
      action: "vault.markAsLive",
      entityType: "VaultDeployment",
      entityId: id,
      before: { status: vault.status },
      after: { status: "live" },
    });

    revalidatePath("/admin/vaults");
    revalidatePath(`/admin/vaults/${id}`);
  } catch (err) {
    logger.error("markAsLive failed", { id }, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// pauseVault
// ---------------------------------------------------------------------------

export async function pauseVault(id: string): Promise<void> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:vaults:${admin.userId}`,
      VAULT_RATE_MAX,
      VAULT_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }

  const vault = await prisma.vaultDeployment.findUnique({ where: { id } });
  if (!vault) throw new Error("Not found");

  assertTransition(vault.status, "paused");

  try {
    await prisma.vaultDeployment.update({
      where: { id },
      data: { status: "paused", pausedAt: new Date() },
    });

    await recordAdminAudit({
      actorWallet: admin.walletAddress ?? admin.userId,
      action: "vault.pause",
      entityType: "VaultDeployment",
      entityId: id,
      before: { status: vault.status },
      after: { status: "paused" },
    });

    revalidatePath("/admin/vaults");
    revalidatePath(`/admin/vaults/${id}`);
  } catch (err) {
    logger.error("pauseVault failed", { id }, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// resumeVault
// ---------------------------------------------------------------------------

export async function resumeVault(id: string): Promise<void> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:vaults:${admin.userId}`,
      VAULT_RATE_MAX,
      VAULT_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }

  const vault = await prisma.vaultDeployment.findUnique({ where: { id } });
  if (!vault) throw new Error("Not found");

  assertTransition(vault.status, "live");

  try {
    await prisma.vaultDeployment.update({
      where: { id },
      data: { status: "live", pausedAt: null },
    });

    await recordAdminAudit({
      actorWallet: admin.walletAddress ?? admin.userId,
      action: "vault.resume",
      entityType: "VaultDeployment",
      entityId: id,
      before: { status: vault.status },
      after: { status: "live" },
    });

    revalidatePath("/admin/vaults");
    revalidatePath(`/admin/vaults/${id}`);
  } catch (err) {
    logger.error("resumeVault failed", { id }, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// closeVault
// ---------------------------------------------------------------------------

export async function closeVault(id: string): Promise<void> {
  const admin = await requireAdmin();

  try {
    await assertRateLimit(
      `admin:vaults:${admin.userId}`,
      VAULT_RATE_MAX,
      VAULT_RATE_WINDOW_MS,
    );
  } catch {
    throw new Error("Too many requests");
  }

  const vault = await prisma.vaultDeployment.findUnique({ where: { id } });
  if (!vault) throw new Error("Not found");

  assertTransition(vault.status, "closed");

  try {
    await prisma.vaultDeployment.update({
      where: { id },
      data: { status: "closed", closedAt: new Date() },
    });

    await recordAdminAudit({
      actorWallet: admin.walletAddress ?? admin.userId,
      action: "vault.close",
      entityType: "VaultDeployment",
      entityId: id,
      before: { status: vault.status },
      after: { status: "closed" },
    });

    revalidatePath("/admin/vaults");
    revalidatePath(`/admin/vaults/${id}`);
  } catch (err) {
    logger.error("closeVault failed", { id }, err);
    throw err;
  }
}
