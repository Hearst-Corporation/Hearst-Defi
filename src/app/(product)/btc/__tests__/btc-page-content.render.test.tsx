// /btc recomposition (UI refonte, Bitcoin pass) — render + structure tests.
// Pattern: renderToStaticMarkup (vitest env = node, no RTL/jsdom — cf.
// shared-panels.render.test.tsx / dashboard-page.render.test.tsx).
//
// Locks:
//  - Zone 1: hero = PROGRAM cumulative BTC (same series as the chart), never
//    mining.totalBtcEarnedSats and never reserveBtcSats — those figures keep
//    their own labels ("BTC produced (mining)" / "BTC in reserve");
//  - Zone 2: chart action -> /proof-center, NO self-link, no "View Bitcoin";
//  - Zone 5: proof panel shows REAL kinds, no fabricated "Verified {date}";
//  - Zone 6 (D8): trajectory = simulated bands ONLY — the 9.4–12.8% return
//    range is banned from this surface;
//  - compliance: no yield/APY/guarantee/promise/risk-free/"Just now".

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { getBtcPageData } from "../_data/get-btc-page-data";
import { getFixtureInvestorUiDataSource } from "@/features/investor-ui/data-source";
import { buildAccumulationSeries } from "@/features/investor-ui/charts/accumulation-series";
import { formatBtcAmount, toProvenance } from "@/features/investor-ui/format-btc";

import { HeroPanel } from "@/features/investor-ui/components/widgets/hero-panel";
import { AccumulationChartPanel } from "@/features/investor-ui/components/accumulation-chart-panel";
import { SourcesAccumulationPanel } from "@/features/investor-ui/components/sources-accumulation-panel";
import { StrategyCompositionPanel } from "@/features/investor-ui/components/strategy-composition-panel";
import { MiningPulsePanel } from "@/features/investor-ui/components/widgets/mining-pulse-panel";
import { ReserveHealthPanel } from "@/features/investor-ui/components/widgets/reserve-health-panel";
import { AnalystNotePanel } from "@/features/investor-ui/components/analyst-note-panel";
import { BtcProofPanel } from "../_components/btc-proof-panel";
import { BtcTrajectoryChart } from "../_components/btc-trajectory-chart";

const FORBIDDEN_COPY = /\bapy\b|\byield\b|\bguarantee\b|\bpromise\b|\brisk-free\b|\bwill deliver\b|Just now/i;

const BANNED_SOURCE_COPY = [
  /\bestimated return\b/i,
  /\breturn range\b/i,
  /\btarget apy\b/i,
  /\bprojected yield\b/i,
  /\bexpected return\b/i,
  /\bmonthly distribution\b/i,
  /\bcash distribution\b/i,
  /\bperformance variation\b/i,
  /\bApyRange\b/,
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
  const aiExperts = await getFixtureInvestorUiDataSource().getAiExperts();
  const dashboard = await getFixtureInvestorUiDataSource().getDashboard();

  const production = data.extra.production;
  const points = buildAccumulationSeries(production.value?.monthly);
  const lastPoint = points[points.length - 1];
  const programBtc =
    lastPoint != null ? formatBtcAmount(lastPoint.cumulativeBtc.toFixed(8), 4) : null;
  const miningProgramBtc =
    production.value?.cumulativeBtcEarned != null
      ? formatBtcAmount(production.value.cumulativeBtcEarned, 6)
      : null;
  const provenance = toProvenance(production.status);

  return renderToStaticMarkup(
    <>
      <HeroPanel
        title="BTC accumulated"
        mainValue={programBtc ?? "—"}
        provenance={provenance}
        asset="btc"
        metrics={[
          { label: "Current value (per BTC)", value: "$6,000,000" },
          { label: "Mining-produced (program)", value: miningProgramBtc ?? "—", accent: "btc" },
          { label: "Strategic exposure", value: "0.4200 BTC", accent: "mining" },
        ]}
      />
      <AccumulationChartPanel
        points={points}
        currentMonth={9}
        totalMonths={24}
        provenance={provenance}
        tone="btc"
        action={{ label: "View proofs →", href: "/proof-center" }}
      />
      <SourcesAccumulationPanel
        monthlyProduction={points.map((p) => ({
          period: p.period,
          mining: p.miningBtc,
          strategic: Math.max(0, p.cumulativeBtc - p.miningBtc),
        }))}
        provenance={provenance}
      />
      <StrategyCompositionPanel
        pockets={dashboard.allocation.value?.pockets ?? null}
        provenance={toProvenance(dashboard.allocation.status)}
      />
      <MiningPulsePanel mining={mining} density="compact" />
      <ReserveHealthPanel btc={data} density="compact" />
      <BtcProofPanel
        proofs={data.extra.proofs.value ?? []}
        provenance={toProvenance(data.extra.proofs.status)}
      />
      <BtcTrajectoryChart trajectory={data.extra.trajectory} />
      <AnalystNotePanel aiExperts={aiExperts} variant="bitcoin" />
    </>,
  );
}

describe("Bitcoin page widgets (UI refonte)", () => {
  it("renders the full complete composition without banned copy", async () => {
    const html = await renderBtcWidgets("complete");
    expect(html).toContain("BTC accumulated");
    expect(html).toContain("Sources of accumulation");
    expect(html).toContain("Strategy composition");
    expect(html).toContain("Mining pulse");
    expect(html).toContain("Reserve health");
    expect(html).toContain("Contextual proofs");
    expect(html).toContain("Accumulation trajectory");
    expect(html).toContain("Bitcoin Reserve Analyst");
    expect(html).not.toMatch(FORBIDDEN_COPY);
    expect(html).not.toMatch(/\bestimated return\b/i);
  });

  it("hero = program cumulative BTC; fleet + reserve figures keep distinct labels", async () => {
    const html = await renderBtcWidgets("complete");
    // Program series last point: 2.8 BTC mining cumulative × 1.15 sleeve.
    expect(html).toContain("3.2200 BTC");
    expect(html).toContain("Mining-produced (program)");
    expect(html).toContain("2.800000 BTC");
    // Fleet production (MiningPulsePanel) — its own label, never the hero's.
    expect(html).toContain("BTC produced (mining)");
    expect(html).toContain("0.184205 BTC");
    // Reserve holdings (ReserveHealthPanel) — its own label.
    expect(html).toContain("BTC in reserve");
    expect(html).toContain("6.12 BTC");
  });

  it("chart links to proofs — no self-link, no View Bitcoin (D10)", async () => {
    const html = await renderBtcWidgets("complete");
    expect(html).toContain("View proofs");
    expect(html).toContain('href="/proof-center"');
    expect(html).not.toContain("View Bitcoin");
    expect(html).not.toMatch(/href="\/btc"/);
  });

  it("proof panel shows real kinds and no fabricated verification date", async () => {
    const html = await renderBtcWidgets("complete");
    expect(html).toContain("PoR");
    expect(html).toContain("Custody");
    expect(html).toContain("Event log");
    expect(html).toContain("View proof");
    // The falsified "Verified {generatedAt}" line is retired.
    expect(html).not.toMatch(/Verified\s/);
  });

  it("proof panel with zero proofs still renders its Card (no silent grid hole)", () => {
    const html = renderToStaticMarkup(
      <BtcProofPanel proofs={[]} provenance="estimated" />,
    );
    expect(html).toContain("Contextual proofs");
    expect(html).toMatch(/Proof references will appear once attestations are indexed/i);
    // No proof rows rendered, but the header + card chrome still occupy
    // their place in the md:grid-cols-3 zone-5 grid.
    expect(html).not.toContain("View proof");
  });

  it("trajectory = simulated bands only, no % return range (D8)", async () => {
    const html = await renderBtcWidgets("complete");
    expect(html).toContain("Methodology v3.0");
    expect(html).toContain("not guaranteed");
    expect(html).toContain("p5");
    // The 9.4–12.8% headline is banned from this surface (SVG pixel
    // coordinates are not display copy — only rendered percentages count).
    expect(html).not.toMatch(/9\.4\s*(?:–|-|&#x2013;)\s*12\.8|9\.4\s*%|12\.8\s*%/);
  });

  it("marks fixture sources as Simulated (unified provenance)", async () => {
    const html = await renderBtcWidgets("complete");
    expect(html).toContain("Simulated");
  });

  it("renders not-configured with honest empty states", async () => {
    const html = await renderBtcWidgets("not-configured");
    expect(html).toMatch(/Accumulation history will appear/i);
    expect(html).toContain("not deployed yet");
    // Zone 5 (proof panel): empty proofs no longer collapse to a silent hole
    // in the md:grid-cols-3 grid — the card still renders, honestly empty.
    expect(html).toContain("Contextual proofs");
    expect(html).toMatch(/Proof references will appear once attestations are indexed/i);
  });
});

describe("btc page structure", () => {
  const pageSrc = readFileSync(join(BTC_ROOT, "page.tsx"), "utf8");

  it("runs the chart in btc tone with the proofs action", () => {
    expect(pageSrc).toContain('tone="btc"');
    expect(pageSrc).toContain("View proofs");
    expect(pageSrc).toContain("/proof-center");
    expect(pageSrc).not.toContain('tone="accent"');
  });

  it("has no self-link and no duplicate Bitcoin CTA", () => {
    const live = stripComments(pageSrc);
    expect(live).not.toMatch(/href=["']\/btc["']/);
    expect(live).not.toContain("View Bitcoin");
  });

  it("composes the six zones from shared panels", () => {
    expect(pageSrc).toContain("HeroPanel");
    expect(pageSrc).toContain("AccumulationChartPanel");
    expect(pageSrc).toContain("SourcesAccumulationPanel");
    expect(pageSrc).toContain("StrategyCompositionPanel");
    expect(pageSrc).toContain("MiningPulsePanel");
    expect(pageSrc).toContain("ReserveHealthPanel");
    expect(pageSrc).toContain("BtcProofPanel");
    expect(pageSrc).toContain("BtcTrajectoryChart");
    expect(pageSrc).toContain("AnalystNotePanel");
    expect(pageSrc).toContain("lg:flex-row");
    expect(pageSrc).not.toContain("grid-cols-12");
  });

  it("keeps only the two resurrected local components (D9)", () => {
    const components = readdirSync(join(BTC_ROOT, "_components")).sort();
    expect(components).toEqual(["btc-proof-panel.tsx", "btc-trajectory-chart.tsx"]);
  });

  it("live btc sources carry no banned vocabulary", () => {
    for (const f of collectSourceFiles(BTC_ROOT)) {
      const src = readFileSync(f, "utf8");
      for (const pattern of BANNED_SOURCE_COPY) {
        expect(src, `${f} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
