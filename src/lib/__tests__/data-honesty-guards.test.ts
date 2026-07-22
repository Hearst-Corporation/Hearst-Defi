import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  VAULTS,
  VAULT_YIELD,
  VAULT_DEFENSIVE,
  VAULT_BTC_PLUS,
} from "@/lib/engine/vaults";
import { isPlaceholderTxHash } from "@/lib/chain/explorer";
import { validateMinTicket } from "@/lib/positions/subscribe-logic";
import { SHARE_CLASS_A, SHARE_CLASS_B } from "@/lib/engine/share-class";

/**
 * MISSION #042 — Phase 6 — "data honesty" guard tests.
 *
 * These are GUARD tests: they assert that the pre-live data-integrity invariants
 * the product already relies on stay true. They do NOT introduce or change any
 * business logic — every assertion reads the real source / real pure data.
 *
 * Each `describe` maps to one of the five mission points. Where a guard is
 * already covered elsewhere it is noted (and not duplicated); where it is a real
 * gap it is asserted here.
 */

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
const stripComments = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

// ---------------------------------------------------------------------------
// POINT 1 — dev seed data is NEVER treated as live.
// ---------------------------------------------------------------------------
//
// The dev fixture (scripts/seed-dev-position.ts) injects principal 500_000 /
// accrued 9_800 (total 509_800) for dev@hearst.local. Two real guards keep it
// honest:
//   (a) the seed script throws when NODE_ENV === "production" (it can never run
//       against prod), and
//   (b) the NAV prints it writes carry source "dev_seed" — they are never
//       relabelled "live".
// We assert both against the real script source (static read — no DB, no run).
describe("POINT 1 — dev seed is never live data", () => {
  const seed = stripComments(read("scripts/seed-dev-position.ts"));

  it("the seed fixture carries the documented amounts (sanity anchor)", () => {
    expect(seed).toMatch(/PRINCIPAL\s*=\s*500_000/);
    expect(seed).toMatch(/ACCRUED\s*=\s*9_800/);
  });

  it("refuses to run in production (NODE_ENV guard, fail-closed)", () => {
    // The guard must compare NODE_ENV to "production" AND throw — both halves
    // matter. A seed that ran in prod would forge a live $509,800 position.
    expect(seed).toMatch(/NODE_ENV\s*===\s*"production"/);
    expect(seed).toMatch(/throw new Error\(\s*"seed-dev-position is dev-only"/);
  });

  it("labels its NAV prints 'dev_seed', never 'live'", () => {
    // Every InvestorNavSnapshot the seed writes must declare source "dev_seed"
    // so the portfolio loader / provenance layer can tell fixture from truth.
    expect(seed).toMatch(/source:\s*"dev_seed"/);
    expect(seed).not.toMatch(/source:\s*"live"/);
  });

  it("the portfolio loader only ever stamps source:'live' on a real investor", () => {
    // Defence-in-depth: confirm the loader's 'live' label is gated behind a
    // resolved investor (no unconditional 'live' for an anonymous/seed read).
    const loader = stripComments(read("src/lib/data/portfolio.ts"));
    // The unauthenticated branch returns the fallback source...
    expect(loader).toMatch(/source:\s*"fallback"/);
    // ...and "live" is only returned after `getInvestor()` resolves a row.
    expect(loader).toMatch(/const investor = await getInvestor\(\)/);
  });
});

// ---------------------------------------------------------------------------
// POINT 2 — sentinel tx hashes never render as a prod BaseScan/explorer link.
// ---------------------------------------------------------------------------
//
// Helper-level correctness (isPlaceholderTxHash flags 0x5eed…/0xfeed…/0xmock…)
// is ALREADY covered by src/lib/chain/__tests__/client.test.ts — NOT duplicated
// here. What was NOT covered, and is the real pre-live risk, is the WIRING: the
// ledger/distribution surfaces that DO receive seed + demo fixtures must gate
// their explorer link behind the sentinel check, so a fabricated hash never
// becomes a dead/false BaseScan link.
//
// Scope note: event-timeline / rebalancing-events-panel / por-summary /
// contracts-audit-trail / proof-card consume ON-CHAIN event + attestation data
// (real hashes only — no seed/demo fixtures flow there), so they are
// intentionally OUT of this contract. The guard covers exactly the surfaces
// where a sentinel hash can actually reach the renderer.
describe("POINT 2 — sentinel tx hashes are filtered before any explorer link", () => {
  it("the central guard recognises every sentinel prefix (anchor; full matrix in client.test.ts)", () => {
    const sentinels = [
      "0x5eed000000000000000000000000000000000000000000000000000000000001",
      "0xfeed000000000000000000000000000000000000000000000000000000000002",
      "0xmock000000000000000000000000000000000000000000000000000000000003",
    ];
    for (const h of sentinels) {
      expect(isPlaceholderTxHash(h), `${h} must be flagged`).toBe(true);
    }
    // A real-looking hash is NOT flagged (so genuine links still render).
    expect(
      isPlaceholderTxHash(
        "0xabc1230000000000000000000000000000000000000000000000000000000000",
      ),
    ).toBe(false);
  });

  const ledgerSurfaces: Array<{ file: string; gate: RegExp }> = [
    // NOTE: portfolio/distrib-calendar.tsx was retired with the v3.0 mining-note
    // model (no periodic cash distribution) — the surface no longer exists, so
    // it is no longer part of this contract.
    {
      file: "src/components/admin/cockpit/live-ops.tsx",
      gate: /!isPlaceholderTxHash\(/,
    },
    {
      // recent-distributions inlines the 0xmock check (B4 convention) rather
      // than the shared helper — still a real gate, asserted on its own form.
      file: "src/components/proof-center/recent-distributions.tsx",
      gate: /!\w+\.txHash\.toLowerCase\(\)\.startsWith\("0xmock"\)/,
    },
  ];

  for (const { file, gate } of ledgerSurfaces) {
    it(`${file} gates its explorer link behind the sentinel check`, () => {
      const src = stripComments(read(file));
      // It links to an explorer...
      expect(src).toMatch(/explorerTxUrl\(|EXPLORER_TX_BASE/);
      // ...and that link is conditioned on the hash NOT being a sentinel.
      expect(src, `${file} must gate the link`).toMatch(gate);
    });
  }
});

// ---------------------------------------------------------------------------
// POINT 3 — the minimum ticket is ONE number, identical on both sides.
// ---------------------------------------------------------------------------
//
// HISTORY (why this block was inverted): `validateMinTicket` used to take an
// `isDevelopment` flag and gate the env override behind
// `isDevelopment || NODE_ENV !== "production"`, which made the override inert in
// production. This block asserted exactly that. It was a real safety property
// — until it became the bug: the deployed contract's own minDeposit() is 1 USDC
// while the app forced 250k in prod, so the invest CTA could never produce a
// single deposit. The override is now honored in EVERY environment
// (MIN_TICKET_USDC, src/lib/vaults/min-ticket.ts).
//
// The honesty property that replaces it is stronger and money-facing: the floor
// the invest form shows and gates on MUST be the floor `subscribe()` enforces
// after the irreversible on-chain deposit has settled. The end-to-end version of
// that contract (real data layer vs real validator) lives in
// src/lib/vaults/__tests__/min-ticket.test.ts; what is guarded HERE is the
// source-level rule that no caller may re-introduce an environment gate, plus
// the fail-safe direction of a bad value.
describe("POINT 3 — the minimum ticket floor is environment-independent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("with no override configured, the canonical class minimums apply", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MIN_TICKET_USDC", "");
    vi.stubEnv("DEMO_MIN_TICKET_USDC", "");

    expect(validateMinTicket(100, "A").ok).toBe(false);
    expect(validateMinTicket(SHARE_CLASS_A.minTicketUsdc, "A").ok).toBe(true);
    expect(validateMinTicket(SHARE_CLASS_B.minTicketUsdc, "B").ok).toBe(true);
  });

  it("the SAME env yields the SAME floor in development and in production", () => {
    vi.stubEnv("MIN_TICKET_USDC", "1");

    for (const nodeEnv of ["development", "test", "production"]) {
      vi.stubEnv("NODE_ENV", nodeEnv);
      expect(
        validateMinTicket(1, "A").ok,
        `NODE_ENV=${nodeEnv} must not change the floor`,
      ).toBe(true);
    }
  });

  it("a malformed override raises the floor back to the default (fail-safe direction)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MIN_TICKET_USDC", "not-a-number");

    // A typo must never open the floor — it closes it back to the product term.
    expect(validateMinTicket(1, "A").ok).toBe(false);
    expect(validateMinTicket(SHARE_CLASS_A.minTicketUsdc, "A").ok).toBe(true);
  });

  it("a zero override cannot create a 0 USDC floor", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MIN_TICKET_USDC", "0");

    expect(validateMinTicket(0.5, "A").ok).toBe(false);
  });

  it("no caller re-introduces an environment gate around validateMinTicket", () => {
    // subscribe.ts and admin/customers/actions.ts feed validateMinTicket. The
    // retired signature passed `process.env.NODE_ENV === "development"` as a
    // third argument; a floor that depends on NODE_ENV is a floor the invest
    // form cannot predict, and the form's number is the one the investor already
    // paid against. So the call must stay env-free.
    const subscribe = stripComments(read("src/app/actions/subscribe.ts"));
    const customers = stripComments(read("src/app/admin/customers/actions.ts"));
    for (const [name, src] of [
      ["subscribe.ts", subscribe],
      ["customers/actions.ts", customers],
    ] as const) {
      expect(src, `${name} must call validateMinTicket`).toMatch(
        /validateMinTicket\(/,
      );
      expect(
        src,
        `${name} must not gate validateMinTicket on the environment`,
      ).not.toMatch(/validateMinTicket\([^)]*NODE_ENV/);
    }
  });

  it("the applicative floor is resolved OUTSIDE the pure engine (non-negotiable #6)", () => {
    // src/lib/engine/* must stay free of I/O — no process.env, ever. The
    // override therefore lives in the deployment layer, and the engine keeps
    // exposing the product's stated terms untouched.
    const shareClass = stripComments(read("src/lib/engine/share-class.ts"));
    expect(shareClass).not.toMatch(/process\.env/);
    expect(shareClass).toMatch(/minTicketUsdc:\s*250_000/);
  });
});

// ---------------------------------------------------------------------------
// POINT 4 — multi-vault definitions never reuse the Yield vault's numbers.
// ---------------------------------------------------------------------------
//
// ADR-006 / non-negotiable #9: each vault carries its OWN assumptions, APY
// band, and allocation mix. Defensive and BTC Plus must not silently inherit
// the Yield vault's figures.
describe("POINT 4 — Defensive / BTC Plus never copy the Yield vault's numbers", () => {
  it("registry exposes three distinct vault ids", () => {
    expect(Object.keys(VAULTS).sort()).toEqual(
      ["btc-plus", "defensive", "yield"].sort(),
    );
    expect(VAULT_YIELD.id).toBe("yield");
    expect(VAULT_DEFENSIVE.id).toBe("defensive");
    expect(VAULT_BTC_PLUS.id).toBe("btc-plus");
  });

  it("each vault has a DISTINCT APY target band (no shared headline)", () => {
    const bands = [VAULT_YIELD, VAULT_DEFENSIVE, VAULT_BTC_PLUS].map(
      (v) => `${v.apyTarget.low}-${v.apyTarget.high}`,
    );
    expect(new Set(bands).size).toBe(3);

    // And no non-yield vault echoes the Yield band verbatim.
    const yieldBand = `${VAULT_YIELD.apyTarget.low}-${VAULT_YIELD.apyTarget.high}`;
    for (const v of [VAULT_DEFENSIVE, VAULT_BTC_PLUS]) {
      expect(
        `${v.apyTarget.low}-${v.apyTarget.high}`,
        `${v.id} must not reuse the Yield APY band`,
      ).not.toBe(yieldBand);
    }
  });

  it("each vault has a DISTINCT allocation mix", () => {
    const mixOf = (v: typeof VAULT_YIELD) =>
      JSON.stringify(v.allocationTargets);
    const mixes = [VAULT_YIELD, VAULT_DEFENSIVE, VAULT_BTC_PLUS].map(mixOf);
    expect(new Set(mixes).size).toBe(3);

    const yieldMix = mixOf(VAULT_YIELD);
    for (const v of [VAULT_DEFENSIVE, VAULT_BTC_PLUS]) {
      expect(mixOf(v), `${v.id} must not reuse the Yield allocation`).not.toBe(
        yieldMix,
      );
    }
  });

  it("each vault has its OWN assumptions text (no copy of the Yield assumptions)", () => {
    const yieldAssumptions = JSON.stringify(VAULT_YIELD.assumptions);
    for (const v of [VAULT_DEFENSIVE, VAULT_BTC_PLUS]) {
      expect(
        JSON.stringify(v.assumptions),
        `${v.id} must carry its own assumptions`,
      ).not.toBe(yieldAssumptions);
      // Sanity: each still carries the mandatory "not guaranteed" line (#10).
      expect(v.assumptions.join(" ")).toMatch(/not guaranteed/i);
    }
  });

  it("each vault still offers BOTH share classes (isolation ≠ dropping a class)", () => {
    for (const v of [VAULT_YIELD, VAULT_DEFENSIVE, VAULT_BTC_PLUS]) {
      const classes = v.shareClasses.map((c) => c.minTicketUsdc);
      expect(classes).toContain(SHARE_CLASS_A.minTicketUsdc);
      expect(classes).toContain(SHARE_CLASS_B.minTicketUsdc);
    }
  });
});

// ---------------------------------------------------------------------------
// POINT 5 — portfolio async real-data contract.
// ---------------------------------------------------------------------------
//
// Already fully covered by:
//   src/app/(product)/portfolio/__tests__/portfolio-real-data-contract.test.ts
// (asserts the page is `async`, binds loadPortfolio()/loadAllocationDonutProps(),
//  and ships NONE of the 509,800 / 500,000 / "Demo data" literals).
//
// NOT duplicated here. We add only a tiny non-overlapping anchor: the page
// source still contains none of the headline mock literals — kept as a cheap
// canary distinct from the existing contract's broader assertions.
describe("POINT 5 — portfolio real-data (canary; full contract elsewhere)", () => {
  it("portfolio page ships none of the headline mock literals", () => {
    const page = stripComments(
      read("src/app/(product)/portfolio/page.tsx"),
    );
    for (const lit of ["509,800", "509800", '"Demo data"', "Demo data"]) {
      expect(page, `mock literal ${lit} must be absent`).not.toContain(lit);
    }
  });
});

// ---------------------------------------------------------------------------
// POINT 6 — tax preview never renders the userId-seeded stub as if it were live.
// ---------------------------------------------------------------------------
//
// `getTaxPreview` (src/lib/portfolio/tax.ts) falls back to a deterministic
// userId-seeded placeholder ($12,000 + seed*100 etc.) whenever a real ledger
// override is missing, and flags that in the `dataSource` field ("live" vs
// "stub"). The LP-facing tax page must always supply all three real-ledger
// overrides so it can never surface the placeholder — this is a static-source
// regression guard, not a runtime check, matching the rest of this file.
describe("POINT 6 — tax preview page always sources real ledger overrides", () => {
  it("the tax page passes actualInterestIncomeUsd/actualPrincipalUsd/actualAccruedYieldUsd from loadPortfolio()", () => {
    const page = stripComments(
      read("src/app/(product)/portfolio/tax/page.tsx"),
    );
    expect(page).toMatch(/loadPortfolio\(\)/);
    expect(page).toMatch(/actualInterestIncomeUsd:\s*totalYieldYtdUsdc/);
    expect(page).toMatch(/actualPrincipalUsd:\s*deployedUsdc/);
    expect(page).toMatch(/actualAccruedYieldUsd:\s*accruedYieldUsdc/);
  });

  it("loadTaxPreview() (the Prisma-backed loader) also sources all three from real queries", () => {
    const loader = stripComments(
      read("src/lib/portfolio/tax-preview-loader.ts"),
    );
    expect(loader).toMatch(/actualInterestIncomeUsd/);
    expect(loader).toMatch(/actualPrincipalUsd/);
    expect(loader).toMatch(/actualAccruedYieldUsd/);
    expect(loader).toMatch(/prisma\.position\.findMany/);
    expect(loader).toMatch(/prisma\.investorTransaction\.findMany/);
  });
});

// ---------------------------------------------------------------------------
// POINT 7 — mining fleet uptime is never badged "attested".
// ---------------------------------------------------------------------------
//
// `market-data-hourly.ts` writes `uptimePct: 98.5` (a hardcoded placeholder,
// pending a real fleet uptime feed) into `MiningMetric` on every hourly run —
// see the comment at that call site. `loadLatestMiningMetrics()` (the Mining
// Health Agent's data loader) must never let a fabricated constant inherit
// the row's freshness-derived `attested`/`stale` tag: that would present a
// placeholder as attested fact, violating CLAUDE.md non-negotiable #2. The
// other three metrics on the same row (hashprice/difficulty/margin) ARE
// measured/derived from live feeds, so they keep the freshness-derived tag.
describe("POINT 7 — mining uptime provenance is never fabricated as attested", () => {
  it("market-data-hourly.ts still writes the documented placeholder (sanity anchor)", () => {
    const cron = stripComments(
      read("src/lib/inngest/functions/market-data-hourly.ts"),
    );
    expect(cron).toMatch(/uptimePct:\s*98\.5/);
  });

  it("loadLatestMiningMetrics() hardcodes uptime_pct provenance to 'estimated', not the row's freshness tag", () => {
    const loader = stripComments(read("src/lib/agents/loaders/mining.ts"));
    expect(loader).toMatch(/uptime_pct:\s*"estimated"/);
    // The other three metrics still ride the freshness-derived `rowTag`.
    expect(loader).toMatch(/hashprice_usd_per_th:\s*rowTag/);
    expect(loader).toMatch(/difficulty_change_pct:\s*rowTag/);
    expect(loader).toMatch(/margin_pct:\s*rowTag/);
  });
});

// ---------------------------------------------------------------------------
// POINT 8 — Investor Memo PDF never badges mining hashrate/uptime "attested".
// ---------------------------------------------------------------------------
//
// `loadMiningOpsSnapshot()` (src/lib/agents/loaders/mining.ts) feeds the
// Investor Memo PDF's Mining Health page (`memo-pages/mining-health.tsx`) via
// `MemoPdfData.miningOps`. `hashrate_ph_s` and `uptime_pct` on that snapshot
// are averages of `MiningMetric.deployedHashrate`/`uptimePct` — both columns
// are still written as hardcoded placeholders (`182_000` / `98.5`) by the
// hourly cron regardless of freshness (RP-10, same root cause as T-13/POINT 7,
// different consumer). The page used to badge them "attested" whenever
// `is_fallback` was false, i.e. whenever the DB had ANY row — which is true
// almost always since the cron runs hourly. This is a CRITICAL, LP-visible
// provenance-badge violation (CLAUDE.md non-negotiable #2): the Investor Memo
// PDF is sent to LPs. Fixed (T-14) to always badge "estimated" for these two
// metrics, independent of `is_fallback`.
describe("POINT 8 — Investor Memo PDF never badges placeholder mining ops as attested", () => {
  it("MiningHealthPage hardcodes hashrate/uptime provenance to 'estimated', never derives it from is_fallback", () => {
    const page = stripComments(
      read("src/lib/pdf/memo-pages/mining-health.tsx"),
    );
    expect(page).toMatch(/opsProvenance\s*=\s*"estimated"/);
    // Regression: must not resurrect the `is_fallback ? "estimated" : "attested"` ternary.
    expect(page).not.toMatch(/is_fallback\s*\?\s*"estimated"\s*:\s*"attested"/);
  });
});

// ---------------------------------------------------------------------------
// POINT 9 — Investor Memo PDF never badges a seed/preset VaultSnapshot as attested.
// ---------------------------------------------------------------------------
//
// `loadMemoInput()` (src/lib/agents/loaders/vault.ts) reads the single most
// recent `VaultSnapshot` with NO `where` filter on `source` — it can pick up a
// "daily-seed" row (prisma/seed.ts's synthetic sinusoidal timeline, dated up to
// "today") or a "computed" preset row (engine dry-run, never a real
// measurement), not only a genuine "live"/"oracle" custody snapshot. Before
// this fix, the loader tagged `vault`/`mining` provenance purely from
// `takenAt` freshness, so a freshly-seeded synthetic row was badged
// "attested" — the exact same class of bug as T-13/T-14 (freshness ≠
// authenticity), on the SAME LP-visible Investor Memo PDF document. The admin
// dashboard already encodes the correct rule via `isLiveTimelineSource()`
// (`src/lib/data/timeline-snapshot.ts`) — the memo loader must honour it too.
describe("POINT 9 — Investor Memo vault/mining provenance respects VaultSnapshot.source", () => {
  it("loadMemoInput downgrades non-live snapshot sources to 'estimated' before applying freshness", () => {
    const loader = stripComments(read("src/lib/agents/loaders/vault.ts"));
    expect(loader).toMatch(/import\s*\{\s*isLiveTimelineSource\s*\}\s*from\s*"@\/lib\/data\/timeline-snapshot"/);
    expect(loader).toMatch(/!isLiveTimelineSource\(snapshot\.source\)\s*\?\s*"estimated"/);
  });

  it("seed.ts still writes a non-live 'daily-seed' source (sanity anchor)", () => {
    // The preset-snapshot seeder (which wrote a "computed" source) was retired;
    // the only synthetic source the seed writes now is "daily-seed". The intent of
    // this anchor is unchanged: the seed never writes a live/oracle/attested
    // source that would be mistaken for a real measurement.
    const seed = stripComments(read("prisma/seed.ts"));
    expect(seed).toMatch(/source:\s*"daily-seed"/);
    expect(seed).not.toMatch(/source:\s*"(?:live|oracle|attested)"/);
  });

  it("isLiveTimelineSource excludes 'computed'/'daily-seed' from the live set (sanity anchor)", () => {
    const tl = stripComments(read("src/lib/data/timeline-snapshot.ts"));
    expect(tl).toMatch(/new Set\(\[\s*"live",\s*"oracle",\s*"attested",?\s*\]\)/);
  });
});
