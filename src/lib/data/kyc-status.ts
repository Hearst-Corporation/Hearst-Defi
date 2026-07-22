import "server-only";

import { prisma } from "@/lib/db";

/**
 * Investor-facing KYC status, read from the DB — never asserted.
 *
 * The canonical state lives on `Investor.kycStatus` (pending|approved|rejected,
 * set by Sumsub webhook ingest or an admin decision); `KycInquiry` rows tell
 * "pending" apart from "never started". A DB failure degrades to `unavailable`
 * — the surface says it could not read, it does not invent a state.
 */
export type InvestorKycStatus =
  | "approved"
  | "in_review"
  | "not_started"
  | "rejected"
  | "unavailable";

export async function readInvestorKycStatus(userId: string): Promise<InvestorKycStatus> {
  try {
    const investor = await prisma.investor.findUnique({
      where: { userId },
      select: { kycStatus: true },
    });

    if (investor?.kycStatus === "approved") return "approved";
    if (investor?.kycStatus === "rejected") return "rejected";

    // pending (or no investor row yet): started iff an inquiry was claimed.
    // Queried directly — NOT via kyc-gate's investorHasKycInquiry, which
    // deliberately swallows a missing KycInquiry table into `false`. Here a
    // failed read must surface as `unavailable`, never as "Not yet started".
    const inquiry = await prisma.kycInquiry.findFirst({
      where: { userId },
      select: { inquiryId: true },
    });
    return inquiry != null ? "in_review" : "not_started";
  } catch {
    return "unavailable";
  }
}
