// Asset visual analytics guard — PROMPT 234
// Ensures investor UI uses semantic tokens, shared AssetIcon, and no artificial stretch.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ASSET_TOKEN } from "@/lib/ds/asset-tokens";
import {
  ACCUMULATION_CHART_CONFIG,
  SOURCES_STACKED_CONFIG,
  STRATEGY_DONUT_CONFIG,
  MINING_PULSE_CONFIG,
} from "@/features/investor-ui/charts/asset-chart-config";

const INVESTOR_PATHS = [
  "src/app/(product)/dashboard",
  "src/app/(product)/btc",
  "src/features/investor-ui/components",
  "src/features/investor-ui/charts",
] as const;

const FORBIDDEN_ASSET_HEX = /#F7931A|#f7931a|#60A5FA|#60a5fa|#D97706|#d97706/;

function collectFiles(root: string): string[] {
  const absRoot = join(process.cwd(), root);
  let entries: string[];
  try {
    entries = readdirSync(absRoot);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const entry of entries) {
    const abs = join(absRoot, entry);
    const rel = join(root, entry);
    const stat = statSync(abs);
    if (stat.isDirectory()) {
      files.push(...collectFiles(rel));
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.includes(".test.")) {
      files.push(rel);
    }
  }
  return files;
}

const allFiles = INVESTOR_PATHS.flatMap(collectFiles);

describe("asset visual analytics", () => {
  it("exports semantic asset tokens as CSS var references", () => {
    expect(ASSET_TOKEN.btc).toBe("var(--ct-asset-btc)");
    expect(ASSET_TOKEN.usdc).toBe("var(--ct-asset-usdc)");
    expect(ASSET_TOKEN.mining).toBe("var(--ct-asset-mining)");
    expect(ASSET_TOKEN.live).toBe("var(--ct-status-success)");
  });

  it("chart configs use asset tokens, not raw hex", () => {
    const configs = [
      ACCUMULATION_CHART_CONFIG,
      SOURCES_STACKED_CONFIG,
      STRATEGY_DONUT_CONFIG,
      MINING_PULSE_CONFIG,
    ];
    for (const cfg of configs) {
      for (const entry of Object.values(cfg)) {
        if (entry && "color" in entry && entry.color) {
          expect(entry.color).toMatch(/^var\(--ct-/);
        }
      }
    }
  });

  it("strategy donut defines three semantic pocket series", () => {
    expect(STRATEGY_DONUT_CONFIG.mining.color).toBe(ASSET_TOKEN.mining);
    expect(STRATEGY_DONUT_CONFIG.btc.color).toBe(ASSET_TOKEN.btc);
    expect(STRATEGY_DONUT_CONFIG.ops.color).toBe(ASSET_TOKEN.usdc);
  });

  it("sources stacked bar uses distinct mining and BTC series", () => {
    expect(SOURCES_STACKED_CONFIG.mining.color).toBe(ASSET_TOKEN.mining);
    expect(SOURCES_STACKED_CONFIG.strategic.color).toBe(ASSET_TOKEN.btc);
  });

  it("investor components do not hard-code asset brand hex", () => {
    const offenders: string[] = [];
    for (const file of allFiles) {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      if (FORBIDDEN_ASSET_HEX.test(src)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("dashboard and btc pages share AssetIcon primitive", () => {
    const dash = readFileSync(
      join(process.cwd(), "src/features/investor-ui/components/asset-icon.tsx"),
      "utf8",
    );
    expect(dash).toContain('variant === "btc"');
    expect(dash).toContain("/crypto-icons/btc.svg");
    expect(dash).toContain("/crypto-icons/usdc.svg");
    expect(dash).not.toMatch(/[\u{1F300}-\u{1FFFF}]/u);
  });

  it("strategy and health panels avoid h-full stretch on cards", () => {
    // The legacy dashboard-strategy-panel / dashboard-health-panel were
    // replaced by the shared panels — the guard follows them.
    const strategy = readFileSync(
      join(process.cwd(), "src/features/investor-ui/components/strategy-composition-panel.tsx"),
      "utf8",
    );
    const miningPulse = readFileSync(
      join(process.cwd(), "src/features/investor-ui/components/widgets/mining-pulse-panel.tsx"),
      "utf8",
    );
    const reserveHealth = readFileSync(
      join(process.cwd(), "src/features/investor-ui/components/widgets/reserve-health-panel.tsx"),
      "utf8",
    );
    expect(strategy).not.toMatch(/\bh-full\b/);
    expect(miningPulse).not.toMatch(/\bh-full\b/);
    expect(reserveHealth).not.toMatch(/\bh-full\b/);
    expect(strategy).not.toMatch(/\bflex-1\b/);
  });

  it("dashboard uses independent flex columns for natural card flow", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(product)/dashboard/page.tsx"), "utf8");
    expect(page).toContain("lg:flex-row");
    expect(page).not.toContain("grid-cols-12");
  });

  it("accumulation and sources panels share asset chart config", () => {
    const acc = readFileSync(
      join(process.cwd(), "src/features/investor-ui/components/accumulation-chart-panel.tsx"),
      "utf8",
    );
    const src = readFileSync(
      join(process.cwd(), "src/features/investor-ui/components/sources-accumulation-panel.tsx"),
      "utf8",
    );
    expect(acc).toContain("ACCUMULATION_CHART_CONFIG");
    expect(src).toContain("SOURCES_STACKED_CONFIG");
    expect(acc).toContain("AssetIcon");
    expect(src).toContain("AssetIcon");
  });
});
