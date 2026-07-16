/**
 * Investor UI foundation guards (PROMPT 225).
 *
 * NOT a fragile style linter — three STRUCTURAL invariants that, if silently
 * regressed, reintroduce exactly the "everything too big / second product /
 * over-elevated nav" problems this pass fixed. Each asserts a proven root cause
 * stays closed:
 *
 *  1. Typography scope: the four V2 investor routes must keep a layout that
 *     loads doc-flow.css and applies `.product-doc` — without it every
 *     `.ct-bento-*` / `.ct-metric-*` class falls back to the 16px body (the
 *     "125%" root cause). See docs/investor-navigation-decision.md.
 *  2. No fixed wide right-rail column: no (product) page may hardcode a
 *     `grid-cols-[minmax(0,1fr)_<N>px]` column ≥ 280px — that is the persistent
 *     "AI Experts" rail that starved the main content and read as a second
 *     product.
 *  3. Nav stays simplified to Dashboard · Bitcoin · Profile (PROMPT 227).
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import { PRODUCT_NAV } from "@/components/nav/product-nav-items";

const PRODUCT_ROOT = join(process.cwd(), "src/app/(product)");

// The V2 investor routes that emit bento/metric typography and therefore MUST
// be wrapped in the doc-flow `.product-doc` scope.
const V2_ROUTES = ["dashboard", "btc", "mining", "my-vaults"] as const;

describe("investor UI foundation — typography scope (root cause #1)", () => {
  it.each(V2_ROUTES)("%s has a layout that loads doc-flow.css + .product-doc", (route) => {
    const layoutPath = join(PRODUCT_ROOT, route, "layout.tsx");
    expect(existsSync(layoutPath), `${route}/layout.tsx must exist`).toBe(true);
    const src = readFileSync(layoutPath, "utf8");
    expect(src, `${route}/layout.tsx must import doc-flow.css`).toMatch(/doc-flow\.css/);
    expect(src, `${route}/layout.tsx must apply the .product-doc scope`).toMatch(/product-doc/);
  });
});

describe("investor UI foundation — no fixed wide right-rail column (root cause #2)", () => {
  // Matches a hardcoded second grid column of >= 280px, e.g.
  // `lg:grid-cols-[minmax(0,1fr)_320px]` — the persistent AI-Experts rail.
  const FIXED_RAIL = /grid-cols-\[minmax\(0,\s*1fr\)_(\d{3,})px\]/g;

  function collectTsx(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__" || entry.name === "node_modules") continue;
        out.push(...collectTsx(full));
      } else if (entry.name.endsWith(".tsx")) {
        out.push(full);
      }
    }
    return out;
  }

  it("no (product) surface reintroduces a >=280px fixed right-rail grid column", () => {
    const offenders: string[] = [];
    for (const file of collectTsx(PRODUCT_ROOT)) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(FIXED_RAIL)) {
        const px = Number(m[1]);
        if (px >= 280) offenders.push(`${file.replace(process.cwd() + "/", "")} → ${m[0]}`);
      }
    }
    expect(offenders, `Fixed wide right-rail columns found:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("investor UI foundation — simplified nav (IA decision)", () => {
  it("PRODUCT_NAV is exactly Dashboard · Bitcoin · Profile", () => {
    expect(PRODUCT_NAV.map((n) => n.id)).toEqual(["dashboard", "bitcoin", "profile"]);
  });

  it("Proof and Mining are off the primary rail", () => {
    const ids = PRODUCT_NAV.map((n) => n.id);
    expect(ids).not.toContain("proof");
    expect(ids).not.toContain("mining");
    expect(ids).not.toContain("vault");
  });

  it("Bitcoin is on the primary rail at /btc", () => {
    const bitcoin = PRODUCT_NAV.find((n) => n.id === "bitcoin");
    expect(bitcoin?.label).toBe("Bitcoin");
    expect(bitcoin?.href).toBe("/btc");
  });
});
