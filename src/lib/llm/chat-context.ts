import "server-only";

import { prisma } from "@/lib/db";
import { resolveProvenance } from "@/lib/portfolio/provenance";
import { chatOutputViolation } from "@/lib/llm/output-guard";
import type { Provenance } from "@/components/ui/provenance-badge";

/**
 * Live portfolio context block for the cockpit chat.
 *
 * PR-5: lets the assistant answer "pourquoi mon portefeuille est stale ?" with
 * the AUTHENTICATED user's REAL figures + their freshness, instead of inventing
 * numbers or pointing only at the Dashboard.
 *
 * Hard scoping rule: this loader resolves the Investor row from the *passed*
 * `userId` (Investor.userId is unique) and aggregates ONLY that investor's
 * positions / transactions. It deliberately does NOT call `loadPortfolio()` from
 * `@/lib/data/portfolio` because that loader is scoped to the *session* investor
 * via `getInvestor()` (cookie-derived), not to an explicit userId — relying on
 * it would couple per-user scoping to the ambient request session. Here the
 * userId is the single source of truth, so cross-tenant leakage is impossible by
 * construction (a foreign userId yields no Investor → null block).
 *
 * The block is descriptive DATA, never instructions: the route prefixes it with
 * an explicit "DONNÉES PORTEFEUILLE" delimiter so the model treats it as such.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Portfolio snapshot SLO — mirrors src/lib/portfolio/provenance.ts. */
const PORTFOLIO_SNAPSHOT_MS = 24 * 60 * 60 * 1000;

/** Hard cap on the rendered block so it cannot bloat the system prompt. */
const MAX_BLOCK_LEN = 1_200;

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v);
  // Prisma Decimal
  if (v !== null && typeof v === "object" && "toNumber" in v) {
    return (v as { toNumber(): number }).toNumber();
  }
  return 0;
}

/** Next UTC end-of-month boundary from `now` (matches portfolio.ts cadence). */
function nextEndOfMonth(now: Date): Date {
  const eom = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 0),
  );
  if (now.getUTCDate() === eom.getUTCDate()) {
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59, 59, 0),
    );
  }
  return eom;
}

/**
 * Human-readable provenance qualifier appended after each figure so the model
 * can explain freshness ("live", "estimated", "stale") truthfully.
 */
function qualifierLabel(p: Provenance): string {
  switch (p) {
    case "live":
      return "live";
    case "oracle":
      return "oracle";
    case "attested":
      return "attested";
    case "estimated":
      return "estimated";
    case "manual":
      return "manual";
    case "partial":
      return "partiel";
    case "stale":
      return "stale";
    case "simulated":
      return "simulated";
  }
}

/** Compact USDC formatting — whole dollars, thousands separated. */
function fmtUsdc(n: number): string {
  // en-US gives a stable ASCII "," grouping (fr-FR emits a narrow no-break
  // space that varies by ICU build); swap "," for a plain space afterwards.
  return Math.round(n).toLocaleString("en-US").replace(/,/g, " ");
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const ALLOCATION_LABELS: Record<string, string> = {
  mining: "mining",
  usdc_base: "USDC base",
  btc_tactical: "BTC tactique",
  stable_reserve: "reserve stable",
};

// ---------------------------------------------------------------------------
// buildPortfolioContextBlock
// ---------------------------------------------------------------------------

/**
 * Build a compact, structured text block describing the passed user's OWN
 * portfolio (value, YTD yield, next distribution, allocation breakdown), each
 * figure carrying a provenance qualifier (live / estimated / stale / …).
 *
 * Returns null when there is nothing to surface: no Investor row for this user,
 * or an investor with zero positions (a brand-new account has no portfolio to
 * describe — the assistant should not fabricate one).
 *
 * @param userId authenticated User.id — the ONLY scoping key.
 * @param now    clock injection point (defaults to wall-clock); kept explicit so
 *               tests get deterministic provenance/freshness without faking time.
 */
export async function buildPortfolioContextBlock(
  userId: string,
  now: Date = new Date(),
): Promise<string | null> {
  const investor = await prisma.investor.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!investor) return null;

  const ytdStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));

  const [positions, ytdTxs, latestSnapshot] = await Promise.all([
    prisma.position.findMany({
      where: { investorId: investor.id },
      orderBy: { subscribedAt: "desc" },
      select: {
        principalUsdc: true,
        accruedYieldUsdc: true,
      },
      take: 100,
    }),
    prisma.investorTransaction.findMany({
      where: {
        investorId: investor.id,
        type: { in: ["claim", "distribution"] },
        occurredAt: { gte: ytdStart },
      },
      select: { amountUsdc: true },
      take: 100,
    }),
    prisma.vaultSnapshot.findFirst({
      orderBy: { takenAt: "desc" },
      select: { takenAt: true, allocations: true },
    }),
  ]);

  // No positions → no portfolio to describe. The cockpit-memory block (recent
  // chats) still covers a brand-new user; this block stays portfolio-specific.
  if (positions.length === 0) return null;

  // --- Total value (principal + accrued) ---------------------------------
  const totalValueUsdc = positions.reduce(
    (sum, p) => sum + toNumber(p.principalUsdc) + toNumber(p.accruedYieldUsdc),
    0,
  );

  // --- YTD yield (realised distributions + accrued, like loadPortfolio) ---
  const totalYieldYtdUsdc =
    ytdTxs.reduce((sum, t) => sum + toNumber(t.amountUsdc), 0) +
    positions.reduce((sum, p) => sum + toNumber(p.accruedYieldUsdc), 0);

  // Provenance: positions are read live, but their freshness is bounded by the
  // latest vault snapshot when one exists. No snapshot within the SLO → stale.
  const snapshotFresh =
    latestSnapshot != null &&
    now.getTime() - latestSnapshot.takenAt.getTime() <= PORTFOLIO_SNAPSHOT_MS &&
    now.getTime() - latestSnapshot.takenAt.getTime() >= 0;

  // `resolveProvenance` collapses source + freshness to a canonical kind; with
  // a fresh snapshot it stays "live", otherwise it falls through to "stale".
  const valueProvenance: Provenance = resolveProvenance(
    "live",
    latestSnapshot?.takenAt ?? null,
    "live",
  );
  // YTD yield mixes realised (live ledger) + accrued (estimated) → "estimated"
  // when fresh, "stale" when the underlying snapshot is stale.
  const yieldProvenance: Provenance = snapshotFresh ? "estimated" : "stale";

  const lines: string[] = [];
  lines.push(
    `- Valeur totale : ${fmtUsdc(totalValueUsdc)} USDC (${qualifierLabel(valueProvenance)})`,
  );
  lines.push(
    `- Rendement cumule YTD : ${fmtUsdc(totalYieldYtdUsdc)} USDC (${qualifierLabel(yieldProvenance)})`,
  );
  lines.push(
    `- Prochaine distribution : ${fmtDate(nextEndOfMonth(now))} (estimated)`,
  );

  // --- Allocation breakdown (vault-level) ---------------------------------
  const allocations = latestSnapshot?.allocations ?? [];
  if (allocations.length > 0) {
    const allocProvenance: Provenance = snapshotFresh ? "live" : "stale";
    const parts = allocations.map((a) => {
      const label = ALLOCATION_LABELS[a.bucket] ?? a.bucket;
      const pct = Math.round(toNumber(a.pct) * 10) / 10;
      return `${label} ${pct}%`;
    });
    lines.push(
      `- Allocation : ${parts.join(", ")} (${qualifierLabel(allocProvenance)})`,
    );
  }

  if (latestSnapshot) {
    lines.push(`- Dernier snapshot vault : ${fmtDate(latestSnapshot.takenAt)}`);
  }

  const block = lines.join("\n").slice(0, MAX_BLOCK_LEN);
  // Fail-safe: if DB data somehow contains a forbidden word, drop the block
  // rather than injecting a compliance violation into the system prompt.
  if (chatOutputViolation(block, true)) return null;
  return block;
}
