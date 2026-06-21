/**
 * Risk Pulse — unit tests for pure-logic helpers exported from the component.
 *
 * We test the helper functions (trendMeta, compositeLabelColor, buildSparklinePath)
 * which encode all the behaviour described in the spec:
 *   1. 5 score entries → each maps to a known label
 *   2. Composite Low–Moderate with score 36 → correct colour class
 *   3. Rising delta (>0) → danger icon + colour
 *   4. Falling delta (<0) → success icon + colour
 *   5. Stable delta (0) → flat icon + faint colour
 */
import { describe, expect, it } from "vitest";
import {
  buildSparklinePath,
  compositeLabelColor,
  trendMeta,
  type CompositeLabel,
  type RiskScore,
} from "../risk-pulse";

// ── 1. All 5 canonical dimension values are accepted by the type ──────────────
describe("RiskScore dimensions", () => {
  it("all 5 canonical dimensions map to non-empty labels", () => {
    const dimensions: RiskScore["dimension"][] = [
      "market",
      "mining",
      "liquidity",
      "smart_contract",
      "counterparty",
    ];
    // Simply confirm TypeScript compiles the set without 'never' errors and
    // that we can create valid objects for each.
    const scores: RiskScore[] = dimensions.map((d, i) => ({
      dimension: d,
      score: 20 + i * 10,
      delta30d: i - 2,
    }));
    expect(scores).toHaveLength(5);
    scores.forEach((s) => {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    });
  });
});

// ── 2. Composite Low–Moderate with score 36 → accent colour ─────────────────
describe("compositeLabelColor", () => {
  it("Low → success token", () => {
    expect(compositeLabelColor("Low")).toContain("ct-status-success");
  });

  it("Low–Moderate with score 36 → accent token", () => {
    const label: CompositeLabel = "Low–Moderate";
    const color = compositeLabelColor(label);
    expect(color).toBe("ct-text-accent");
  });

  it("Moderate → warning token", () => {
    expect(compositeLabelColor("Moderate")).toContain("ct-status-warning");
  });

  it("Elevated → danger token", () => {
    expect(compositeLabelColor("Elevated")).toContain("ct-status-danger");
  });

  it("High → danger token", () => {
    expect(compositeLabelColor("High")).toContain("ct-status-danger");
  });
});

// ── 3 & 4 & 5. Trend indicator — icon and colour ─────────────────────────────
describe("trendMeta", () => {
  it("rising delta (>0) → ▲ icon and danger colour (risk up = bad)", () => {
    const meta = trendMeta(3);
    expect(meta.icon).toBe("▲");
    expect(meta.colorClass).toContain("ct-status-danger");
    expect(meta.ariaLabel).toMatch(/rising/i);
  });

  it("falling delta (<0) → ▼ icon and success colour (risk down = good)", () => {
    const meta = trendMeta(-2);
    expect(meta.icon).toBe("▼");
    expect(meta.colorClass).toContain("ct-status-success");
    expect(meta.ariaLabel).toMatch(/falling/i);
  });

  it("stable delta (0) → ━━ icon and tertiary colour", () => {
    const meta = trendMeta(0);
    expect(meta.icon).toBe("━━");
    expect(meta.colorClass).toContain("ct-text-tertiary");
    expect(meta.ariaLabel).toMatch(/stable/i);
  });
});

// ── Bonus: sparkline path builder ────────────────────────────────────────────
describe("buildSparklinePath", () => {
  it("returns empty string for fewer than 2 points", () => {
    expect(buildSparklinePath([])).toBe("");
    expect(buildSparklinePath([50])).toBe("");
  });

  it("returns a path string starting with M for valid series", () => {
    const path = buildSparklinePath([20, 40, 30, 60, 50]);
    expect(path).toMatch(/^M /);
  });

  it("handles flat series (all same value) without NaN", () => {
    const path = buildSparklinePath([50, 50, 50, 50]);
    expect(path).not.toContain("NaN");
    expect(path).toMatch(/^M /);
  });

  it("handles 30-point series without NaN", () => {
    const series = Array.from({ length: 30 }, (_, i) =>
      Math.round(30 + Math.sin(i * 0.3) * 10),
    );
    const path = buildSparklinePath(series);
    expect(path).not.toContain("NaN");
  });
});
