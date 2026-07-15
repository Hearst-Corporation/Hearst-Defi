/**
 * Tax preview query — server-only.
 *
 * Returns deterministic YTD tax preview data for 1099-INT, 1099-B and CRS.
 * This is PREVIEW ONLY — final tax documents are issued annually.
 *
 * Rules:
 *  - `server-only` import prevents accidental client-bundle inclusion.
 *  - No `Math.random()`, no `Date.now()` — all determinism comes from
 *    explicit inputs (userId, year). Tests can inject a fixed year.
 *  - No `any`, no `as unknown as`.
 */
import "server-only";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 1099-INT: interest income from yield distributions. */
export interface Form1099Int {
  /** Box 1 — Interest income YTD, in USD (formatted to 2dp). */
  interestIncomeUsd: number;
  /** Box 4 — Federal income tax withheld (0 for accredited LPs). */
  federalTaxWithheldUsd: number;
  /** Tax year, e.g. 2026. */
  taxYear: number;
  /** Calendar year to date as of the preview cut date. */
  ytdCutDate: string; // ISO date string, e.g. "2026-05-26"
}

/** 1099-B: proceeds from asset dispositions / redemptions. */
export interface Form1099B {
  /** Box 1d — Proceeds, in USD. */
  proceedsUsd: number;
  /** Box 1e — Cost basis (principal invested), in USD. */
  costBasisUsd: number;
  /** Box 1c — Short-term gains/losses (held ≤ 1 year). */
  shortTermGainLossUsd: number;
  /** Box 1c — Long-term gains/losses (held > 1 year). */
  longTermGainLossUsd: number;
  /** Tax year, e.g. 2026. */
  taxYear: number;
}

/**
 * CRS (Common Reporting Standard) preview for non-US LPs.
 * Applies OECD CRS Annex I section VIII(D) definitions.
 */
export interface CrsPreview {
  /** Total financial account balance at period end, in USD. */
  accountBalanceUsd: number;
  /** Gross interest income credited during the period, in USD. */
  grossInterestUsd: number;
  /** Gross dividends credited during the period, in USD (0 for yield vault). */
  grossDividendsUsd: number;
  /** Other income attributed (mining distribution labelled as 'other'), in USD. */
  otherIncomeUsd: number;
  /**
   * ISO 3166-1 alpha-2 residence country code, or `null` when the investor's
   * residence is not on record. NEVER defaulted to a jurisdiction — a fabricated
   * residence (e.g. an implicit "US") would misstate a CRS reporting obligation.
   * A caller-facing surface must hide the residence attribution when this is null.
   */
  residenceCountry: string | null;
  /** Reporting year. */
  reportingYear: number;
}

export interface TaxPreview {
  form1099Int: Form1099Int;
  form1099B: Form1099B;
  crs: CrsPreview;
  /** userId the preview belongs to. */
  userId: string;
  /** "preview" — final docs are issued annually. */
  docStatus: "preview";
  /**
   * Provenance of the dollar figures above (non-negotiable #2 — every metric
   * carries a badge). "live" when the caller supplied real ledger amounts
   * (`actualInterestIncomeUsd` / `actualPrincipalUsd` / `actualAccruedYieldUsd`
   * overrides); "stub" when one or more of those were omitted and the
   * deterministic userId-seeded placeholder was used instead. A caller-facing
   * surface must never present a "stub" preview as if it were real.
   */
  dataSource: "live" | "stub";
}

// ---------------------------------------------------------------------------
// Computation helpers (exported for unit tests)
// ---------------------------------------------------------------------------

/**
 * Compute 1099-INT fields from raw YTD distribution total.
 *
 * Convention: distributions from the Hearst Yield Vault are classified as
 * interest income (IRC §61) because the underlying instrument is a debt-
 * like mining-backed note. Federal withholding = 0 for accredited investors
 * who provide a completed W-9/W-8BEN.
 */
export function compute1099Int(
  interestIncomeUsd: number,
  taxYear: number,
  ytdCutDate: string,
): Form1099Int {
  return {
    interestIncomeUsd: round2(interestIncomeUsd),
    federalTaxWithheldUsd: 0,
    taxYear,
    ytdCutDate,
  };
}

/**
 * Compute 1099-B fields from principal and accrued data.
 *
 * Capital-gains treatment only applies on redemption. During the soft lock-up
 * period, `proceedsUsd` equals 0 (no disposition) and the cost basis equals
 * the principal. Gains are classified by holding period.
 */
export function compute1099B(
  principalUsd: number,
  accruedYieldUsd: number,
  daysHeld: number,
  taxYear: number,
): Form1099B {
  // No disposition → proceeds = 0, no gain/loss recognised yet.
  const proceedsUsd = 0;
  const costBasisUsd = round2(principalUsd);
  // Unrealised PnL: accrued yield drives the notional gain.
  const totalNotionalGain = round2(accruedYieldUsd);

  const shortTermGainLossUsd =
    daysHeld <= 365 ? totalNotionalGain : 0;
  const longTermGainLossUsd =
    daysHeld > 365 ? totalNotionalGain : 0;

  return {
    proceedsUsd,
    costBasisUsd,
    shortTermGainLossUsd,
    longTermGainLossUsd,
    taxYear,
  };
}

/**
 * Compute CRS preview fields.
 *
 * Vault distributions are reported as "other income" under CRS because they
 * derive from mining cashflow rather than equity dividends or bond coupon.
 */
export function computeCrs(
  accountBalanceUsd: number,
  grossInterestUsd: number,
  residenceCountry: string | null,
  reportingYear: number,
): CrsPreview {
  return {
    accountBalanceUsd: round2(accountBalanceUsd),
    grossInterestUsd: round2(grossInterestUsd),
    grossDividendsUsd: 0,
    otherIncomeUsd: round2(grossInterestUsd * 0.62), // mining component ratio (62%)
    residenceCountry,
    reportingYear,
  };
}

/** Round to 2 decimal places (banker-safe for USD). */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

/**
 * Build a deterministic TaxPreview for a given userId and year.
 *
 * Implementation note: in V1 this returns stub/preview data keyed to the
 * userId hash offset so each user sees stable but distinct numbers. Real
 * tax document generation (Sovos / tax API) is gated on V2 (2027 Q1).
 *
 * No Prisma I/O in this function to keep it testable without a DB fixture.
 * The caller (Server Component or Server Action) is responsible for fetching
 * any real position data and passing it via the `overrides` parameter.
 */
export interface TaxPreviewOverrides {
  /** YTD interest income from actual distribution records, if available. */
  actualInterestIncomeUsd?: number;
  /** Principal invested (cost basis), from position data. */
  actualPrincipalUsd?: number;
  /** Accrued yield balance, from position data. */
  actualAccruedYieldUsd?: number;
  /** Days position has been held (for ST/LT determination). */
  actualDaysHeld?: number;
  /**
   * LP residence country (ISO 3166-1 alpha-2). Omitted → residence unknown
   * (`null` in the output), NEVER defaulted to a jurisdiction.
   */
  residenceCountry?: string;
  /**
   * Real data-currency date for the "as of" caption (ISO `yyyy-mm-dd`). The
   * caller (which knows the wall clock — this module must not) passes the true
   * render date. Omitted → the tax-year reporting-period end, a fixed boundary,
   * never a fabricated snapshot date.
   */
  ytdCutDate?: string;
}

export function getTaxPreview(
  userId: string,
  year: number,
  overrides: TaxPreviewOverrides = {},
): TaxPreview {
  // Deterministic stub keyed on userId length + year — stable across calls,
  // no Math.random() or Date.now(). Used only when the caller has no real
  // ledger figures yet (e.g. local fixtures); `dataSource` below flags it.
  const userSeed = userId.length + (userId.charCodeAt(0) ?? 65);

  const isLive =
    overrides.actualInterestIncomeUsd !== undefined &&
    overrides.actualPrincipalUsd !== undefined &&
    overrides.actualAccruedYieldUsd !== undefined;

  const interestIncomeUsd =
    overrides.actualInterestIncomeUsd ??
    round2(12_000 + userSeed * 100);

  const principalUsd =
    overrides.actualPrincipalUsd ?? 250_000 + userSeed * 1_000;

  const accruedYieldUsd =
    overrides.actualAccruedYieldUsd ??
    round2(interestIncomeUsd * 0.85);

  // Internal calc default only — the ST/LT split is a computed figure, never
  // surfaced as a "held for N days" fact. A caller-facing surface passes the
  // real holding period; when it doesn't, the accrued gain it splits is 0.
  const daysHeld = overrides.actualDaysHeld ?? 180;

  // Residence is null unless the caller actually knows it. No implicit "US".
  const residenceCountry = overrides.residenceCountry ?? null;

  // "As of" date: the caller passes the real render date; the internal fallback
  // is the tax-year reporting-period end (a boundary), not a fabricated day.
  const ytdCutDate = overrides.ytdCutDate ?? `${year}-12-31`;

  const form1099Int = compute1099Int(interestIncomeUsd, year, ytdCutDate);

  const form1099B = compute1099B(
    principalUsd,
    accruedYieldUsd,
    daysHeld,
    year,
  );

  const crs = computeCrs(
    principalUsd + accruedYieldUsd,
    interestIncomeUsd,
    residenceCountry,
    year,
  );

  return {
    form1099Int,
    form1099B,
    crs,
    userId,
    docStatus: "preview",
    dataSource: isLive ? "live" : "stub",
  };
}
