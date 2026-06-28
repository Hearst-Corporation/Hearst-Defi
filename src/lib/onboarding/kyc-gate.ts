import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Wallet-step KYC gate outcomes (P0-09).
 *
 * - passed: user has a server-claimed KycInquiry row (started Sumsub flow).
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
 * Whether the investor has a server-claimed Sumsub applicant row.
 * Returns false (never throws) when the KycInquiry table is missing in dev.
 */
export async function investorHasKycInquiry(userId: string): Promise<boolean> {
  try {
    const row = await prisma.kycInquiry.findFirst({
      where: { userId },
      select: { inquiryId: true },
    });
    return row != null;
  } catch (err) {
    if (!isMissingKycInquiryTable(err)) {
      throw err;
    }

    if (isProductionRuntime()) {
      logger.error(
        "KycInquiry table missing in production — cannot resolve inquiry state",
        { userId },
        err instanceof Error ? err : undefined,
      );
    } else {
      logger.warn(
        "KycInquiry table missing — inquiry checklist treated as false (non-production)",
        { userId },
      );
    }
    return false;
  }
}

/**
 * Resolves whether wallet binding / capital allocation may proceed when Sumsub
 * is configured. Caller must still skip this entirely when Sumsub is not
 * configured.
 *
 * Approval precedence: an investor whose KYC is already `approved` (the final
 * canonical state on `Investor.kycStatus`, set by webhook ingest OR by an admin)
 * has cleared identity verification and must NEVER be bounced back to the
 * identity step — even if no `KycInquiry` row exists for them (manual approval,
 * seed data, or a legacy path that did not create the inquiry row). Only when
 * the investor is not yet approved do we fall back to the started-inquiry check.
 */
export async function resolveKycWalletGate(
  userId: string,
): Promise<KycWalletGateStatus> {
  try {
    const investor = await prisma.investor.findUnique({
      where: { userId },
      select: { kycStatus: true },
    });
    if (investor?.kycStatus === "approved") {
      return "passed";
    }

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
