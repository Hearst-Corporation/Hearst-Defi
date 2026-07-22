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

// v3.0 mining note = 3 on-chain pockets (B1 Mining Power 40% / B2 BTC Pouch 27%
// / B3 Reserve USDC 33%). Legacy four-sleeve snapshot keys are kept as fallbacks
// so historical snapshots still render a human label rather than a raw bucket id.
const ALLOCATION_LABELS: Record<string, string> = {
  mining_power: "Mining Power",
  btc_pouch: "BTC Pouch",
  reserve_usdc: "Reserve USDC",
  // legacy four-sleeve keys (pre-v3.0 snapshots)
  mining: "Mining Power",
  usdc_base: "Reserve USDC",
  btc_tactical: "BTC Pouch",
  stable_reserve: "Reserve USDC",
};

// ---------------------------------------------------------------------------
// buildPortfolioContextBlock
// ---------------------------------------------------------------------------

/**
 * Build a compact, structured text block describing the passed user's OWN
 * portfolio (value, accumulation to date, pocket allocation breakdown), each
 * figure carrying a provenance qualifier (live / estimated / stale / …). The
 * v3.0 mining note accumulates BTC to maturity — there is no periodic cash
 * distribution to surface, so this block never asserts a "next distribution".
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
        // `accruedYieldUsdc` is deliberately NOT selected. No process computes
        // that column (it holds its `@default(0)`; only demo fixtures write
        // it), and Series 1 pays no yield — summing it here used to inflate
        // "Valeur totale" and feed a merged realized+accrued figure the model
        // then restated in prose as fact. Same contract as
        // `loadPortfolio()` post-0082a3ea: principal is the value.
        principalUsdc: true,
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

  // --- Deployed capital (principal only) ----------------------------------
  // The old "Valeur totale" added `accruedYieldUsdc` on top — a column nothing
  // computes — so the model stated an inflated value as fact. Principal is the
  // one figure the ledger actually holds; it is labelled as what it is
  // (capital deployed), not as a mark-to-book value nobody measures.
  const deployedUsdc = positions.reduce((sum, p) => sum + toNumber(p.principalUsdc), 0);

  // --- Realized payouts YTD (ledger rows ONLY) -----------------------------
  // Same contract as `loadPortfolio().realizedYtdUsdc` post-0082a3ea: dollars
  // that actually left the vault. The accrued leg is gone — merging the two
  // produced one number no reader (least of all an LLM restating it in prose)
  // could take apart. A 0 here is a real measurement: no payout happened.
  const realizedYtdUsdc = ytdTxs.reduce((sum, t) => sum + toNumber(t.amountUsdc), 0);

  // Freshness of the vault-global snapshot. It bounds how current the
  // vault-level lines below are; it says nothing about the ledger rows above,
  // which are read live.
  const snapshotFresh =
    latestSnapshot != null &&
    now.getTime() - latestSnapshot.takenAt.getTime() <= PORTFOLIO_SNAPSHOT_MS &&
    now.getTime() - latestSnapshot.takenAt.getTime() >= 0;

  const valueProvenance: Provenance = resolveProvenance(
    "live",
    latestSnapshot?.takenAt ?? null,
    "live",
  );

  const lines: string[] = [];
  lines.push(
    `- Capital deploye : ${fmtUsdc(deployedUsdc)} USDC (${qualifierLabel(valueProvenance)}) — principal du ledger`,
  );
  lines.push(
    realizedYtdUsdc > 0
      ? `- Paiements recus YTD : ${fmtUsdc(realizedYtdUsdc)} USDC (live) — lignes de ledger reelles`
      : `- Paiements recus YTD : aucun paiement enregistre (live)`,
  );
  // Series 1 accumulates BTC to maturity: no yield accrues and no periodic
  // distribution exists. Stated as a product fact so the model answers the
  // inevitable question instead of inventing a figure or a date.
  lines.push(
    `- Accrual : non applicable — Series 1 accumule du BTC vers la maturite, aucun rendement periodique`,
  );

  // --- Allocation breakdown (vault snapshot — NON-AUTHORITATIVE) -----------
  // `VaultSnapshot.allocations` uses the legacy four-sleeve taxonomy and is
  // written by a cron/seed, while the UI reads the contract's B1/B2/B3 target
  // via the backend. The two are not reconciled, so the snapshot must never be
  // stated as the live allocation — the model gets it as an explicitly dated,
  // non-authoritative reading, or an honest "not reported" when absent/stale.
  const allocations = latestSnapshot?.allocations ?? [];
  if (allocations.length > 0 && snapshotFresh) {
    const parts = allocations.map((a) => {
      const label = ALLOCATION_LABELS[a.bucket] ?? a.bucket;
      const pct = Math.round(toNumber(a.pct) * 10) / 10;
      return `${label} ${pct}%`;
    });
    lines.push(
      `- Allocation (snapshot vault du ${fmtDate(latestSnapshot!.takenAt)}, non contractuelle) : ${parts.join(", ")}`,
    );
  } else {
    lines.push(
      `- Allocation : non rapportee — cible contractuelle B1 40% / B2 27% / B3 33% (spec, pas une mesure)`,
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
