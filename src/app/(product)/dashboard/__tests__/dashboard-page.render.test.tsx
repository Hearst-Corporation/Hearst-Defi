// Dashboard recomposition (UI refonte, Dashboard pass) — render + structure
// tests. Pattern: renderToStaticMarkup (vitest env = node, no RTL/jsdom — cf.
// shared-panels.render.test.tsx / prompt-227).
//
// Locks:
//  - D5: hero = program KPI band (Current position primary, capital / BTC
//    accumulated / current BTC value, term progress) — "BTC accumulated" is
//    the PROGRAM cumulative series, never mining.totalBtcEarnedSats;
//  - D10: exactly ONE "View Bitcoin →" across the dashboard route (hero);
//  - D2: the accumulation chart runs tone="accent" with action={null};
//  - D3: strategy strip = proportional bar, actual-vs-target labelled, no
//    fabricated 40/27/33 fallback;
//  - compliance: no yield/APY/guarantee/promise/risk-free/"Just now".

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { dashboardCompleteFixture } from "@/features/investor-ui/fixtures/dashboard-complete";
import { miningCompleteFixture } from "@/features/investor-ui/fixtures/mining-complete";
import { btcPageExtraCompleteFixture } from "@/app/(product)/btc/_data/btc-page-fixtures";
import { buildAccumulationSeries } from "@/features/investor-ui/charts/accumulation-series";
import { resolved } from "@/features/investor-ui/types/common";
import type { AllocationBreakdownViewModel, InvestorPositionViewModel } from "@/features/investor-ui/types/dashboard";

import { DashboardHero } from "../_components/dashboard-hero";
import { StrategyStrip } from "../_components/strategy-strip";
import { DashboardCapacityPanel } from "../_components/dashboard-capacity-panel";
import { VerifiedActivityPanel } from "../_components/verified-activity-panel";

const FORBIDDEN_COPY = /\bapy\b|\byield\b|\bguarantee\b|\bpromise\b|\brisk-free\b|\bwill deliver\b|Just now/i;

// Source-file scan uses the prompt-227 compound patterns: the vault route id
// ("hearst-yield-vault") legitimately contains "yield" — the banned thing is
// yield/return COPY, not the historical route key.
const BANNED_SOURCE_COPY = [
  /\bestimated return\b/i,
  /\breturn range\b/i,
  /\btarget apy\b/i,
  /\bprojected yield\b/i,
  /\bexpected return\b/i,
  /\bmonthly distribution\b/i,
  /\bcash distribution\b/i,
  /\bperformance variation\b/i,
  /\bguarantee\b/i,
  /\brisk-free\b/i,
  /Just now/,
];

const stripComments = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

const points = buildAccumulationSeries(btcPageExtraCompleteFixture.production.value?.monthly);

const DASHBOARD_ROOT = join(process.cwd(), "src/app/(product)/dashboard");

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

describe("DashboardHero (D5/D10)", () => {
  const html = renderToStaticMarkup(
    <DashboardHero
      position={dashboardCompleteFixture.position}
      mining={miningCompleteFixture}
      accumulationPoints={points}
      accumulationStatus={btcPageExtraCompleteFixture.production.status}
    />,
  );

  it("renders the program KPI band", () => {
    expect(html).toContain("Current position");
    expect(html).toContain("Capital allocated");
    expect(html).toContain("$250,000");
    expect(html).toContain("BTC accumulated");
    expect(html).toContain("Your BTC value");
    // Reporting-period cell carries the term progress (Month 9 / 24).
    expect(html).toContain("Reporting period");
    expect(html).toContain("Month");
    expect(html).toContain("24");
    expect(html).toContain("37.5% complete");
  });

  it("BTC accumulated = program cumulative series, not fleet production", () => {
    // The SAME figure the accumulation chart's "actual" line ends on (mining
    // cumulative + strategic sleeve) — NOT mining.totalBtcEarnedSats (the
    // 0.184205 BTC fleet figure, which belongs to MiningPulsePanel).
    // P0.6 Figure idiom: the value and its unit are separate spans — the unit
    // ("BTC") renders as a small uppercase tracked span right after the digits.
    const last = points[points.length - 1]!;
    const value = last.cumulativeBtc.toFixed(2);
    expect(html).toMatch(
      new RegExp(`${value.replace(".", "\\.")}\\s*<span[^>]*>BTC</span>`),
    );
    expect(html).not.toContain("0.184205");
  });

  it("carries no View Bitcoin CTA (rail navigation owns it, design pass)", () => {
    expect(html).not.toContain("View Bitcoin");
  });

  it("marks fixture sources as Simulated (unified provenance)", () => {
    expect(html).toContain("Simulated");
    expect(html).not.toContain("Estimated");
  });

  it("keeps the honest empty states of the retired position panel", () => {
    const noPosition = renderToStaticMarkup(
      <DashboardHero
        position={resolved("FIXTURE", { ...dashboardCompleteFixture.position.value!, positionsCount: 0 })}
        mining={miningCompleteFixture}
        accumulationPoints={points}
        accumulationStatus="FIXTURE"
      />,
    );
    expect(noPosition).toContain("No active position yet");
    expect(noPosition).toContain("Allocate capital");
    expect(noPosition).not.toContain("View Bitcoin");

    const notConfigured = renderToStaticMarkup(
      <DashboardHero
        position={resolved<InvestorPositionViewModel>("NOT_CONFIGURED", null)}
        mining={miningCompleteFixture}
        accumulationPoints={[]}
        accumulationStatus="NOT_CONFIGURED"
      />,
    );
    expect(notConfigured).toContain("not deployed");

    const unavailable = renderToStaticMarkup(
      <DashboardHero
        position={resolved<InvestorPositionViewModel>("UNAVAILABLE", null)}
        mining={miningCompleteFixture}
        accumulationPoints={[]}
        accumulationStatus="UNAVAILABLE"
      />,
    );
    expect(unavailable).toContain("unavailable");
  });

  it("has no banned vocabulary", () => {
    expect(html).not.toMatch(FORBIDDEN_COPY);
  });
});

describe("StrategyStrip (D3)", () => {
  it("shows the ACTUAL split when every pocket is indexed, labelled as such", () => {
    const html = renderToStaticMarkup(
      <StrategyStrip allocation={dashboardCompleteFixture.allocation} />,
    );
    expect(html).toContain("Strategy composition");
    expect(html).toContain("39.6%"); // B1 actual, not 40.0 target
    expect(html).toContain("27.4%");
    expect(html).toContain("33.0%");
    expect(html).toContain("Actual allocation");
    expect(html).toContain("Mining Power");
    expect(html).toContain("Bitcoin Reserve");
    expect(html).toContain("Operating Reserve");
  });

  it("falls back to TARGET split, labelled as such, when actuals are not indexed", () => {
    const targetOnly: AllocationBreakdownViewModel = {
      pockets: dashboardCompleteFixture.allocation.value!.pockets.map((p) => ({
        ...p,
        actualBps: null,
      })),
      targetTotalBps: 10000,
    };
    const html = renderToStaticMarkup(
      <StrategyStrip allocation={resolved("FIXTURE", targetOnly)} />,
    );
    expect(html).toContain("40.0%");
    expect(html).toContain("Target allocation");
  });

  it("renders an honest unavailable state instead of a fabricated 40/27/33", () => {
    const html = renderToStaticMarkup(<StrategyStrip allocation={resolved<AllocationBreakdownViewModel>("UNAVAILABLE", null)} />);
    expect(html).toContain("unavailable");
    expect(html).not.toContain("40.0%");
  });

  it("links to the Bitcoin page without duplicating the hero CTA (D10)", () => {
    const html = renderToStaticMarkup(
      <StrategyStrip allocation={dashboardCompleteFixture.allocation} />,
    );
    expect(html).toContain("Strategy detail");
    expect(html).toContain('href="/btc"');
    expect(html).not.toContain("View Bitcoin");
  });
});

describe("DashboardCapacityPanel (Zone 2)", () => {
  const html = renderToStaticMarkup(
    <DashboardCapacityPanel
      capacity={dashboardCompleteFixture.capacity}
      subscription={dashboardCompleteFixture.subscription}
      position={dashboardCompleteFixture.position}
    />,
  );

  it("leads with utilization + keeps figures as detail rows", () => {
    expect(html).toContain("42.1%");
    expect(html).toContain("Vault utilization");
    expect(html).toContain("Available capacity");
    expect(html).toContain("$11,580,000");
    expect(html).toContain("Your allocation");
    expect(html).toContain("Minimum additional");
  });

  it("keeps the eligible CTA", () => {
    expect(html).toContain("Allocate more capital");
  });

  it("keeps the gated CTA states", () => {
    const closed = renderToStaticMarkup(
      <DashboardCapacityPanel
        capacity={dashboardCompleteFixture.capacity}
        subscription={resolved("FIXTURE", {
          subscriptionOpen: false,
          minimumDeposit: "250000.000000",
          whitelistRequired: true,
          userEligible: true,
        })}
        position={dashboardCompleteFixture.position}
      />,
    );
    expect(closed).toContain("Subscriptions closed");
  });

  it("marks fixture capacity as Simulated", () => {
    expect(html).toContain("Simulated");
  });
});

describe("VerifiedActivityPanel (Zone 4)", () => {
  it("caps the timeline at 5 rows (1 alert + 1 attestation + 3 activity)", () => {
    const manyAlerts = [
      { code: "a1", severity: "info" as const, message: "First alert kept" },
      { code: "a2", severity: "info" as const, message: "Second alert dropped" },
    ];
    const manyActivity = Array.from({ length: 5 }, (_, i) => ({
      type: "deposit",
      amountUsdc: `${100001 + i}.000000`,
      occurredAt: "2026-01-15T09:12:00.000Z",
      txHash: null,
    }));
    const html = renderToStaticMarkup(
      <VerifiedActivityPanel
        activity={resolved("FIXTURE", manyActivity)}
        alerts={resolved("FIXTURE", manyAlerts)}
        proofs={dashboardCompleteFixture.proofs}
      />,
    );
    expect(html).toContain("First alert kept");
    expect(html).not.toContain("Second alert dropped");
    expect((html.match(/<li/g) ?? []).length).toBeLessThanOrEqual(5);
  });

  it("keeps the maturity disclaimer and deterministic dates", () => {
    const html = renderToStaticMarkup(
      <VerifiedActivityPanel
        activity={dashboardCompleteFixture.activity}
        alerts={dashboardCompleteFixture.alerts}
        proofs={dashboardCompleteFixture.proofs}
      />,
    );
    expect(html).toContain("delivered at maturity — not as periodic payouts");
    expect(html).toContain("Jan 15, 2026"); // formatIsoDate, UTC-stable
  });
});

describe("dashboard page structure (D1/D2/D10)", () => {
  const pageSrc = readFileSync(join(DASHBOARD_ROOT, "page.tsx"), "utf8");

  it("runs the signature accumulation chart (accent tone is intrinsic, no self-link)", () => {
    // The signature chart is accent-green by construction and carries no
    // route-self link — it renders the dashboard's own accumulation curve.
    expect(pageSrc).toContain("AccumulationChartSignature");
    expect(pageSrc).not.toContain("AccumulationChartPanel");
  });

  it("composes the three cockpit zones (no-scroll pass 2026-07-16)", () => {
    expect(pageSrc).toContain("DashboardHero");
    expect(pageSrc).toContain("AccumulationChartSignature");
    expect(pageSrc).toContain("StrategyOverviewPanel");
    expect(pageSrc).toContain("OpsRow");
    // Verified activity + analyst note retired from this surface — they live
    // on /proof-center. Guard against them creeping back.
    expect(pageSrc).not.toContain("VerifiedActivityPanel");
    expect(pageSrc).not.toContain("AnalystNotePanel");
  });

  it("keeps flex columns (no grid-cols-12) per the visual analytics guard", () => {
    expect(pageSrc).toContain("lg:flex-row");
    expect(pageSrc).not.toContain("grid-cols-12");
  });

  it("has NO 'View Bitcoin' CTA across dashboard sources (design pass — rail owns nav)", () => {
    // The hero's redundant "View Bitcoin →" button was retired 2026-07-16:
    // the left rail's Bitcoin entry is the navigation. Guard against it
    // creeping back into any dashboard source.
    const occurrences = collectSourceFiles(DASHBOARD_ROOT)
      .map((f) => (stripComments(readFileSync(f, "utf8")).match(/View Bitcoin/g) ?? []).length)
      .reduce((a, b) => a + b, 0);
    expect(occurrences).toBe(0);
  });

  it("dashboard sources carry no banned vocabulary", () => {
    for (const f of collectSourceFiles(DASHBOARD_ROOT)) {
      const src = readFileSync(f, "utf8");
      for (const pattern of BANNED_SOURCE_COPY) {
        expect(src, `${f} matched ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
