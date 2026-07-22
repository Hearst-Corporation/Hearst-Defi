import "server-only";

import { type VaultDeployment } from "@prisma/client";
import { prisma } from "@/lib/db";
import { resolveMinTicketUsdc } from "@/lib/vaults/min-ticket";

// ---------------------------------------------------------------------------
// VaultProduct — the canonical shape consumed by /vaults and /vaults/[id].
// Multi-vault enabled per ADR-006 (lifts #9): Yield / Defensive / BTC Plus.
// Each vault carries its own assumptions/share-class/provenance — derived from
// the engine VaultDefinition presets so numbers are never duplicated.
// ---------------------------------------------------------------------------

export interface VaultProduct {
  id: string;
  ticker: string;
  name: string;
  description: string;
  strategy: "mining_yield" | "btc_tactical" | "stable_reserve";
  status: "live" | "draft" | "review" | "paused" | "closed";
  apyLow: number; // %, e.g. 9.4
  apyHigh: number;
  /**
   * EFFECTIVE minimum ticket in whole USDC — the deployment's own
   * `minTicketUsdc` column, lowered by the `MIN_TICKET_USDC` env override when
   * one is configured (see src/lib/vaults/min-ticket.ts).
   *
   * This is the number the invest form renders AND gates on
   * (`amount >= vault.minTicketUsdc`), so it MUST equal the floor
   * `validateMinTicket` enforces server-side after the on-chain deposit
   * settles — otherwise the investor's USDC is irreversibly spent while the
   * Position is refused. Both sides call the same resolver; the identity is
   * pinned by src/lib/vaults/__tests__/min-ticket.test.ts.
   */
  minTicketUsdc: number;
  softLockupDays: number;
  capacityUsdc: number;
  /**
   * AUM from the latest VaultSnapshot, or `null` when none applies to this
   * vault. Nullable rather than 0 because "no snapshot exists for this vault
   * yet" and "this vault holds nothing" are different statements, and only the
   * second is a figure we are entitled to display.
   */
  currentAumUsdc: number | null;
  fees: { mgmtBps: number; perfBps: number; hurdleBps: number };
  riskLevel: "low" | "low-moderate" | "moderate" | "high";
  spvJurisdiction: string;
  shareClass: string;
  regExemption: string;
  disclaimers: string;
  // Target allocations per bucket (basis points, 0–10000)
  targetMiningBps: number;
  targetBtcTacticalBps: number;
  targetUsdcBaseBps: number;
  targetStableReserveBps: number;
}

// ---------------------------------------------------------------------------
// Map Prisma VaultDeployment row → VaultProduct.
// VaultDeployment.status uses "deployed" instead of "live" — normalise here.
// ---------------------------------------------------------------------------

function normaliseStatus(
  raw: string,
): VaultProduct["status"] {
  const map: Record<string, VaultProduct["status"]> = {
    live: "live",
    deployed: "live",
    draft: "draft",
    review: "review",
    paused: "paused",
    closed: "closed",
  };
  return map[raw] ?? "draft";
}

function normaliseStrategy(
  raw: string,
): VaultProduct["strategy"] {
  if (
    raw === "mining_yield" ||
    raw === "btc_tactical" ||
    raw === "stable_reserve"
  )
    return raw;
  return "mining_yield";
}

function riskLevelFromBps(
  apyHighBps: number,
  miningBps: number,
  btcTacticalBps: number,
): VaultProduct["riskLevel"] {
  // High: opportunistic/high-APY vaults (e.g. BTC-Plus targeting >12%)
  if (apyHighBps > 1200 && btcTacticalBps >= 3000) return "high";
  // Moderate: heavy mining exposure (>= 75%) or very high APY ceiling
  if (miningBps >= 7500 || apyHighBps > 1800) return "moderate";
  // Low-moderate: meaningful mining or BTC tactical exposure
  if (miningBps >= 5000 || btcTacticalBps >= 2000) return "low-moderate";
  return "low";
}

function toVaultProduct(row: VaultDeployment, aumUsdc: number | null): VaultProduct {
  const miningBps = row.targetMiningBps;
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    description: row.description ?? "",
    strategy: normaliseStrategy(row.strategy),
    status: normaliseStatus(row.status),
    apyLow: row.targetApyLowBps / 100,
    apyHigh: row.targetApyHighBps / 100,
    // The deployment's configured minimum is the BASE; the env override (when
    // set) lowers it. Applied at this single read boundary so every consumer of
    // VaultProduct — product cards, term sheet, invest form + its PTAI
    // projection — shows one number, and it is the number subscribe() enforces.
    minTicketUsdc: resolveMinTicketUsdc(row.minTicketUsdc.toNumber()),
    softLockupDays: row.softLockupDays,
    capacityUsdc: row.capacityUsdc.toNumber(),
    currentAumUsdc: aumUsdc,
    fees: {
      mgmtBps: row.mgmtFeeBps,
      perfBps: row.perfFeeBps,
      hurdleBps: row.hurdleBps,
    },
    riskLevel: riskLevelFromBps(row.targetApyHighBps, miningBps, row.targetBtcTacticalBps),
    spvJurisdiction: row.spvJurisdiction,
    shareClass: row.shareClass,
    regExemption: row.regExemption,
    disclaimers: row.disclaimers,
    targetMiningBps: row.targetMiningBps,
    targetBtcTacticalBps: row.targetBtcTacticalBps,
    targetUsdcBaseBps: row.targetUsdcBaseBps,
    targetStableReserveBps: row.targetStableReserveBps,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// Yield Vault recognition — ADR-006 #9: the current `VaultSnapshot` schema is
// not yet keyed per vault, so the only snapshot we hold is the Hearst Yield
// Vault timeline. Any other row in `VaultDeployment` MUST keep `currentAumUsdc
// = null` until Phase 3 adds `VaultSnapshot.vaultDeploymentId`; otherwise the
// Yield AUM would silently appear under every vault's card. Null, not 0: we do
// not know these vaults' AUM, and 0 would assert that we do.
function isYieldVaultRow(row: VaultDeployment): boolean {
  return (
    row.ticker === "HYV-A" ||
    row.ticker.toUpperCase().startsWith("HYV") ||
    row.id === "hearst-yield-vault"
  );
}

/**
 * A vault row is a placeholder (not a real on-chain deployment) when its
 * `contractAddress` is missing, the zero address, or follows the
 * `0x00…00N` pattern used by seed scripts (F2/F3 testnet fixtures, etc.).
 *
 * Honesty rule: nothing the user sees on `/vaults` or `/vaults/[id]` may
 * reference a contract that does not actually exist on-chain. Placeholders
 * stay in the DB for schema consistency but are filtered out at the read
 * boundary.
 */
function isPlaceholderVault(row: VaultDeployment): boolean {
  const addr = row.contractAddress?.toLowerCase().trim() ?? "";
  if (!addr) return true;
  // Strip "0x" then check that everything but the last char is "0".
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr;
  if (hex.length !== 40) return false; // not an EVM address — leave it alone
  return /^0{39}[0-9a-f]$/.test(hex);
}

/**
 * The catalogue of real vaults.
 *
 * THROWS when the database cannot be read. The previous `catch { return [] }`
 * collapsed an outage into the empty catalogue, which the UI renders as the
 * honest, reassuring statement "there are no vaults on offer" — a claim we
 * cannot make when we do not know. Letting the rejection propagate hands the
 * decision to the caller's error boundary, where it renders as a failure
 * instead of as an answer.
 *
 * An empty array retains its single meaning: the DB answered, and holds no
 * non-placeholder vault.
 */
export async function listVaults(): Promise<VaultProduct[]> {
  const rows = await prisma.vaultDeployment.findMany({
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  // Drop placeholder rows — we never advertise vaults that don't have a
  // real on-chain contract behind them (see isPlaceholderVault).
  const realRows = rows.filter((row) => !isPlaceholderVault(row));
  if (realRows.length === 0) return [];

  // Fetch the latest AUM snapshot — only applied to the Yield Vault row.
  // Non-Yield vaults keep a null AUM until per-vault snapshots land (Phase 3).
  const latestSnapshots = await prisma.vaultSnapshot.findMany({
    orderBy: { takenAt: "desc" },
    take: 1,
  });
  const latestAum = latestSnapshots[0]?.aumUsdc?.toNumber() ?? null;

  return realRows.map((row) =>
    toVaultProduct(row, isYieldVaultRow(row) ? latestAum : null),
  );
}

/**
 * One vault by id or ticker.
 *
 * `null` means exactly one thing: the DB was read and holds no such (non-
 * placeholder) vault. THROWS when the DB cannot be read — the removed
 * `catch { return null }` overloaded `null` with a second, contradictory
 * meaning, so a transient outage made `/vaults/[id]` answer "this vault does
 * not exist" about a vault that does, and made subscribe() reject a valid
 * order as "Vault not found." A rejected promise cannot be mistaken for a
 * verdict on the vault's existence.
 */
export async function getVault(
  idOrTicker: string,
): Promise<VaultProduct | null> {
  const upper = idOrTicker.toUpperCase();
  const [row, snapshot] = await Promise.all([
    prisma.vaultDeployment.findFirst({
      where: {
        OR: [{ id: idOrTicker }, { ticker: upper }],
      },
    }),
    prisma.vaultSnapshot.findFirst({
      orderBy: { takenAt: "desc" },
    }),
  ]);
  if (!row) return null;
  // Treat placeholders as non-existent for the consumer surface — the row
  // stays in the DB for schema continuity, but `/vaults/[id]` 404s on it.
  if (isPlaceholderVault(row)) return null;

  // Same honesty rule as listVaults(): the single VaultSnapshot timeline is
  // the Yield Vault's. Non-Yield vaults must NOT inherit the Yield AUM — they
  // carry an unknown (null) AUM until per-vault snapshots land (Phase 3,
  // ADR-006 #9).
  const aumUsdc = isYieldVaultRow(row)
    ? (snapshot?.aumUsdc?.toNumber() ?? null)
    : null;

  return toVaultProduct(row, aumUsdc);
}
