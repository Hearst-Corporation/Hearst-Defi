// /btc institutional ledger (PROMPT 236) — render + structure tests.
// Pattern: renderToStaticMarkup (vitest env = node, no RTL/jsdom — cf.
// shared-panels.render.test.tsx / dashboard-page.render.test.tsx).
//
// Locks:
//  - Zone 1: hero dominant = "Your attributed BTC" (the investor's own share),
//    with Vault BTC reserve / Mining-produced BTC / Current value / Last
//    verified as distinct, separately-labelled metrics;
//  - Zone 2: chart action -> /proof-center, NO self-link, no "View Bitcoin",
//    NO planned/reference projection line (showReference={false});
//  - Zone 3: sources explicitly named (Mining credits / Reserve acquisitions),
//    never the vague "Strategic BTC";
//  - Zone 4: a real Bitcoin ledger with per-row evidence (no separate proof card);
//  - Zone 5: BTC-only maturity delivery + custody;
//  - retired from this surface: Accumulation Trajectory, p5/p50/p95, take-profit
//    mechanics, any return %/yield/APY.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { getBtcPageData } from "../_data/get-btc-page-data";
import { getFixtureInvestorUiDataSource } from "@/features/investor-ui/data-source";
import { buildAccumulationSeries } from "@/features/investor-ui/charts/accumulation-series";
import {
  formatBtcAmount,
  satsToBtcString,
  formatUsdCompactAmount,
  formatIsoDate,
  toProvenance,
} from "@/features/investor-ui/format-btc";

import { HeroPanel } from "@/features/investor-ui/components/widgets/hero-panel";
import { AccumulationChartPanel } from "@/features/investor-ui/components/accumulation-chart-panel";
import { SourcesAccumulationPanel } from "@/features/investor-ui/components/sources-accumulation-panel";
import { BtcStrategyStrip } from "../_components/btc-strategy-strip";
import { BtcLedgerTable } from "../_components/btc-ledger-table";
import { BtcMaturityPanel } from "../_components/btc-maturity-panel";

const FORBIDDEN_COPY = /\bapy\b|\byield\b|\bguarantee\b|\bpromise\b|\brisk-free\b|\bwill deliver\b|Just now/i;

const BANNED_SOURCE_COPY = [
  /\bestimated return\b/i,
  /\breturn range\b/i,
  /\breturn band\b/i,
  /\btarget apy\b/i,
  /\bprojected yield\b/i,
  /\bexpected return\b/i,
  /\bmonthly distribution\b/i,
  /\bcash distribution\b/i,
  /\bperformance variation\b/i,
  /\bApyRange\b/,
  /\bp5\b/,
  /\bp50\b/,
  /\bp95\b/,
  /Accumulation Trajectory/i,
  /Strategic BTC/i,
  /Just now/,
];

const BTC_ROOT = join(process.cwd(), "src/app/(product)/btc");

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__") continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.(tsx|ts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Mirrors the page's composition + derivations (same props as page.tsx). */
async function renderBtcWidgets(state?: string) {
  const data = await getBtcPageData(state);
  const mining = await getFixtureInvestorUiDataSource().getMining();
  const dashboard = await getFixtureInvestorUiDataSource().getDashboard();

  const reserve = data.reserve;
  const attribution = data.extra.attribution;
  const production = data.extra.production;
  const events = data.extra.events.value ?? [];
  const custody = data.extra.custody.value;

  const points = buildAccumulationSeries(production.value?.monthly);

  const attributedBtc =
    attribution.value?.attributedBtcSats != null
      ? formatBtcAmount(satsToBtcString(attribution.value.attributedBtcSats, 8), 6)
      : null;
  const vaultReserveBtc =
    reserve.value?.reserveBtcSats != null
      ? formatBtcAmount(satsToBtcString(reserve.value.reserveBtcSats, 8), 2)
      : null;
  const miningProducedBtc =
    production.value?.cumulativeBtcEarned != null
      ? formatBtcAmount(production.value.cumulativeBtcEarned, 2)
      : null;
  const currentValueUsd = formatUsdCompactAmount(attribution.value?.attributedBtcUsd);
  const lastVerified =
    attribution.value?.lastVerifiedAt != null ? formatIsoDate(attribution.value.lastVerifiedAt) : null;

  const monthsElapsed = mining.mining.value?.currentMonth ?? null;
  const monthsTotal = mining.mining.value?.productDurationMonths ?? 24;

  const provenance = toProvenance(production.status);
  const ownershipUnavailable = attribution.value === null && reserve.value === null;

  return renderToStaticMarkup(
    <>
      {ownershipUnavailable ? null : (
        <>
          <HeroPanel
            title="Your attributed BTC"
            mainValue={attributedBtc ?? "—"}
            provenance={toProvenance(attribution.status)}
            asset="btc"
            metrics={[
              { label: "Vault BTC reserve", value: vaultReserveBtc ?? "—", accent: "btc" },
              { label: "Mining-produced BTC", value: miningProducedBtc ?? "—", accent: "mining" },
              { label: "Current value", value: currentValueUsd ?? "—" },
              { label: "Last verified", value: lastVerified ?? "—" },
            ]}
            progress={
              monthsElapsed != null
                ? { current: monthsElapsed, total: monthsTotal, label: "Product term progress" }
                : undefined
            }
          />
          <BtcStrategyStrip
            pockets={dashboard.allocation.value?.pockets ?? null}
            provenance={toProvenance(dashboard.allocation.status)}
          />
        </>
      )}
      <AccumulationChartPanel
        points={points}
        currentMonth={monthsElapsed}
        totalMonths={monthsTotal}
        provenance={provenance}
        tone="btc"
        showReference={false}
        action={{ label: "View proofs →", href: "/proof-center" }}
      />
      <SourcesAccumulationPanel
        monthlyProduction={points.map((p) => ({
          period: p.period,
          mining: p.miningBtc,
          strategic: Math.max(0, p.cumulativeBtc - p.miningBtc),
        }))}
        provenance={provenance}
        title="Sources of Bitcoin"
        caption="Monthly BTC by origin"
        action={{ label: "View mining contribution →", href: "/mining" }}
      />
      <BtcLedgerTable events={events} provenance={toProvenance(data.extra.events.status)} />
      <BtcMaturityPanel
        monthsElapsed={monthsElapsed}
        monthsTotal={monthsTotal}
        custody={custody}
        reserve={reserve.value}
        provenance={toProvenance(data.extra.custody.status)}
      />
    </>,
  );
}

describe("Bitcoin page — institutional ledger (PROMPT 236)", () => {
  it("renders the complete composition without banned copy", async () => {
    const html = await renderBtcWidgets("complete");
    expect(html).toContain("Your attributed BTC");
    expect(html).toContain("Sources of Bitcoin");
    expect(html).toContain("Bitcoin ledger");
    expect(html).toContain("BTC maturity delivery");
    // Retired vocabulary is gone from the surface.
    expect(html).not.toMatch(FORBIDDEN_COPY);
    expect(html).not.toContain("p5");
    expect(html).not.toContain("Accumulation trajectory");
    expect(html).not.toContain("Strategic BTC");
  });

  it("hero separates attributed / vault reserve / mining-produced BTC", async () => {
    const html = await renderBtcWidgets("complete");
    expect(html).toContain("Your attributed BTC");
    expect(html).toContain("0.184205 BTC"); // investor's attributed share
    expect(html).toContain("Vault BTC reserve");
    expect(html).toContain("6.12 BTC"); // vault reserve, distinct label
    expect(html).toContain("Mining-produced BTC");
    expect(html).toContain("2.80 BTC"); // program mining, distinct label
    expect(html).toContain("Current value");
    expect(html).toContain("$18,421");
    expect(html).toContain("Last verified");
  });

  it("compact 40/27/33 strip is present (donut demoted)", async () => {
    const html = await renderBtcWidgets("complete");
    // Real pocket labels from the allocation view model (B1/B2/B3).
    expect(html).toContain("Mining Power");
    expect(html).toContain("BTC Pouch");
    expect(html).toContain("Reserve");
    expect(html).toContain("40%");
    expect(html).toContain("27%");
    expect(html).toContain("33%");
  });

  it("chart links to proofs — no self-link, no View Bitcoin", async () => {
    const html = await renderBtcWidgets("complete");
    expect(html).toContain("View proofs");
    expect(html).toContain('href="/proof-center"');
    expect(html).not.toContain("View Bitcoin");
    expect(html).not.toMatch(/href="\/btc"/);
  });

  it("sources panel is Bitcoin-titled with no vague Strategic BTC", async () => {
    const html = await renderBtcWidgets("complete");
    // Series labels live in the Recharts legend (client runtime, absent from
    // static markup); the static header title + the retired-term absence are
    // what we can assert here.
    expect(html).toContain("Sources of Bitcoin");
    expect(html).toContain("View mining contribution");
    expect(html).not.toContain("Strategic BTC");
  });

  it("ledger shows movements with per-row evidence and statuses", async () => {
    const html = await renderBtcWidgets("complete");
    expect(html).toContain("Mining settlement credited to B2 reserve");
    expect(html).toContain("Reserve acquisition settled");
    expect(html).toContain("Operational conversion");
    expect(html).toContain("Verified");
    expect(html).toContain("Confirmed");
    expect(html).toContain("View"); // per-row evidence link
    // signed BTC deltas — inflow carries a "+", outflow reads muted (no red).
    expect(html).toContain("+0.517 BTC");
    expect(html).toContain("0.032 BTC");
  });

  it("maturity delivery is BTC-only with honest wallet state", async () => {
    const html = await renderBtcWidgets("complete");
    expect(html).toContain("BTC maturity delivery");
    expect(html).toContain("Maturity delivery: BTC only");
    expect(html).toMatch(/Month \d+ \/ 24/);
    expect(html).toContain("Pending contract deployment");
    expect(html).toContain("Fireblocks");
    // No USDC redemption on the investor maturity surface.
    expect(html).not.toMatch(/redemption in USDC|USDC redemption/i);
  });

  it("marks fixture sources as Simulated (unified provenance)", async () => {
    const html = await renderBtcWidgets("complete");
    expect(html).toContain("Simulated");
  });

  it("renders not-configured with honest empty states", async () => {
    const html = await renderBtcWidgets("not-configured");
    expect(html).toMatch(/Accumulation history will appear/i);
    expect(html).toMatch(/Bitcoin movements will appear/i);
    expect(html).not.toMatch(FORBIDDEN_COPY);
  });
});

describe("btc page structure", () => {
  const pageSrc = readFileSync(join(BTC_ROOT, "page.tsx"), "utf8");

  it("runs the chart in btc tone, no projection line, proofs action", () => {
    expect(pageSrc).toContain('tone="btc"');
    expect(pageSrc).toContain("showReference={false}");
    expect(pageSrc).toContain("View proofs");
    expect(pageSrc).toContain("/proof-center");
    expect(pageSrc).not.toContain('tone="accent"');
  });

  it("has no self-link and no duplicate Bitcoin CTA", () => {
    const live = stripComments(pageSrc);
    expect(live).not.toMatch(/href=["']\/btc["']/);
    expect(live).not.toContain("View Bitcoin");
  });

  it("composes the five zones and drops the duplicated Dashboard modules", () => {
    expect(pageSrc).toContain("HeroPanel");
    expect(pageSrc).toContain("BtcStrategyStrip");
    expect(pageSrc).toContain("AccumulationChartPanel");
    expect(pageSrc).toContain("SourcesAccumulationPanel");
    expect(pageSrc).toContain("BtcLedgerTable");
    expect(pageSrc).toContain("BtcMaturityPanel");
    // Modules that belong to the Dashboard (or were retired) are gone:
    expect(pageSrc).not.toContain("StrategyCompositionPanel");
    expect(pageSrc).not.toContain("MiningPulsePanel");
    expect(pageSrc).not.toContain("ReserveHealthPanel");
    expect(pageSrc).not.toContain("BtcProofPanel");
    expect(pageSrc).not.toContain("BtcTrajectoryChart");
  });

  it("keeps only the three institutional local components", () => {
    const components = readdirSync(join(BTC_ROOT, "_components")).sort();
    expect(components).toEqual([
      "btc-ledger-table.tsx",
      "btc-maturity-panel.tsx",
      "btc-strategy-strip.tsx",
    ]);
  });

  it("live btc sources carry no banned vocabulary", () => {
    for (const f of collectSourceFiles(BTC_ROOT)) {
      const src = stripComments(readFileSync(f, "utf8"));
      for (const pattern of BANNED_SOURCE_COPY) {
        expect(src, `${f} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
