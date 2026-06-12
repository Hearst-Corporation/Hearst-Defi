import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Wallet-step KYC gate outcomes (P0-09).
 *
 * - passed: user has a server-claimed KycInquiry row (started Persona flow).
 * - requires_identity: table present, no inquiry — redirect to identity step.
 * - gate_skipped: KycInquiry table missing in non-production — do not enforce
 *   the gate and never mark KYC complete.
 * - db_unavailable: KycInquiry table missing in production runtime — controlled
 *   failure (ops must run migrations), not a silent bypass.
 */
export type KycWalletGateStatus =
  | "passed"
  | "requires_identity"
  | "gate_skipped"
  | "db_unavailable";

function isMissingKycInquiryTable(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2021"
  );
}

function isProductionRuntime(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  );
}

/**
 * Resolves whether wallet binding may proceed when Persona is configured.
 * Caller must still skip this entirely when Persona is not configured.
 */
export async function resolveKycWalletGate(
  userId: string,
): Promise<KycWalletGateStatus> {
  try {
    const startedKyc = await prisma.kycInquiry.findFirst({
      where: { userId },
      select: { inquiryId: true },
    });
    return startedKyc ? "passed" : "requires_identity";
  } catch (err) {
    if (!isMissingKycInquiryTable(err)) {
      throw err;
    }

    if (isProductionRuntime()) {
      logger.error(
        "KycInquiry table missing in production — wallet KYC gate cannot run",
        { userId },
        err instanceof Error ? err : undefined,
      );
      return "db_unavailable";
    }

    logger.warn(
      "KycInquiry table missing — wallet KYC gate skipped (non-production)",
      { userId },
    );
    return "gate_skipped";
  }
}
