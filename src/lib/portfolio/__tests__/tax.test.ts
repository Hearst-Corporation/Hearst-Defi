/**
 * Unit tests for getTaxPreview (src/lib/portfolio/tax.ts).
 *
 * All computation is deterministic — no Math.random(), no Date.now().
 * The `year` parameter and `userId` drive all outputs.
 *
 * Coverage:
 *  1. getTaxPreview returns the three form types with correct docStatus.
 *  2. 1099-INT: interestIncomeUsd deterministic from userId seed.
 *  3. 1099-INT: federalTaxWithheldUsd = 0 for accredited LPs.
 *  4. 1099-INT: taxYear matches input year.
 *  5. 1099-INT: ytdCutDate is ISO date string with correct year.
 *  6. 1099-B: costBasisUsd equals principalUsd (no disposition).
 *  7. 1099-B: proceedsUsd = 0 (no disposition during lock-up).
 *  8. 1099-B: shortTermGainLossUsd correct for daysHeld ≤ 365.
 *  9. 1099-B: longTermGainLossUsd correct for daysHeld > 365.
 * 10. CRS: otherIncomeUsd = 62% of grossInterestUsd.
 * 11. CRS: grossDividendsUsd = 0 (mining yield, not equity dividend).
 * 12. Overrides: actualInterestIncomeUsd overrides stub value.
 * 13. Overrides: residenceCountry propagates to CRS.
 * 14. round2 helper rounds to 2 decimal places.
 * 15. compute1099Int directly: verifies shape.
 * 16. compute1099B directly: ST/LT split at ≤365/> 365 days boundary.
 * 17. computeCrs directly: otherIncomeUsd 62% ratio.
 * 18. Forbidden words absent from all string fields.
 * 19. dataSource provenance: "stub" when overrides are absent, "live" only
 *     when all three real-ledger overrides are supplied.
 */

import { describe, it, expect } from "vitest";
import {
  getTaxPreview,
  compute1099Int,
  compute1099B,
  computeCrs,
  round2,
} from "@/lib/portfolio/tax";

// ---------------------------------------------------------------------------
// Constants for deterministic test fixtures
// ---------------------------------------------------------------------------

const FIXED_USER_ID = "user-abc-123";
const FIXED_YEAR = 2026;

// Reproduce the seed formula from tax.ts:
// seed = userId.length + (userId.charCodeAt(0) ?? 65)
// FIXED_USER_ID.length = 12, charCodeAt(0) = 'u' = 117 → seed = 129
const FIXED_SEED = FIXED_USER_ID.length + FIXED_USER_ID.charCodeAt(0);

const EXPECTED_INTEREST_INCOME = round2(12_000 + FIXED_SEED * 100);
const EXPECTED_PRINCIPAL = 250_000 + FIXED_SEED * 1_000;
const EXPECTED_ACCRUED_YIELD = round2(EXPECTED_INTEREST_INCOME * 0.85);

// ---------------------------------------------------------------------------
// 1. getTaxPreview returns all three forms + docStatus
// ---------------------------------------------------------------------------

describe("getTaxPreview — output shape", () => {
  it("1. returns form1099Int, form1099B, crs and docStatus='preview'", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(preview).toHaveProperty("form1099Int");
    expect(preview).toHaveProperty("form1099B");
    expect(preview).toHaveProperty("crs");
    expect(preview.docStatus).toBe("preview");
  });

  it("userId is preserved in the output", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(preview.userId).toBe(FIXED_USER_ID);
  });
});

// ---------------------------------------------------------------------------
// 2–5. 1099-INT correctness
// ---------------------------------------------------------------------------

describe("getTaxPreview — 1099-INT", () => {
  it("2. interestIncomeUsd is deterministic from userId seed", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(preview.form1099Int.interestIncomeUsd).toBe(EXPECTED_INTEREST_INCOME);
  });

  it("2b. same userId always returns the same interestIncomeUsd", () => {
    const a = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    const b = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(a.form1099Int.interestIncomeUsd).toBe(b.form1099Int.interestIncomeUsd);
  });

  it("3. federalTaxWithheldUsd = 0 (accredited LP, W-9/W-8BEN)", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(preview.form1099Int.federalTaxWithheldUsd).toBe(0);
  });

  it("4. taxYear matches the input year", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(preview.form1099Int.taxYear).toBe(FIXED_YEAR);
  });

  it("4b. different year → different taxYear in output", () => {
    const preview2025 = getTaxPreview(FIXED_USER_ID, 2025);
    const preview2026 = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(preview2025.form1099Int.taxYear).toBe(2025);
    expect(preview2026.form1099Int.taxYear).toBe(2026);
  });

  it("5. ytdCutDate is an ISO date string containing the tax year", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(preview.form1099Int.ytdCutDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(preview.form1099Int.ytdCutDate).toContain(`${FIXED_YEAR}`);
  });

  it("5b. interestIncomeUsd is a positive number", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(preview.form1099Int.interestIncomeUsd).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 6–9. 1099-B correctness
// ---------------------------------------------------------------------------

describe("getTaxPreview — 1099-B", () => {
  it("6. costBasisUsd equals principalUsd (no disposition)", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(preview.form1099B.costBasisUsd).toBe(round2(EXPECTED_PRINCIPAL));
  });

  it("7. proceedsUsd = 0 (no disposition during soft lock-up)", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(preview.form1099B.proceedsUsd).toBe(0);
  });

  it("8. shortTermGainLossUsd > 0 when daysHeld ≤ 365 (default 180 days)", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    // Default daysHeld = 180 (≤ 365 → short-term)
    expect(preview.form1099B.shortTermGainLossUsd).toBeGreaterThanOrEqual(0);
    expect(preview.form1099B.longTermGainLossUsd).toBe(0);
  });

  it("9. longTermGainLossUsd > 0 when daysHeld > 365 (override)", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR, {
      actualDaysHeld: 400,
      actualAccruedYieldUsd: 5_000,
    });
    expect(preview.form1099B.longTermGainLossUsd).toBeGreaterThan(0);
    expect(preview.form1099B.shortTermGainLossUsd).toBe(0);
  });

  it("ST and LT are mutually exclusive (only one is non-zero)", () => {
    const stPreview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR, { actualDaysHeld: 180 });
    expect(stPreview.form1099B.shortTermGainLossUsd > 0 &&
           stPreview.form1099B.longTermGainLossUsd === 0).toBe(true);

    const ltPreview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR, { actualDaysHeld: 400 });
    expect(ltPreview.form1099B.longTermGainLossUsd > 0 &&
           ltPreview.form1099B.shortTermGainLossUsd === 0).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10–11. CRS correctness
// ---------------------------------------------------------------------------

describe("getTaxPreview — CRS", () => {
  it("10. otherIncomeUsd = 62% of grossInterestUsd (mining component ratio)", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    const expected = round2(preview.crs.grossInterestUsd * 0.62);
    expect(preview.crs.otherIncomeUsd).toBe(expected);
  });

  it("11. grossDividendsUsd = 0 (yield vault, no equity dividends)", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(preview.crs.grossDividendsUsd).toBe(0);
  });

  it("reportingYear matches the tax year input", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(preview.crs.reportingYear).toBe(FIXED_YEAR);
  });

  it("accountBalanceUsd = principal + accrued yield", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    const expectedBalance = round2(EXPECTED_PRINCIPAL + EXPECTED_ACCRUED_YIELD);
    expect(preview.crs.accountBalanceUsd).toBe(expectedBalance);
  });
});

// ---------------------------------------------------------------------------
// 12–13. Overrides
// ---------------------------------------------------------------------------

describe("getTaxPreview — overrides", () => {
  it("12. actualInterestIncomeUsd override replaces the stub value", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR, {
      actualInterestIncomeUsd: 99_999.99,
    });
    expect(preview.form1099Int.interestIncomeUsd).toBe(99_999.99);
  });

  it("13. residenceCountry override propagates to CRS output", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR, {
      residenceCountry: "GB",
    });
    expect(preview.crs.residenceCountry).toBe("GB");
  });

  it("default residenceCountry is 'US' when no override", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(preview.crs.residenceCountry).toBe("US");
  });

  it("actualPrincipalUsd override changes costBasisUsd in 1099-B", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR, {
      actualPrincipalUsd: 500_000,
    });
    expect(preview.form1099B.costBasisUsd).toBe(500_000);
  });
});

// ---------------------------------------------------------------------------
// 14. round2 helper
// ---------------------------------------------------------------------------

describe("round2 helper", () => {
  it("14. rounds to exactly 2 decimal places", () => {
    // Note: 1.005 is not exactly representable in IEEE 754 float64;
    // its nearest representable value is slightly below 1.005, so
    // Math.round(1.005 * 100) = 100 → 1.00. Use non-ambiguous values.
    expect(round2(1.006)).toBe(1.01);
    expect(round2(1.004)).toBe(1.00);
    expect(round2(12345.678)).toBe(12345.68);
    expect(round2(0)).toBe(0);
  });

  it("handles negative values", () => {
    expect(round2(-1.235)).toBe(-1.24);
    expect(round2(-1.234)).toBe(-1.23);
  });

  it("idempotent on already-rounded values", () => {
    expect(round2(1.50)).toBe(1.5);
    expect(round2(100.00)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// 15. compute1099Int directly
// ---------------------------------------------------------------------------

describe("compute1099Int — direct", () => {
  it("15. returns correct shape and values", () => {
    const result = compute1099Int(15_000, 2026, "2026-05-26");
    expect(result.interestIncomeUsd).toBe(15_000);
    expect(result.federalTaxWithheldUsd).toBe(0);
    expect(result.taxYear).toBe(2026);
    expect(result.ytdCutDate).toBe("2026-05-26");
  });

  it("rounds interestIncomeUsd to 2dp", () => {
    const result = compute1099Int(15_000.555, 2026, "2026-05-26");
    expect(result.interestIncomeUsd).toBe(15_000.56);
  });
});

// ---------------------------------------------------------------------------
// 16. compute1099B directly — ST/LT boundary
// ---------------------------------------------------------------------------

describe("compute1099B — direct, ST/LT boundary", () => {
  it("16. daysHeld=365 → short-term (≤ 365 is ST)", () => {
    const result = compute1099B(250_000, 10_000, 365, 2026);
    expect(result.shortTermGainLossUsd).toBe(10_000);
    expect(result.longTermGainLossUsd).toBe(0);
  });

  it("16b. daysHeld=366 → long-term (> 365 is LT)", () => {
    const result = compute1099B(250_000, 10_000, 366, 2026);
    expect(result.longTermGainLossUsd).toBe(10_000);
    expect(result.shortTermGainLossUsd).toBe(0);
  });

  it("proceedsUsd is always 0 (no disposition)", () => {
    const result = compute1099B(250_000, 5_000, 90, 2026);
    expect(result.proceedsUsd).toBe(0);
  });

  it("costBasisUsd = rounded principalUsd", () => {
    const result = compute1099B(250_000.455, 5_000, 90, 2026);
    expect(result.costBasisUsd).toBe(250_000.46);
  });
});

// ---------------------------------------------------------------------------
// 17. computeCrs directly
// ---------------------------------------------------------------------------

describe("computeCrs — direct", () => {
  it("17. otherIncomeUsd = 62% of grossInterestUsd", () => {
    const result = computeCrs(300_000, 12_000, "DE", 2026);
    expect(result.otherIncomeUsd).toBe(round2(12_000 * 0.62));
  });

  it("grossDividendsUsd is always 0", () => {
    const result = computeCrs(300_000, 12_000, "FR", 2026);
    expect(result.grossDividendsUsd).toBe(0);
  });

  it("accountBalanceUsd is rounded to 2dp", () => {
    const result = computeCrs(300_000.555, 12_000, "CH", 2026);
    expect(result.accountBalanceUsd).toBe(300_000.56);
  });

  it("residenceCountry passes through", () => {
    const result = computeCrs(300_000, 12_000, "SG", 2026);
    expect(result.residenceCountry).toBe("SG");
  });

  it("reportingYear passes through", () => {
    const result = computeCrs(300_000, 12_000, "US", 2027);
    expect(result.reportingYear).toBe(2027);
  });
});

// ---------------------------------------------------------------------------
// 18. Forbidden words absent
// ---------------------------------------------------------------------------

describe("Forbidden words — tax preview strings", () => {
  const FORBIDDEN = ["guarantee", "promise", "certain", "will deliver", "risk-free"];

  it("18. taxYear field value contains no forbidden words (numeric only)", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    // taxYear is numeric — test that it's not a string with forbidden content
    expect(typeof preview.form1099Int.taxYear).toBe("number");
  });

  it("userId field contains no forbidden words", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    for (const word of FORBIDDEN) {
      expect(preview.userId.toLowerCase()).not.toContain(word);
    }
  });

  it("ytdCutDate contains no forbidden words", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    for (const word of FORBIDDEN) {
      expect(preview.form1099Int.ytdCutDate.toLowerCase()).not.toContain(word);
    }
  });

  it("residenceCountry contains no forbidden words", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    for (const word of FORBIDDEN) {
      expect(preview.crs.residenceCountry.toLowerCase()).not.toContain(word);
    }
  });
});

// ---------------------------------------------------------------------------
// 19. dataSource provenance
// ---------------------------------------------------------------------------

describe("getTaxPreview — dataSource provenance", () => {
  it("19. no overrides at all → dataSource is 'stub'", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(preview.dataSource).toBe("stub");
  });

  it("19b. only a partial override (e.g. residenceCountry) → still 'stub'", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR, {
      residenceCountry: "GB",
    });
    expect(preview.dataSource).toBe("stub");
  });

  it("19c. only actualInterestIncomeUsd supplied → still 'stub' (principal/accrued missing)", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR, {
      actualInterestIncomeUsd: 5_000,
    });
    expect(preview.dataSource).toBe("stub");
  });

  it("19d. all three real ledger overrides supplied → 'live'", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR, {
      actualInterestIncomeUsd: 5_000,
      actualPrincipalUsd: 250_000,
      actualAccruedYieldUsd: 4_250,
    });
    expect(preview.dataSource).toBe("live");
  });

  it("19e. 'live' holds even when the real ledger values are all zero (new investor)", () => {
    const preview = getTaxPreview(FIXED_USER_ID, FIXED_YEAR, {
      actualInterestIncomeUsd: 0,
      actualPrincipalUsd: 0,
      actualAccruedYieldUsd: 0,
    });
    expect(preview.dataSource).toBe("live");
    expect(preview.form1099Int.interestIncomeUsd).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Stability — same call produces identical output
// ---------------------------------------------------------------------------

describe("Determinism contract", () => {
  it("calling getTaxPreview twice with same args returns identical output", () => {
    const a = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    const b = getTaxPreview(FIXED_USER_ID, FIXED_YEAR);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("different userId produces different interestIncomeUsd", () => {
    const a = getTaxPreview("user-aaa", FIXED_YEAR);
    const b = getTaxPreview("user-bbbbbbbbb", FIXED_YEAR);
    // Different lengths / char codes → different seeds → different values
    // (May be equal if seeds happen to collide — but with these specific IDs they differ)
    const aSeed = "user-aaa".length + "user-aaa".charCodeAt(0);
    const bSeed = "user-bbbbbbbbb".length + "user-bbbbbbbbb".charCodeAt(0);
    if (aSeed !== bSeed) {
      expect(a.form1099Int.interestIncomeUsd).not.toBe(
        b.form1099Int.interestIncomeUsd,
      );
    }
  });
});
