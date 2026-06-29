/**
 * Safe dry-run seams — server-only. These are the ONLY places a diagnostic
 * touches a server-only module, and they do so via lazy dynamic import so the
 * pure suite libs (and their unit tests) never pull the heavy graph.
 *
 * Everything here is READ-ONLY:
 *  - buildOutreachDeps  → one isSuppressed() query (prisma findFirst, no write)
 *  - buildVaultHitlDeps → reads the in-memory tool registry + runs the PURE
 *    read_runtime_capabilities tool (object literal, no DB)
 *  - buildPersistenceDeps → a REAL DB write that is ALWAYS rolled back
 *    (runInRollbackTransaction): create → assert in-tx → rollback. Zero rows
 *    are ever committed.
 *
 * No committed write, no email, no Inngest event, no token consumption. If a
 * dynamic import fails, the dep is left undefined and the dependent check
 * reports SKIPPED rather than faking a pass.
 */
import "server-only";

import type { Prisma } from "@prisma/client";
import type { AdminReadToolExecutionContext } from "@/lib/llm/tools/types";
import type { OutreachDiagnosticsDeps } from "./outreach-diagnostics";
import type { VaultHitlDiagnosticsDeps } from "./vault-hitl-diagnostics";
import type {
  PersistenceDiagnosticsDeps,
  RollbackProbe,
} from "./persistence-diagnostics";

/** A deliberately invalid TLD so the probe can never reach a real inbox. */
const SUPPRESSION_PROBE_EMAIL = "diagnostics-probe@hearst.invalid";

/** Thrown to force an interactive transaction to roll back. Module-private so
 *  only this seam can trigger the rollback path. */
const ROLLBACK_SENTINEL = Symbol("diagnostics:rollback");

/**
 * Run `fn` inside a real interactive transaction, then ALWAYS roll it back by
 * throwing a private sentinel. The callback's return value is captured before
 * the rollback, so a diagnostic can "create → assert → rollback" against the
 * real DB without ever committing a row.
 */
export async function runInRollbackTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<{ rolledBack: boolean; value?: T; error?: string }> {
  let captured: T | undefined;
  try {
    const { prisma } = await import("@/lib/db");
    await prisma.$transaction(async (tx) => {
      captured = await fn(tx);
      throw ROLLBACK_SENTINEL; // force rollback — nothing is ever committed
    });
    // The throw above always rolls back; reaching here means it committed.
    return { rolledBack: false, error: "transaction committed unexpectedly" };
  } catch (err) {
    if (err === ROLLBACK_SENTINEL) return { rolledBack: true, value: captured };
    return {
      rolledBack: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Prove the rollback seam end-to-end against the real DB: count → create an
 * AdminAudit row inside the tx → re-count inside the tx → roll back → count
 * again. AdminAudit has no foreign keys, so the throwaway row is safe; the
 * rollback guarantees zero net persistence.
 */
export async function probeRollbackSeam(): Promise<RollbackProbe> {
  try {
    const { prisma } = await import("@/lib/db");
    const beforeCount = await prisma.adminAudit.count();
    const res = await runInRollbackTransaction(async (tx) => {
      await tx.adminAudit.create({
        data: {
          actorWallet: "diagnostics-rollback-probe",
          action: "diagnostics.rollbackProbe",
          entityType: "Diagnostic",
          entityId: "rollback-seam",
          diff: JSON.stringify({ probe: true }),
        },
      });
      return tx.adminAudit.count();
    });
    const afterCount = await prisma.adminAudit.count();
    return {
      executed: true,
      beforeCount,
      inTxCount: typeof res.value === "number" ? res.value : -1,
      afterCount,
      rolledBack: res.rolledBack,
      persisted: afterCount !== beforeCount,
      error: res.error,
    };
  } catch (err) {
    return {
      executed: false,
      beforeCount: -1,
      inTxCount: -1,
      afterCount: -1,
      rolledBack: false,
      persisted: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function buildPersistenceDeps(): Promise<PersistenceDiagnosticsDeps> {
  return { rollbackProbe: await probeRollbackSeam() };
}

export async function buildOutreachDeps(): Promise<OutreachDiagnosticsDeps> {
  try {
    const { isSuppressed } = await import("@/lib/outreach/suppression");
    const suppressed = await isSuppressed(SUPPRESSION_PROBE_EMAIL);
    return {
      suppressionProbe: { email: SUPPRESSION_PROBE_EMAIL, suppressed },
    };
  } catch {
    return {};
  }
}

export async function buildVaultHitlDeps(): Promise<VaultHitlDiagnosticsDeps> {
  const deps: VaultHitlDiagnosticsDeps = {};
  try {
    const { ADMIN_WRITE_TOOLS, ADMIN_READ_TOOLS } = await import(
      "@/lib/llm/tools/registry"
    );
    deps.writeTools = ADMIN_WRITE_TOOLS.map((t) => ({
      id: t.id,
      confirmationRequired: t.confirmationRequired,
    }));
    const cap = ADMIN_READ_TOOLS.find((t) => t.id === "read_runtime_capabilities");
    if (cap) {
      const ctx = {
        chatMode: "admin",
        profile: "admin",
      } as unknown as AdminReadToolExecutionContext;
      const out = (await cap.run(ctx)) as { lines?: unknown };
      if (out && Array.isArray(out.lines)) {
        deps.capabilitiesLines = out.lines.filter(
          (l): l is string => typeof l === "string",
        );
      }
    }
  } catch {
    // leave deps partial → dependent checks report SKIPPED
  }
  return deps;
}
