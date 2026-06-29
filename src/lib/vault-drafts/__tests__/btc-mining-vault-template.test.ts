import { describe, expect, it } from "vitest";

import {
  buildBtcMiningVaultDraftTemplate,
  BTC_MINING_VAULT_SECTION_IDS,
} from "../btc-mining-vault-template";
import { containsForbidden } from "@/lib/agents/forbidden-words";
import { CreateDraftSchema } from "@/app/admin/vaults/schema";

// The exact phrases the template must NEVER contain.
const BANNED_PHRASES = [
  "guaranteed apy",
  "guaranteed principal",
  "risk-free",
  "fixed income",
  "secured profit",
];

describe("buildBtcMiningVaultDraftTemplate — documented sections", () => {
  it("contains all fifteen documented sections in canonical order", () => {
    const t = buildBtcMiningVaultDraftTemplate();
    const ids = t.sections.map((s) => s.id);
    expect(ids).toEqual([...BTC_MINING_VAULT_SECTION_IDS]);
    expect(ids).toEqual([
      "product-thesis",
      "target-investor",
      "allocation-bands",
      "mining-floor",
      "btc-collateral-role",
      "stable-funding-engine",
      "monthly-distribution-target",
      "total-performance-target",
      "exit-conditions",
      "recovery-plan",
      "machine-lifecycle",
      "operator-economics",
      "risk-controls",
      "data-status",
      "open-validation-items",
    ]);
    // Every section has a title and at least one body line.
    for (const s of t.sections) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
    }
  });

  it("contains NO guarantee / risk-free / fixed-income / secured-profit language", () => {
    const t = buildBtcMiningVaultDraftTemplate();
    const md = t.markdown.toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      expect(md.includes(phrase), `markdown contains "${phrase}"`).toBe(false);
    }
    // The canonical forbidden-words guard must clear the whole markdown too.
    expect(containsForbidden(t.markdown)).toBeNull();
  });

  it("the markdown is a single document covering every section title", () => {
    const t = buildBtcMiningVaultDraftTemplate();
    for (const s of t.sections) {
      expect(t.markdown).toContain(`## ${s.title}`);
    }
    expect(t.markdown).toContain("Template only");
    expect(t.markdown).toContain("configured, not validated");
  });

  it("the total target reads as inclusive of distributions, never summed", () => {
    const t = buildBtcMiningVaultDraftTemplate();
    expect(t.markdown).toMatch(/inclusive of distributions/i);
    // No summed headline anywhere in the markdown.
    expect(t.markdown).not.toMatch(/\d+\s*%\s*\+\s*\d+\s*%/);
  });
});

describe("buildBtcMiningVaultDraftTemplate — CreateDraftInput mapping", () => {
  it("maps APY as a RANGE (low < high), never a single point", () => {
    const t = buildBtcMiningVaultDraftTemplate();
    expect(t.draftInput.targetApyHighBps).toBeGreaterThan(
      t.draftInput.targetApyLowBps,
    );
    expect(t.draftInput.targetApyLowBps).toBe(800); // 8%
    expect(t.draftInput.targetApyHighBps).toBe(1200); // 12%
  });

  it("allocation bps sum to exactly 10000 (allocation midpoints)", () => {
    const d = buildBtcMiningVaultDraftTemplate().draftInput;
    expect(
      d.targetMiningBps +
        d.targetBtcTacticalBps +
        d.targetUsdcBaseBps +
        d.targetStableReserveBps,
    ).toBe(10_000);
  });

  it("the mapped draftInput passes the real CreateDraftSchema", () => {
    const t = buildBtcMiningVaultDraftTemplate();
    const parsed = CreateDraftSchema.safeParse(t.draftInput);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("disclaimers carry the not-validated AND not-guaranteed notes, clean of forbidden words", () => {
    const t = buildBtcMiningVaultDraftTemplate();
    const disc = t.draftInput.disclaimers.toLowerCase();
    expect(disc).toMatch(/not validated/);
    expect(disc).toMatch(/not assured|not guaranteed|never guaranteed/);
    expect(t.draftInput.disclaimers.length).toBeGreaterThanOrEqual(80);
    expect(containsForbidden(t.draftInput.disclaimers)).toBeNull();
  });

  it("is pure/deterministic", () => {
    expect(buildBtcMiningVaultDraftTemplate()).toEqual(
      buildBtcMiningVaultDraftTemplate(),
    );
  });
});
