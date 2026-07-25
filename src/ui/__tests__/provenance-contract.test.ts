import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PROVENANCE_DESCRIPTIONS,
  PROVENANCE_KINDS,
  PROVENANCE_LABELS,
  toProvenance,
  txProvenance,
} from "@/lib/provenance";

/**
 * Provenance contract (Mission U1) — the TWO badge primitives
 * (src/ui/badge.tsx ProvenanceBadge and
 * src/components/catalyst/provenance-badge.tsx) must share EXACTLY the 8
 * canonical kinds of src/lib/provenance.ts, and NEITHER kind→variant mapping
 * may contain `danger`: red on a provenance is forbidden by doctrine — stale
 * or simulated data is not an error.
 */

const ROOT = process.cwd();
const UI_BADGE = "src/ui/badge.tsx";
const CATALYST_BADGE = "src/components/catalyst/provenance-badge.tsx";

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

/** Extracts the body of the `const variants: Record<Provenance, …> = { … }`
 *  kind→variant mapping from a badge source file. */
function variantsBlock(rel: string): string {
  const src = read(rel);
  const m = src.match(
    /const variants: Record<\s*Provenance,[^>]*>\s*=\s*\{([\s\S]*?)\}/,
  );
  if (!m) {
    throw new Error(
      `${rel}: no "const variants: Record<Provenance, …> = { … }" mapping found — ` +
        `the provenance contract cannot be verified.`,
    );
  }
  return m[1]!;
}

function mappingKeys(block: string): string[] {
  return [...block.matchAll(/(\w+):/g)].map((m) => m[1]!);
}

function mappingValues(block: string): string[] {
  return [...block.matchAll(/:\s*"([\w-]+)"/g)].map((m) => m[1]!);
}

describe("canonical provenance vocabulary (src/lib/provenance.ts)", () => {
  it("defines exactly the 8 canonical kinds", () => {
    expect([...PROVENANCE_KINDS].sort()).toEqual(
      [
        "live",
        "oracle",
        "attested",
        "estimated",
        "partial",
        "manual",
        "stale",
        "simulated",
      ].sort(),
    );
  });

  it("labels and descriptions cover every kind", () => {
    expect(Object.keys(PROVENANCE_LABELS).sort()).toEqual(
      [...PROVENANCE_KINDS].sort(),
    );
    expect(Object.keys(PROVENANCE_DESCRIPTIONS).sort()).toEqual(
      [...PROVENANCE_KINDS].sort(),
    );
  });

  it("simulated keeps the sandbox description (never passes for production)", () => {
    expect(PROVENANCE_DESCRIPTIONS.simulated).toBe(
      "Demo sandbox data — not a production record",
    );
  });
});

describe("the two badge primitives share EXACTLY the 8 kinds", () => {
  const uiKeys = mappingKeys(variantsBlock(UI_BADGE));
  const catalystKeys = mappingKeys(variantsBlock(CATALYST_BADGE));

  it("src/ui badge maps every canonical kind, nothing more", () => {
    expect([...uiKeys].sort()).toEqual([...PROVENANCE_KINDS].sort());
  });

  it("catalyst badge maps every canonical kind, nothing more", () => {
    expect([...catalystKeys].sort()).toEqual([...PROVENANCE_KINDS].sort());
  });
});

describe("no red on provenance — `danger` is forbidden in both mappings", () => {
  it("src/ui badge mapping contains no danger (sober palette only)", () => {
    const values = mappingValues(variantsBlock(UI_BADGE));
    expect(values).not.toContain("danger");
    // Sober doctrine: live is the ONLY accent; everything else is grey chrome.
    // No warning-yellow, no info-blue, no second green.
    for (const v of values) {
      expect(["accent", "default", "outline"]).toContain(v);
    }
  });

  it("catalyst badge mapping contains no danger", () => {
    const values = mappingValues(variantsBlock(CATALYST_BADGE));
    expect(values).not.toContain("danger");
    expect(values).not.toContain("warning");
    for (const v of values) {
      expect(["success", "brand", "default", "flat"]).toContain(v);
    }
  });

  it("stale is not red in the src/ui badge (a stale figure is not an error)", () => {
    const block = variantsBlock(UI_BADGE);
    expect(block).toMatch(/stale:\s*"(default|outline)"/);
  });
});

describe("shared honesty helpers", () => {
  it("toProvenance keeps the UNIFIED DataStatus mapping", () => {
    expect(toProvenance("LIVE")).toBe("live");
    expect(toProvenance("STALE")).toBe("stale");
    expect(toProvenance("FIXTURE")).toBe("simulated");
    expect(toProvenance("PARTIAL")).toBe("partial");
    expect(toProvenance("ANYTHING_ELSE")).toBe("estimated");
  });

  it("txProvenance detects 0xMOCK case-insensitively and never invents a live kind", () => {
    expect(txProvenance(null)).toBe("manual");
    expect(txProvenance(undefined)).toBe("manual");
    expect(txProvenance("")).toBe("manual");
    expect(txProvenance("0xMOCK1234")).toBe("simulated");
    expect(txProvenance("0xmockabcd")).toBe("simulated");
    expect(txProvenance("0xAbC123")).toBe("attested");
  });
});
