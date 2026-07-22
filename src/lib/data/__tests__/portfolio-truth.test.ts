/**
 * Portfolio aggregates — source-level honesty guards.
 *
 * `loadPortfolio()` is `server-only`, cached, and reaches Prisma plus five
 * other loaders, so these assert the CONTRACT at the source rather than
 * booting the whole loader: same style as `src/lib/__tests__/data-honesty-
 * guards.test.ts`, which the repo already uses for exactly this reason.
 *
 * What must hold, and why it broke before:
 *
 *   • Realized payouts (dollars that left the vault) and accrued yield were
 *     summed into one `totalYieldYtdUsdc`. The accrued leg came from
 *     `Position.accruedYieldUsdc` — a column nothing computes — so a real
 *     figure and an uncomputed one became one number no reader could take
 *     apart. It reached a tax page, an investor PDF, and the LLM chat context.
 *   • The unauthenticated branch returned `nextDistributionAt:
 *     nextEndOfMonth()` — a fabricated date on a product that pays no periodic
 *     cash at all.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildYtdPayoutBreakdown } from "@/lib/portfolio/yield-ytd";

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

/** Strip comments so a doc block mentioning a pattern cannot satisfy a match. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const PORTFOLIO = stripComments(read("src/lib/data/portfolio.ts"));

describe("portfolio root — realized payouts are never merged with accrual", () => {
  it("does not re-export a combined `totalYieldYtdUsdc` aggregate", () => {
    // The merged field is gone; `realizedYtdUsdc` replaces it and means
    // exactly one thing: money actually paid.
    expect(PORTFOLIO).toMatch(/realizedYtdUsdc/);
    expect(PORTFOLIO).not.toMatch(/totalYieldYtdUsdc/);
  });

  it("no longer sums Position.accruedYieldUsdc into an aggregate", () => {
    // The old code did `positions.reduce((sum, p) => sum + p.accruedYieldUsdc, 0)`
    // twice — summing a column of `@default(0)` rows yields a confident 0 for a
    // quantity nothing calculates.
    expect(PORTFOLIO).not.toMatch(/sum\s*\+\s*p\.accruedYieldUsdc/);
  });

  it("builds the YTD breakdown with productAccrues: false (Series 1 pays no yield)", () => {
    expect(PORTFOLIO).toMatch(/buildYtdPayoutBreakdown/);
    expect(PORTFOLIO).toMatch(/productAccrues:\s*false/);
  });

  it("never fabricates a next-distribution date at the portfolio level", () => {
    // `nextEndOfMonth()` survives for the PER-POSITION helper, which only
    // returns a date for an active position carrying a real yield range. What
    // must not come back is the portfolio-wide `nextDistributionAt:
    // nextEndOfMonth()` on a product with no periodic distribution.
    expect(PORTFOLIO).not.toMatch(/nextDistributionAt:\s*nextEndOfMonth\(\)/);
  });
});

describe("portfolio root — absence is null, a measured zero stays zero", () => {
  it("reports accrued as null rather than 0", () => {
    expect(PORTFOLIO).toMatch(/accruedYieldUsdc:\s*number\s*\|\s*null/);
    // The unauthenticated branch must not seed it with a zero either.
    expect(PORTFOLIO).not.toMatch(/accruedYieldUsdc:\s*0\s*,/);
  });

  it("keeps a real 0 for realized payouts when the ledger says nothing was paid", () => {
    // Behavioural, not textual: an empty ledger is a measurement, not an
    // absence, so it must still be 0 — this is the case that must NOT become
    // null in a future over-correction.
    const empty = buildYtdPayoutBreakdown([], null, { productAccrues: false });
    expect(empty.realizedUsdc).toBe(0);
    expect(empty.accruedUsdc).toBeNull();
  });

  it("keeps realized payouts exact and unpolluted by an accrued value", () => {
    const withAccrual = buildYtdPayoutBreakdown(
      [{ amountUsdc: 4_000 }, { amountUsdc: 1_500 }],
      2_000,
      { productAccrues: true },
    );
    expect(withAccrual.realizedUsdc).toBe(5_500);
    expect(withAccrual.accruedUsdc).toBe(2_000);
    // The exact regression: 5_500 + 2_000 must never surface as one figure.
    expect(withAccrual.realizedUsdc).not.toBe(7_500);
  });
});

describe("dead cockpit path stays deleted", () => {
  it("portfolio-cockpit.ts is not reintroduced", () => {
    // It rescaled the whole NAV series by a ratio so its last point matched the
    // header total — a graph where no point was the measured value. It had no
    // importer, so it was removed rather than repaired; this guard stops it
    // coming back through a revert.
    expect(() => read("src/lib/data/portfolio-cockpit.ts")).toThrow();
  });

  it("PILOT_* fixtures are not reintroduced", () => {
    expect(() => read("src/app/(product)/portfolio/_cockpit/pilot-fixtures.ts")).toThrow();
  });
});
