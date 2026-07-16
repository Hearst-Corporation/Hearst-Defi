// gpu1-backend/src/persistence/vault-repository.ts
//
// Repository = the only place that speaks Prisma for the vault domain. Application
// services depend on THIS interface, not on Prisma directly (so the DB can move
// behind GPU1 without touching business logic). Returns plain domain-ish rows;
// the service maps them to DTOs.
//
// HONESTY: every method returns `null` when the underlying record is absent, so
// the service can degrade to PARTIAL / NOT_CONFIGURED rather than fabricate a
// zero. Decimal columns are aggregated to render-safe decimal STRINGS — never a
// bare Prisma Decimal/BigInt across the boundary.
import type {
  ActivityItem,
  DistributionItem,
  DistributionSummary,
  InvestorIdentity,
  InvestorPosition,
  ProofSummary,
  VaultUserPosition,
} from "../domain/index.js";
import { getPrisma } from "./prisma.js";

/** Most-recent-first activity/distribution rows are bounded so a large ledger
 *  never streams unpaginated across the API boundary. */
const ACTIVITY_LIMIT = 20;
const DISTRIBUTION_LIMIT = 12;

export interface VaultRepository {
  /** User's on-book position from the canonical DB (Investor + Position). Null if unknown. */
  getUserPosition(userId: string): Promise<VaultUserPosition | null>;

  /** Access / identity facts (KYC, wallet, accreditation) from the Investor row.
   *  Null when there is no Investor record for this userId. */
  getInvestorIdentity(userId: string): Promise<InvestorIdentity | null>;

  /** Enriched on-book position (principal / accrued / value / positionsCount /
   *  subscribedAt / status), aggregated from the Position table. Null when there
   *  is no Investor record. */
  getInvestorPosition(userId: string): Promise<InvestorPosition | null>;

  /** Distribution history for this investor's positions. Null when there is no
   *  Investor record (→ service reports PARTIAL). An empty history for an existing
   *  investor returns a summary with count 0 — honest "no distributions yet". */
  getDistributions(userId: string): Promise<DistributionSummary | null>;

  /** Ledger movements (InvestorTransaction), most-recent-first, bounded. Null when
   *  there is no Investor record (→ service reports PARTIAL). */
  getActivity(userId: string): Promise<readonly ActivityItem[] | null>;

  /** Proof-center summary (Proof table). Not investor-scoped (proofs are vault-wide).
   *  Returns a summary with count 0 when the table is empty — never fabricated. */
  getProofSummary(): Promise<ProofSummary>;
}

/** Decimal/number → render-safe decimal string; never a bare Prisma Decimal. */
function dec(v: unknown): string {
  return String(v);
}

export function createVaultRepository(): VaultRepository {
  const prisma = getPrisma();

  /** Resolve the Investor id for a userId, or null if there is no record. */
  async function investorIdFor(userId: string): Promise<string | null> {
    const investor = await prisma.investor.findUnique({
      where: { userId },
      select: { id: true },
    });
    return investor?.id ?? null;
  }

  return {
    async getUserPosition(userId: string): Promise<VaultUserPosition | null> {
      // Investor is keyed by userId (unique) in the Connect schema; Position holds
      // the USDC book. Shares + on-chain whitelist live on the contract, NOT the DB
      // → those stay null here (honest: filled from chain reads once v2 is wired).
      const investorId = await investorIdFor(userId);
      if (investorId === null) return null;

      const positions = await prisma.position.findMany({
        where: { investorId },
        select: { principalUsdc: true, accruedYieldUsdc: true, distributedUsdc: true },
      });

      // Aggregate Decimal columns → decimal string; never a bare Decimal/BigInt to the client.
      const sum = (pick: (p: (typeof positions)[number]) => unknown): string | null => {
        let total = 0;
        let seen = false;
        for (const p of positions) {
          const v = pick(p);
          if (v == null) continue;
          seen = true;
          total += Number(v);
        }
        return seen ? String(total) : null;
      };

      const principal = sum((p) => p.principalUsdc);
      const accrued = sum((p) => p.accruedYieldUsdc);
      return {
        whitelisted: false, // on-chain fact — not derivable from DB; supplied by chain read when v2 is live
        shares: null, // shares are on-chain; DB does not hold them
        value:
          principal !== null || accrued !== null
            ? String((Number(principal ?? 0)) + (Number(accrued ?? 0)))
            : null,
        deposits: principal,
        withdrawals: sum((p) => p.distributedUsdc),
      };
    },

    async getInvestorIdentity(userId: string): Promise<InvestorIdentity | null> {
      const investor = await prisma.investor.findUnique({
        where: { userId },
        select: {
          kycStatus: true,
          walletAddress: true,
          accreditationAttestedAt: true,
        },
      });
      if (!investor) return null;
      return {
        kycStatus: investor.kycStatus ?? null,
        // Share class is NOT stored on Investor in this schema → honest null,
        // never a fabricated "A". The chat/read layer fills it when available.
        shareClass: null,
        // On-chain whitelist is a contract fact — null until v2 is read.
        whitelisted: null,
        walletAddress: investor.walletAddress ?? null,
        accredited: investor.accreditationAttestedAt !== null,
      };
    },

    async getInvestorPosition(userId: string): Promise<InvestorPosition | null> {
      const investorId = await investorIdFor(userId);
      if (investorId === null) return null;

      const positions = await prisma.position.findMany({
        where: { investorId },
        select: {
          principalUsdc: true,
          accruedYieldUsdc: true,
          distributedUsdc: true,
          status: true,
          subscribedAt: true,
        },
        orderBy: { subscribedAt: "asc" },
      });

      const sum = (pick: (p: (typeof positions)[number]) => unknown): string | null => {
        let total = 0;
        let seen = false;
        for (const p of positions) {
          const v = pick(p);
          if (v == null) continue;
          seen = true;
          total += Number(v);
        }
        return seen ? String(total) : null;
      };

      const principal = sum((p) => p.principalUsdc);
      const accrued = sum((p) => p.accruedYieldUsdc);
      const value =
        principal !== null || accrued !== null
          ? String(Number(principal ?? 0) + Number(accrued ?? 0))
          : null;

      const first = positions[0];
      return {
        principal,
        accrued,
        value,
        deposits: principal,
        withdrawals: sum((p) => p.distributedUsdc),
        shares: null, // on-chain — DB holds no shares
        positionsCount: positions.length,
        subscribedAt: first ? first.subscribedAt.toISOString() : null,
        status: first?.status ?? null,
      };
    },

    async getDistributions(userId: string): Promise<DistributionSummary | null> {
      const investorId = await investorIdFor(userId);
      if (investorId === null) return null;

      // The Distribution table is vault-wide (period-level payouts), not keyed to
      // an investor. v2 is an accumulation note → NO periodic cash distribution, so
      // this is expected to be empty. We surface honestly whatever exists.
      const rows = await prisma.distribution.findMany({
        orderBy: { distributedAt: "desc" },
        take: DISTRIBUTION_LIMIT,
        select: {
          period: true,
          amountUsdc: true,
          distributedAt: true,
          status: true,
        },
      });

      if (rows.length === 0) {
        return {
          count: 0,
          totalDistributedUsdc: null, // NEVER 0: absence is null, not a fabricated zero
          lastDistributionAt: null,
          recent: [],
        };
      }

      let total = 0;
      const recent: DistributionItem[] = rows.map((r) => {
        total += Number(r.amountUsdc);
        return {
          period: r.period,
          amountUsdc: dec(r.amountUsdc),
          distributedAt: r.distributedAt.toISOString(),
          status: r.status,
        };
      });
      const firstRow = rows[0];
      return {
        count: rows.length,
        totalDistributedUsdc: String(total),
        lastDistributionAt: firstRow ? firstRow.distributedAt.toISOString() : null,
        recent,
      };
    },

    async getActivity(userId: string): Promise<readonly ActivityItem[] | null> {
      const investorId = await investorIdFor(userId);
      if (investorId === null) return null;

      const rows = await prisma.investorTransaction.findMany({
        where: { investorId },
        orderBy: { occurredAt: "desc" },
        take: ACTIVITY_LIMIT,
        select: {
          type: true,
          amountUsdc: true,
          occurredAt: true,
          txHash: true,
        },
      });

      return rows.map((r) => ({
        type: r.type,
        amountUsdc: dec(r.amountUsdc),
        occurredAt: r.occurredAt.toISOString(),
        txHash: r.txHash ?? null,
      }));
    },

    async getProofSummary(): Promise<ProofSummary> {
      const rows = await prisma.proof.findMany({
        orderBy: { postedAt: "desc" },
        select: { proofType: true, postedAt: true },
      });
      if (rows.length === 0) {
        return { totalProofs: 0, latestProofAt: null, types: [] };
      }
      const types = Array.from(new Set(rows.map((r) => r.proofType)));
      const firstRow = rows[0];
      return {
        totalProofs: rows.length,
        latestProofAt: firstRow ? firstRow.postedAt.toISOString() : null,
        types,
      };
    },
  };
}
