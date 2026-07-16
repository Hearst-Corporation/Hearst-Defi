/**
 * PROMPT 227 — investor vocabulary + navigation guards.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PRODUCT_NAV } from "@/components/nav/product-nav-items";
import { dashboardCompleteFixture } from "@/features/investor-ui/fixtures/dashboard-complete";
import { miningCompleteFixture } from "@/features/investor-ui/fixtures/mining-complete";
import { resolved } from "@/features/investor-ui/types/common";

import { DashboardHero } from "../dashboard/_components/dashboard-hero";
import { AccumulationChartPanel } from "@/features/investor-ui/components/accumulation-chart-panel";
import { StrategyCompositionPanel } from "@/features/investor-ui/components/strategy-composition-panel";
import { DashboardCapacityPanel } from "../dashboard/_components/dashboard-capacity-panel";
import { MiningPulsePanel } from "@/features/investor-ui/components/widgets/mining-pulse-panel";

const INVESTOR_SURFACES = [
  "src/app/(product)/dashboard/page.tsx",
  "src/app/(product)/btc/page.tsx",
  "src/app/(product)/mining/page.tsx",
] as const;

const BANNED_INVESTOR_COPY = [
  /\bestimated return\b/i,
  /\breturn range\b/i,
  /\btarget apy\b/i,
  /\bprojected yield\b/i,
  /\bexpected return\b/i,
  /\bmonthly distribution\b/i,
  /\bcash distribution\b/i,
  /\bperformance variation\b/i,
  /\bApyRange\b/,
];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      out.push(...collectSourceFiles(full));
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("PROMPT 227 — primary navigation", () => {
  it("rail is Dashboard · Bitcoin · Profile only", () => {
    expect(PRODUCT_NAV.map((n) => n.label)).toEqual(["Dashboard", "Bitcoin", "Profile"]);
  });

  it("excludes Proof, Mining, Vault, Invest, Allocation from rail", () => {
    const ids = PRODUCT_NAV.map((n) => n.id);
    expect(ids).not.toContain("proof");
    expect(ids).not.toContain("mining");
    expect(ids).not.toContain("vault");
    expect(ids).not.toContain("invest");
    expect(ids).not.toContain("allocation");
  });
});

describe("PROMPT 227 — banned yield vocabulary on investor surfaces", () => {
  const files = INVESTOR_SURFACES.flatMap((p) => {
    const full = join(process.cwd(), p);
    try {
      return collectSourceFiles(full);
    } catch {
      return [full];
    }
  });

  it.each(files)("%s has no banned yield/return copy", (file) => {
    const rel = file.replace(process.cwd() + "/", "");
    const src = readFileSync(file, "utf8");
    for (const pattern of BANNED_INVESTOR_COPY) {
      expect(src, `${rel} matched ${pattern}`).not.toMatch(pattern);
    }
  });
});

describe("PROMPT 227 — widget renders", () => {
  it("DashboardHero shows BTC accumulated, not yield", () => {
    const html = renderToStaticMarkup(
      <DashboardHero
        position={resolved("FIXTURE", dashboardCompleteFixture.position.value!)}
        mining={miningCompleteFixture}
        accumulationPoints={[
          { period: "2026-01", cumulativeBtc: 0.04, miningBtc: 0.035 },
          { period: "2026-02", cumulativeBtc: 0.09, miningBtc: 0.08 },
        ]}
        accumulationStatus="FIXTURE"
      />,
    );
    expect(html).toContain("BTC accumulated");
    expect(html).not.toMatch(/estimated return|apy|yield/i);
  });

  it("AccumulationChartPanel has no APY range", () => {
    const html = renderToStaticMarkup(
      <AccumulationChartPanel
        points={[
          { period: "2026-01", cumulativeBtc: 0.04, miningBtc: 0.035 },
          { period: "2026-02", cumulativeBtc: 0.09, miningBtc: 0.08 },
        ]}
        currentMonth={2}
        totalMonths={24}
        provenance="estimated"
      />,
    );
    expect(html).toContain("BTC accumulation");
    expect(html).not.toMatch(/9\.4|12\.8|apy|yield/i);
  });

  it("StrategyCompositionPanel uses Mining Power / Bitcoin Reserve labels", () => {
    const html = renderToStaticMarkup(
      <StrategyCompositionPanel
        pockets={dashboardCompleteFixture.allocation.value!.pockets}
      />,
    );
    expect(html).toContain("Mining Power");
    expect(html).toContain("Bitcoin Reserve");
    expect(html).toContain("Operating Reserve");
    expect(html).not.toContain("B1 ·");
  });

  it("DashboardCapacityPanel CTA is Allocate more capital", () => {
    const html = renderToStaticMarkup(
      <DashboardCapacityPanel
        capacity={dashboardCompleteFixture.capacity}
        subscription={dashboardCompleteFixture.subscription}
        position={dashboardCompleteFixture.position}
      />,
    );
    expect(html).toContain("Allocate more capital");
  });

  it("MiningPulsePanel links to /mining", () => {
    const html = renderToStaticMarkup(<MiningPulsePanel mining={miningCompleteFixture} />);
    expect(html).toContain("/mining");
    expect(html).toContain("Explore mining contribution");
  });
});
