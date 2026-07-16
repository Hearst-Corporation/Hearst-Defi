// gpu1-backend/src/persistence/mining-repository.ts
//
// Repository = the only place that speaks Prisma for the mining domain. The
// application services depend on THIS interface, not on Prisma directly.
//
// HONESTY BOUNDARY. There are two very different notions of "mining data":
//   1. On-chain mining facts owned by the v2 contract — reportedHashrate the
//      operator ATTESTS on-chain, BTC earned credited to the vault, take-profit
//      tiers, curtailment state. NONE of that exists until the contract is
//      deployed + indexed → it is served as NOT_CONFIGURED by the services, and
//      this repository does NOT invent it.
//   2. Operational fleet/market telemetry persisted in the canonical DB
//      (`MiningMetric`: hashprice, difficulty, btcPrice, energyCost, uptimePct,
//      deployedHashrate…). This is REAL DB data when rows exist. This repository
//      exposes ONLY what is actually stored — and returns `null` when the table
//      is empty so the service degrades to NOT_CONFIGURED rather than fabricate.
import { getPrisma } from "./prisma.js";

/** A single persisted operational-telemetry row, mapped to render-safe strings.
 *  Every field is exactly a column that EXISTS in `MiningMetric` — nothing derived,
 *  nothing invented. Decimal/Int columns become decimal strings/numbers the browser
 *  can render directly; never a bare Prisma Decimal across the boundary. */
export interface MiningTelemetryRow {
  readonly takenAt: string; // ISO timestamp of the row
  readonly deployedHashrateTh: string; // TH/s (Decimal → string)
  readonly uptimePct: string; // %  (Decimal → string)
  readonly hashprice: string; // $/TH/day
  readonly difficulty: string;
  readonly btcPrice: string; // USD
  readonly energyCost: string; // $/kWh
  readonly miningMarginScore: number;
  readonly hashpriceTrendPct: string;
  readonly operationalConfidence: number;
  readonly alertLevel: string | null; // green | amber | red | null
  readonly summary: string | null;
  readonly recommendation: string | null;
}

export interface MiningRepository {
  /** Latest persisted operational telemetry row, or `null` when the table is empty.
   *  Null → the service reports NOT_CONFIGURED (never a fabricated zero). */
  getLatestTelemetry(): Promise<MiningTelemetryRow | null>;
}

// Decimal/number → render-safe decimal string. Prisma Decimal has a toString();
// this also copes with number columns without ever emitting a bare Decimal object.
function dec(v: unknown): string {
  return String(v);
}

export function createMiningRepository(): MiningRepository {
  const prisma = getPrisma();
  return {
    async getLatestTelemetry(): Promise<MiningTelemetryRow | null> {
      const row = await prisma.miningMetric.findFirst({
        orderBy: { takenAt: "desc" },
        select: {
          takenAt: true,
          deployedHashrate: true,
          uptimePct: true,
          hashprice: true,
          difficulty: true,
          btcPrice: true,
          energyCost: true,
          miningMarginScore: true,
          hashpriceTrendPct: true,
          operationalConfidence: true,
          alertLevel: true,
          summary: true,
          recommendation: true,
        },
      });
      // Empty table → honest null. The service turns this into NOT_CONFIGURED;
      // it does NOT synthesise a hashrate/uptime/BTC-earned value.
      if (!row) return null;
      return {
        takenAt: row.takenAt.toISOString(),
        deployedHashrateTh: dec(row.deployedHashrate),
        uptimePct: dec(row.uptimePct),
        hashprice: dec(row.hashprice),
        difficulty: dec(row.difficulty),
        btcPrice: dec(row.btcPrice),
        energyCost: dec(row.energyCost),
        miningMarginScore: row.miningMarginScore,
        hashpriceTrendPct: dec(row.hashpriceTrendPct),
        operationalConfidence: row.operationalConfidence,
        alertLevel: row.alertLevel,
        summary: row.summary,
        recommendation: row.recommendation,
      };
    },
  };
}
