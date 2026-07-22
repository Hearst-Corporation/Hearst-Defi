import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import type { InvestorMemoProvenance } from "@/lib/agents/investor-memo";
import type { ProvenanceTag } from "@/lib/agents/schemas";
import { evaluateFreshness, STALE_THRESHOLDS } from "@/lib/data/freshness";
import { authoritativeVaultSnapshotWhere } from "@/lib/data/snapshot-sources";
import { isLiveTimelineSource } from "@/lib/data/timeline-snapshot";
import { loadCoverageForVault } from "@/lib/agents/loaders/coverage";
import type { CoverageViewProvenance } from "@/lib/engine/coverage-view";
import type {
  BacktestOutput,
  ScenarioOutput,
  VaultId,
} from "@/lib/engine/types";
import { VAULTS, VAULT_YIELD } from "@/lib/engine/vaults";

/**
 * Shape returned to the Investor Memo cron — mirrors `InvestorMemoInput` but
 * declared independently so the loader does not import from `investor-memo.ts`
 * (which pulls the LLM client at module init).
 */
export interface MemoLoadResult {
  vault: {
    /** Vault id this memo run is bound to (ADR-006 #9). */
    id: VaultId;
    /** Human label, e.g. "Hearst Yield Vault". */
    name: string;
    aumUsdc: number;
    apyRange: { low: number; high: number };
    mode: string;
    riskScore: number;
    /** Vault's OWN assumptions — cited verbatim by the memo agent. */
    assumptions: string[];
  };
  /**
   * ALWAYS empty. The v1.0 4-sleeve scenario engine (mining / btc_tactical /
   * usdc_base / stable_reserve) has been retired; the memo no longer narrates a
   * scenario projection, so the loader never reads `ScenarioRun`. The field is
   * kept on the shape (never removed) so downstream consumers that iterate it
   * (`investor-memo.ts`, `investor-memo-monthly.ts` ReportExport) keep compiling
   * and simply see nothing to narrate.
   */
  scenarios: ScenarioOutput[];
  /** ALWAYS empty — same retirement as `scenarios`; no `BacktestRun` is read. */
  backtests: BacktestOutput[];
  generatedAt: string;
  /**
   * Per-section provenance (CLAUDE.md non-negotiable #2) threaded to the memo
   * agent so every cited number is qualified. Resolved from the live signals
   * the loaders already compute: vault-snapshot freshness, coverage view.
   */
  provenance: InvestorMemoProvenance;
}

/**
 * Maps the coverage view's provenance vocabulary onto the agent's
 * `ProvenanceTag`. `invalid` (a value that failed the engine guard) collapses
 * to `pending` because no trustworthy number exists for the agent to cite.
 */
function coverageProvenanceToTag(p: CoverageViewProvenance): ProvenanceTag {
  switch (p) {
    case "live":
      return "live";
    case "estimated":
      return "estimated";
    case "pending":
      return "pending";
    case "invalid":
      return "pending";
  }
}

function resolveVaultDefinition(vaultId: string | undefined) {
  if (vaultId === undefined) return VAULT_YIELD;
  if (vaultId === "yield" || vaultId === "defensive" || vaultId === "btc-plus") {
    return VAULTS[vaultId];
  }
  // Reject unknown ids loudly — the memo would otherwise mix a phantom vault
  // identity into a structured artifact that ships to investors. ADR-006 #9.
  throw new Error(
    `loadMemoInput: unknown vaultId="${vaultId}". Known ids: yield, defensive, btc-plus.`,
  );
}

/**
 * Loads the latest vault snapshot and the distribution-coverage view for the
 * Investor Memo.
 *
 * Scenario / backtest retirement: the v1.0 4-sleeve scenario engine is gone,
 * so this loader no longer reads `ScenarioRun` / `BacktestRun`. Surfacing a
 * frozen, dead projection into an opposable document is forbidden — `scenarios`
 * and `backtests` are returned empty and the memo narrates neither. Only the
 * live vault snapshot + coverage view feed the memo now.
 */
export async function loadMemoInput(
  vaultId?: string,
): Promise<MemoLoadResult> {
  const def = resolveVaultDefinition(vaultId);
  const period = currentPeriod();

  const [snapshot, coverage] = await Promise.all([
    // Seed guard: authoritative sources only — a reappeared demo_seed row is never served.
    prisma.vaultSnapshot.findFirst({
      where: authoritativeVaultSnapshotWhere(),
      orderBy: { takenAt: "desc" },
    }),
    // Coverage view carries its own live/estimated/pending/invalid provenance
    // (never fabricates a number). We read it ONLY to qualify the coverage
    // section of the memo — non-negotiable #2.
    loadCoverageForVault(def.id, period),
  ]);

  if (!snapshot) {
    throw new Error("Vault state incomplete. Run pnpm db:seed first.");
  }

  // Decimal → number at the loader boundary (engine/agent shapes are `number`).
  // ADR-006 #9: the AUM/risk/mode fields come from the live snapshot (Yield
  // Vault timeline — per-vault snapshots land with Phase 3); but the headline
  // apy range, label and assumptions are pinned to the REQUESTED vault's own
  // engine preset so two vaults never share the same projection text.
  const liveVault = projectVault(toVaultSnapshotRow(snapshot));
  const vault: MemoLoadResult["vault"] = {
    id: def.id,
    name: def.label,
    aumUsdc: liveVault.aumUsdc,
    apyRange: { low: def.apyTarget.low, high: def.apyTarget.high },
    mode: liveVault.mode,
    riskScore: liveVault.riskScore,
    assumptions: [...def.assumptions],
  };

  // Provenance (CLAUDE.md #2):
  //   - vault / mining numbers come from the latest VaultSnapshot — attested
  //     while the snapshot is within its freshness SLO, else stale. BUT
  //     freshness alone doesn't prove authenticity: `source` values like
  //     "computed" (engine preset run) and "daily-seed" (synthetic seeded
  //     timeline, see prisma/seed.ts) are never real measurements, no matter
  //     how recent `takenAt` is — `isLiveTimelineSource()` already encodes
  //     this distinction for the admin dashboard (`timeline-snapshot.ts`);
  //     the memo loader must honour the same rule so an unfiltered
  //     "latest snapshot" query can never badge seed/preset data as attested.
  //   - coverage carries its own resolved provenance (live/estimated/pending).
  //   - scenarios + backtests are retired (no engine, empty arrays). They carry
  //     no data to qualify; the provenance tags are left `pending` — the tag
  //     that means "no trustworthy number exists" — so nothing can read as
  //     attested off an empty projection.
  const snapshotTag: ProvenanceTag = !isLiveTimelineSource(snapshot.source)
    ? "estimated"
    : evaluateFreshness(snapshot.takenAt, STALE_THRESHOLDS.portfolio_snapshot) ===
        "stale"
      ? "stale"
      : "attested";
  const provenance: InvestorMemoProvenance = {
    vault: snapshotTag,
    mining: snapshotTag,
    coverage: coverageProvenanceToTag(coverage.provenance),
    scenarios: "pending",
    backtests: "pending",
  };

  return {
    vault,
    // Scenario engine retired — nothing to narrate, never read from the DB.
    scenarios: [],
    backtests: [],
    generatedAt: new Date().toISOString(),
    provenance,
  };
}

/** Current calendar period "YYYY-MM" used to scope the coverage lookup. */
function currentPeriod(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ---------------------------------------------------------------------------
// Vault projection
// ---------------------------------------------------------------------------

interface VaultSnapshotRow {
  aumUsdc: number;
  currentApyLow: number;
  currentApyHigh: number;
  riskScore: number;
  mode: string;
}

/**
 * Maps a raw Prisma `VaultSnapshot` (Decimal financial columns) onto the
 * number-only `VaultSnapshotRow` consumed downstream. Decimal → number happens
 * here, at the data boundary, so the engine/agent layer never sees Decimal.
 */
function toVaultSnapshotRow(row: {
  aumUsdc: Prisma.Decimal;
  currentApyLow: Prisma.Decimal;
  currentApyHigh: Prisma.Decimal;
  riskScore: number;
  mode: string;
}): VaultSnapshotRow {
  return {
    aumUsdc: row.aumUsdc.toNumber(),
    currentApyLow: row.currentApyLow.toNumber(),
    currentApyHigh: row.currentApyHigh.toNumber(),
    riskScore: row.riskScore,
    mode: row.mode,
  };
}

/**
 * Live snapshot projection — narrow shape produced from the latest
 * `VaultSnapshot`. The full `MemoLoadResult["vault"]` is assembled in
 * `loadMemoInput` by composing this with the requested vault's engine preset
 * (id, name, apyRange, assumptions) so two different vaults never share the
 * same projection text (ADR-006 #9).
 */
interface LiveVaultProjection {
  aumUsdc: number;
  apyRange: { low: number; high: number };
  mode: string;
  riskScore: number;
}

function projectVault(row: VaultSnapshotRow): LiveVaultProjection {
  return {
    aumUsdc: row.aumUsdc,
    apyRange: { low: row.currentApyLow, high: row.currentApyHigh },
    mode: row.mode,
    riskScore: row.riskScore,
  };
}

// ---------------------------------------------------------------------------
// Monthly history — drives the "Trailing 4-month performance" PDF table.
// ---------------------------------------------------------------------------

/**
 * Monthly row consumed by the Performance Overview PDF page. Each row carries
 * the `VaultSnapshot` NAV + APY range for the month.
 *
 * v3.0 note: the note accumulates BTC over its term with rule-based
 * take-profit and pays NO periodic cash distribution, so no distribution
 * figure is carried here. The previous `apy_achieved` (NAV-delta + dist
 * midpoint) and `distribution_usdc` fields had no consumer and are removed.
 */
export interface VaultMonthlyRow {
  /** Calendar month, "YYYY-MM". */
  period: string;
  /** APY range floor for the month. */
  apy_low: number;
  /** APY range ceiling for the month. */
  apy_high: number;
  /** End-of-month NAV in USDC. */
  nav_usdc: number;
  /**
   * Always `false` since the synthetic padding was removed: every row is a
   * real `VaultSnapshot` month. The field survives because the PDF contract
   * (`performance-overview.tsx`) branches on it for its provenance badge —
   * dropping it would churn that contract for no truth gain. If a synthetic
   * row ever reappears, it must be a deliberate, flagged decision, not a pad.
   */
  is_synthetic: boolean;
}

/**
 * Loads up to `months` monthly snapshots from the latest `VaultSnapshot`
 * rows (NAV + APY range only).
 *
 * Decision: we group `VaultSnapshot` rows by calendar month and pick the
 * most recent row in each month as the "end-of-month" anchor. This keeps the
 * loader robust to the seed pattern (which writes one snapshot per preset on
 * adjacent days).
 *
 * No padding: fewer real months than requested returns fewer rows, and no
 * history returns []. The renderer owns the empty state — it already promises
 * "No history → NO fabricated row", and the previous synthetic fill (drifted
 * NAV, hardcoded 9.0–13.0 band, `nav ?? aumUsdc ?? 0` anchor) broke that
 * promise inside an investor-facing document.
 */
export async function loadVaultMonthlyHistory(
  months: number,
): Promise<VaultMonthlyRow[]> {
  if (!Number.isFinite(months) || months <= 0) {
    return [];
  }
  const safeMonths = Math.floor(months);

  // Pull a generous slice so we can de-dupe by month and still land on
  // `safeMonths` distinct calendar months.
  //
  // IMPORTANT: filter to source="backfill" only. The "daily-seed" and
  // "computed" rows are written at a different NAV scale (~10–12 M) compared
  // to the authoritative backfill series (~17–26 M). Mixing them creates a
  // giant apparent drawdown (≈ −62%) that makes every ratio nonsensical.
  // The backfill rows are the canonical monthly history; daily-seed rows are
  // used only for real-time dashboard display, not for risk ratio computation.
  const snapshots = await prisma.vaultSnapshot.findMany({
    where: { source: "backfill" },
    orderBy: { takenAt: "desc" },
    take: safeMonths * 6,
    select: {
      takenAt: true,
      aumUsdc: true,
      currentApyLow: true,
      currentApyHigh: true,
    },
  });

  // Group by YYYY-MM and keep the most recent snapshot per month.
  const byMonth = new Map<string, MonthlyAnchorSnapshot>();
  for (const s of snapshots) {
    const period = periodOf(s.takenAt);
    if (!byMonth.has(period)) {
      byMonth.set(period, {
        period,
        // Decimal → number at the read boundary.
        aumUsdc: s.aumUsdc.toNumber(),
        currentApyLow: s.currentApyLow.toNumber(),
        currentApyHigh: s.currentApyHigh.toNumber(),
        takenAt: s.takenAt,
      });
    }
  }
  const anchors = Array.from(byMonth.values())
    .sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime())
    .slice(-safeMonths);

  const real: VaultMonthlyRow[] = [];
  for (let i = 0; i < anchors.length; i += 1) {
    const cur = anchors[i];
    if (!cur) continue;
    real.push({
      period: cur.period,
      apy_low: cur.currentApyLow,
      apy_high: cur.currentApyHigh,
      nav_usdc: cur.aumUsdc,
      is_synthetic: false,
    });
  }

  // Short history is short history. This function used to pad the head with
  // fabricated months — NAV derived from an anchor by an arbitrary drift
  // (`1 - i*0.008`), APY band hardcoded to 9.0–13.0 — whose anchor was
  // `nav ?? aumUsdc ?? 0`: an unreconciled snapshot figure, or a literal zero,
  // dressed up as a month that never happened. The rows were flagged
  // `is_synthetic`, but they still put invented NAV figures and an invented
  // return band into an INVESTOR-FACING PDF, and the renderer
  // (performance-overview.tsx) already promises the opposite: "No history →
  // NO fabricated row". The loader now keeps that promise: only months a real
  // backfill snapshot attests are returned, and a caller asking for 4 months
  // of a 2-month-old product gets 2 rows.
  return real.slice(-safeMonths);
}

interface MonthlyAnchorSnapshot {
  period: string;
  aumUsdc: number;
  currentApyLow: number;
  currentApyHigh: number;
  takenAt: Date;
}

function periodOf(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

