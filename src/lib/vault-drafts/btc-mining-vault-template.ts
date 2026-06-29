/**
 * btc-mining-vault-template.ts — a PURE vault-draft TEMPLATE for the committed
 * BTC Mining Performance Vault (`src/lib/products/*`).
 *
 * This is a TEMPLATE, never a created record: it returns the documented draft
 * sections as structured data + markdown, and (optionally) a `CreateDraftInput`
 * shape pre-shaped with allocation MIDPOINTS and an APY RANGE (low/high bps,
 * never a single point) so a human can review it before anything is persisted.
 * Nothing here writes, deploys, or runs — it builds an object.
 *
 * STRICT pure contract (mirrors the engine discipline): no I/O, no process.env,
 * no Date.now(), no Math.random(), no module-level side effect, no argument
 * mutation. It only READS the product constant + pure guards — it never modifies
 * a Builder A file.
 *
 * Honesty rules (non-negotiables #1, #5, #10; doc §12, §22):
 *  - the template NEVER contains "guaranteed APY", "guaranteed principal",
 *    "risk-free", "fixed income", or "secured profit" — asserted by tests AND by
 *    the canonical forbidden-words guard;
 *  - the distribution and total targets are the two SAFE strings — never summed;
 *  - the mapped `CreateDraftInput` carries an APY RANGE and disclaimers that state
 *    both the not-validated and the not-guaranteed notes.
 */

import {
  BTC_MINING_PERFORMANCE_VAULT,
  type BtcMiningPerformanceVault,
} from "@/lib/products/btc-mining-performance-vault";
import { formatTargetsSafely } from "@/lib/products/guards";
import { containsForbidden } from "@/lib/agents/forbidden-words";
import type { CreateDraftInput } from "@/app/admin/vaults/schema";

// ---------------------------------------------------------------------------
// Section model
// ---------------------------------------------------------------------------

/** Canonical section ids — the documented vault-draft structure (doc §1–§22). */
export type BtcMiningVaultSectionId =
  | "product-thesis"
  | "target-investor"
  | "allocation-bands"
  | "mining-floor"
  | "btc-collateral-role"
  | "stable-funding-engine"
  | "monthly-distribution-target"
  | "total-performance-target"
  | "exit-conditions"
  | "recovery-plan"
  | "machine-lifecycle"
  | "operator-economics"
  | "risk-controls"
  | "data-status"
  | "open-validation-items";

export interface BtcMiningVaultSection {
  readonly id: BtcMiningVaultSectionId;
  readonly title: string;
  /** Body lines — plain prose; rendered as a list or markdown by the caller. */
  readonly body: readonly string[];
}

export interface BtcMiningVaultDraftTemplate {
  readonly productId: "btc-mining-performance-vault";
  readonly name: string;
  readonly sections: readonly BtcMiningVaultSection[];
  /** Full template as a single markdown document (sections joined). */
  readonly markdown: string;
  /** A reviewable CreateDraftInput shape — TEMPLATE only, never persisted. */
  readonly draftInput: CreateDraftInput;
}

// The fifteen documented section ids, in canonical order.
export const BTC_MINING_VAULT_SECTION_IDS: readonly BtcMiningVaultSectionId[] = [
  "product-thesis",
  "target-investor",
  "allocation-bands",
  "mining-floor",
  "btc-collateral-role",
  "stable-funding-engine",
  "monthly-distribution-target",
  "total-performance-target",
  "exit-conditions",
  "recovery-plan",
  "machine-lifecycle",
  "operator-economics",
  "risk-controls",
  "data-status",
  "open-validation-items",
] as const;

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function pct(f: number): number {
  return Math.round(f * 100);
}

/** Allocation MIDPOINT (percent) for a [min,max] fraction band. */
function midPct(min: number, max: number): number {
  return Math.round(((min + max) / 2) * 100);
}

function buildSections(
  product: BtcMiningPerformanceVault,
): readonly BtcMiningVaultSection[] {
  const a = product.allocation;
  const safe = formatTargetsSafely(product);
  const lev = product.levers;

  return [
    {
      id: "product-thesis",
      title: "Product thesis",
      body: [
        `${product.name} — ${product.thesis}.`,
        "A real Bitcoin mining operation packaged into an investable performance cycle: mining production, a BTC core holding, stable financing, rule-based rebalancing, and a documented recovery plan.",
        "Target and expected, risk-adjusted and collateral-protected — never guaranteed.",
      ],
    },
    {
      id: "target-investor",
      title: "Target investor",
      body: [
        "Institutions, family offices, and qualified/accredited investors seeking real-asset-backed Bitcoin exposure with a defined performance cycle — not passive spot or yield farming.",
        "Class A — institutional: $250k minimum, 60-day soft lock-up, 100 bps management / 1000 bps performance.",
        "Comfortable with BTC price, hashprice, difficulty, USDC-yield and borrow-rate variability; returns are target ranges, not guaranteed.",
      ],
    },
    {
      id: "allocation-bands",
      title: "Allocation bands",
      body: [
        `Mining sleeve: ${pct(a.mining.min)}–${pct(a.mining.max)}% (structural floor ${pct(a.mining.floor)}%).`,
        `BTC holding / collateral: ${pct(a.btcHoldingCollateral.min)}–${pct(a.btcHoldingCollateral.max)}% (core + tactical combined).`,
        `Stable funding reserve: ${pct(a.stableFundingReserve.min)}–${pct(a.stableFundingReserve.max)}%.`,
        `Yield overlay: ${pct(a.yieldOverlay.min)}–${pct(a.yieldOverlay.max)}% on genuine excess liquidity only.`,
        "Indicative regimes, not fixed weights — actual exposure is risk-adjusted and derived at runtime.",
      ],
    },
    {
      id: "mining-floor",
      title: "Mining floor",
      body: [
        `Mining is never below the ${pct(a.mining.floor)}% structural minimum unless explicitly triggered by protection/recovery governance.`,
        "Below ~30% the structure stops being a miner; a sub-floor weight is a governance exception, not a routine allocator outcome.",
      ],
    },
    {
      id: "btc-collateral-role",
      title: "BTC collateral role",
      body: [
        "The BTC core carries the cycle upside and serves as collateral for USDC borrowing at a maintained, risk-adjusted LTV.",
        "BTC is not sold by default to pay electricity; it may be sold only on take-profit / unsafe collateral / debt repayment / waterfall settlement.",
        `LTV ladder: average ~${lev.ltv.value.avg}, trim ${lev.ltv.value.trim}, pay-from-reserve ${lev.ltv.value.buffer}, hard cap ${lev.ltv.value.cap}, lender liquidation ${lev.ltv.value.liquidation}.`,
      ],
    },
    {
      id: "stable-funding-engine",
      title: "Stable Funding Engine",
      body: [
        "The stable reserve does NOT automatically pay electricity. At each settlement point, costs are financed from the cheapest, least-risky source available, subject to collateral and coverage constraints.",
        "Ascending cost: idle stable above runway, spend stable yield, borrow against BTC, unwind stable yield, unwind BTC yield, sell BTC last resort.",
        "Borrowing is vetoed at LTV >= 0.58 or volatility index > 90; the reserve is never pulled below its power-runway floor.",
      ],
    },
    {
      id: "monthly-distribution-target",
      title: "Monthly distribution target",
      body: [
        `${safe.distribution}, paid monthly in USDC — coverage-gated and not guaranteed.`,
        "Coverage = net mining cash / target distribution. Paid only when coverage >= 1.0; suspended below 0.8; never paid by principal erosion.",
      ],
    },
    {
      id: "total-performance-target",
      title: "Total performance target",
      body: [
        `${safe.total}.`,
        "The total target is INCLUSIVE of the monthly distributions — the two layers describe the same cycle and never sum.",
      ],
    },
    {
      id: "exit-conditions",
      title: "Exit conditions",
      body: [
        "Normal maturity exit at the ~24-month cycle, with tranche exits at 12 / 18 / 24 months per the waterfall.",
        "Early target exit if the total performance target is hit sooner; stepped phase exit; protection exit on adverse conditions.",
        "A target outcome, not a guarantee.",
      ],
    },
    {
      id: "recovery-plan",
      title: "Recovery Plan",
      body: [
        `Mandatory ${product.recovery.extensionMonths.min}–${product.recovery.extensionMonths.max} month recovery extension, Mode A (${product.recovery.defaultMode}) default.`,
        "Net mining production is allocated to client capital recovery; operator performance fees suspended/reduced until the recovery waterfall is satisfied.",
        "Recovery maximizes the probability of full capital return — it is not a promise of recovery.",
      ],
    },
    {
      id: "machine-lifecycle",
      title: "Machine lifecycle",
      body: [
        `Machines carry roughly a ${lev.machineLifeYears.value}-year productive life; amortization is cooling-dependent (air ~36mo, hydro/immersion ~60mo).`,
        "0–24mo primary client performance; 24–36mo recovery/continuation if needed; 36–60mo residual operator upside (redeploy / resale / re-run).",
      ],
    },
    {
      id: "operator-economics",
      title: "Operator economics",
      body: [
        "The operator is remunerated on the spread above the client target band plus management/performance fees, machine markup, revenue-share, financing spread, and machine residual value.",
        `Configured levers: ${pct(lev.markupPct.value)}% machine markup, ${pct(lev.revenueSharePct.value)}% revenue-share (client keeps ${100 - pct(lev.revenueSharePct.value)}%), ${pct(lev.borrowAprPct.value)}% borrow APR.`,
        "Operator spread is kept strictly separate from the client distribution and never increases the displayed client number.",
      ],
    },
    {
      id: "risk-controls",
      title: "Risk controls",
      body: [
        "Minimum stable reserve, graduated LTV thresholds, per-vault LTV/borrow caps, human-in-the-loop approval for rebalancing (engine proposes, never auto-executes).",
        "Distribution deferral/suspension (coverage-gated), the recovery extension, machine resale/redeploy, an excess-only yield whitelist, and data-freshness checks with flagged-stale fallbacks.",
      ],
    },
    {
      id: "data-status",
      title: "Data status",
      body: [
        `Product status: ${product.status}. Most levers are CONFIGURED, not validated by a business owner, DB, or audit.`,
        "Live inputs (BTC price, hashprice, USDC yield) carry their own provenance at runtime with conservative flagged-stale fallbacks.",
        "Configured assumptions require admin validation before investor-facing use.",
      ],
    },
    {
      id: "open-validation-items",
      title: "Open validation items",
      body: [
        "Validate the monthly-vs-total target pairing and how ranges are published so they never read as double-counted.",
        "Confirm share-class structure and the canonical fee representation (ADR-008 vs collapsed 2%).",
        "Assign the owner and validation path for every CONFIGURED lever (markup, revenue-share, energy, borrow APR, BTC scenario band) before any are shown live/contractual.",
        "Define the machine resale/redeploy residual-value model (no model in code yet).",
      ],
    },
  ];
}

function sectionsToMarkdown(
  name: string,
  sections: readonly BtcMiningVaultSection[],
): string {
  const head = `# ${name} — vault draft template\n\n> Template only. Status: configured, not validated. Not a created record.\n`;
  const body = sections
    .map((s) => {
      const lines = s.body.map((l) => `- ${l}`).join("\n");
      return `## ${s.title}\n\n${lines}\n`;
    })
    .join("\n");
  return `${head}\n${body}`;
}

/**
 * Disclaimers for the mapped CreateDraftInput. >= 80 chars and intentionally
 * free of any forbidden word — it states the not-validated AND the not-guaranteed
 * notes. (Guarded at build time below so a regression in the wording is caught.)
 */
const DRAFT_DISCLAIMERS =
  "Targets are configured assumptions, not validated contractual terms, and require admin validation before any investor-facing use. The monthly distribution target is coverage-gated and included in the total performance target — the two are never summed. Returns are target and expected ranges, risk-adjusted and collateral-protected; capital recovery is not assured and outcomes depend on BTC price, hashprice, difficulty, USDC yield and borrow-rate conditions.";

function buildDraftInput(product: BtcMiningPerformanceVault): CreateDraftInput {
  const a = product.allocation;
  const d = product.monthlyDistributionTargetAnnualized;

  // Allocation MIDPOINTS in bps. Mapped to the four CreateDraftSchema buckets:
  //   mining → targetMiningBps
  //   BTC core/collateral → targetBtcTacticalBps
  //   yield overlay (deployed excess) → targetUsdcBaseBps
  //   stable funding reserve → targetStableReserveBps (BALANCING REMAINDER so the
  //     four bps always sum to exactly 10000, since .5 midpoints round unevenly:
  //     mining 35, BTC 48, overlay 5 → stable = 100 − 88 = 12).
  const targetMiningBps = midPct(a.mining.min, a.mining.max) * 100;
  const targetBtcTacticalBps =
    midPct(a.btcHoldingCollateral.min, a.btcHoldingCollateral.max) * 100;
  const targetUsdcBaseBps =
    midPct(a.yieldOverlay.min, a.yieldOverlay.max) * 100;
  // The reserve sleeve absorbs the rounding so the schema's exact-10000 invariant
  // always holds. It stays inside the documented 10–15% band (12% midpoint).
  const targetStableReserveBps =
    10_000 - targetMiningBps - targetBtcTacticalBps - targetUsdcBaseBps;

  return {
    ticker: "BTCMPV",
    name: "BTC Mining Performance Vault",
    description:
      "Mining-first BTC performance cycle — configured assumptions, not validated contractual terms.",
    strategy: "mining_yield",
    minTicketUsdc: 250_000,
    capacityUsdc: 10_000_000,
    mgmtFeeBps: 100,
    perfFeeBps: 1000,
    hurdleBps: 0,
    softLockupDays: 60,
    // APY as a RANGE — the annualized monthly distribution band, low/high bps.
    targetApyLowBps: Math.round(d.min * 10_000),
    targetApyHighBps: Math.round(d.max * 10_000),
    spvJurisdiction: "cayman",
    shareClass: "A",
    regExemption: "regD_506c",
    disclaimers: DRAFT_DISCLAIMERS,
    targetMiningBps,
    targetBtcTacticalBps,
    targetUsdcBaseBps,
    targetStableReserveBps,
    signersWhitelist: ["governance-signer-1", "governance-signer-2"],
    requiredSigners: 2,
  };
}

/**
 * Build the BTC Mining Performance Vault draft TEMPLATE from the committed product
 * constant. Pure: reads the constant + guards, invents nothing, persists nothing.
 *
 * The disclaimers + name + description are guarded by the canonical
 * `containsForbidden` matcher at build time — if any forbidden word ever creeps
 * into the wording, this throws rather than returning an unsafe template.
 */
export function buildBtcMiningVaultDraftTemplate(
  product: BtcMiningPerformanceVault = BTC_MINING_PERFORMANCE_VAULT,
): BtcMiningVaultDraftTemplate {
  const sections = buildSections(product);
  const draftInput = buildDraftInput(product);

  // Defense-in-depth: the canonical forbidden-words guard must clear the
  // human-facing strings of the mapped draft. A regression in the wording fails
  // closed here rather than shipping an unsafe template.
  for (const field of [
    draftInput.name,
    draftInput.description ?? "",
    draftInput.disclaimers,
  ]) {
    const hit = containsForbidden(field);
    if (hit) {
      throw new Error(
        `BTC Mining Vault draft template contains a forbidden word: ${hit.found.join(", ")}`,
      );
    }
  }

  return {
    productId: product.id,
    name: product.name,
    sections,
    markdown: sectionsToMarkdown(product.name, sections),
    draftInput,
  };
}
