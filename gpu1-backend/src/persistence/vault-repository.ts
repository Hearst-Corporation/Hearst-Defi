// gpu1-backend/src/persistence/vault-repository.ts
//
// Repository = the only place that speaks Prisma for the vault domain. Application
// services depend on THIS interface, not on Prisma directly (so the DB can move
// behind GPU1 without touching business logic). Returns plain domain-ish rows;
// the service maps them to DTOs.
import type { VaultUserPosition } from "../domain/index.js";
import { getPrisma } from "./prisma.js";

export interface VaultRepository {
  /** User's on-book position from the canonical DB (Investor + Position). Null if unknown. */
  getUserPosition(userId: string): Promise<VaultUserPosition | null>;
}

export function createVaultRepository(): VaultRepository {
  const prisma = getPrisma();
  return {
    async getUserPosition(userId: string): Promise<VaultUserPosition | null> {
      // Investor is keyed by userId (unique) in the Connect schema; Position holds
      // the USDC book. Shares + on-chain whitelist live on the contract, NOT the DB
      // → those stay null here (honest: filled from chain reads once v2 is wired).
      const investor = await prisma.investor.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!investor) return null;

      const positions = await prisma.position.findMany({
        where: { investorId: investor.id },
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
  };
}
