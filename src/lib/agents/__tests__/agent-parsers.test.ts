import { describe, it, expect } from "vitest";

import {
  MiningHealthOutputSchema,
  RiskExplanationOutputSchema,
  ScenarioNarrativeOutputSchema,
  PtaiSchema,
  provenanceLabel,
  isDegradedProvenance,
  renderProvenanceLine,
  PROVENANCE_SYSTEM_RULE,
  PROVENANCE_TAGS,
  type ProvenanceTag,
} from "@/lib/agents/schemas";

/**
 * Unit pin for the PURE parts of the mining-health, risk-explanation and
 * scenario-narrative agents.
 *
 * These three modules import `server-only` + the pure engine and cannot be
 * imported into a plain Vitest unit. Their `buildUserPrompt` /
 * `buildSystemInstructions` are also unexported. What IS pure, exported and
 * importable — and what each agent actually relies on — is:
 *
 *  1. The Zod OUTPUT schema each `runXxx` validates the LLM response against
 *     (`MiningHealthOutputSchema`, `RiskExplanationOutputSchema`,
 *     `ScenarioNarrativeOutputSchema`). This is the real response-parser: a
 *     malformed LLM payload is rejected here before any assertion runs. We pin
 *     the accept/reject contract with fixtures.
 *  2. The provenance prompt-building helpers (`renderProvenanceLine`,
 *     `isDegradedProvenance`, `provenanceLabel`, `PROVENANCE_SYSTEM_RULE`) that
 *     every agent's `buildUserPrompt` calls verbatim to qualify each cited
 *     number (CLAUDE.md non-negotiable #2).
 *
 * No OpenAI or DB access is touched — everything under test is pure.
 */

describe("MiningHealthOutputSchema (mining-health response parser)", () => {
  const valid = {
    alert_level: "amber" as const,
    summary:
      "Margin at 12% assumes hashprice stays within the current 30d band; uptime 98%.",
    recommendation: "Consider reviewing hosting costs; suggest no rebalance yet.",
  };

  it("parses a well-formed mining-health payload", () => {
    const parsed = MiningHealthOutputSchema.parse(valid);
    expect(parsed.alert_level).toBe("amber");
    expect(parsed.summary).toContain("assumes");
    expect(parsed.recommendation).toMatch(/consider|suggest|review/i);
  });

  it("rejects an unknown alert_level enum value", () => {
    expect(() =>
      MiningHealthOutputSchema.parse({ ...valid, alert_level: "orange" }),
    ).toThrow();
  });

  it("rejects extra keys (strict schema)", () => {
    expect(() =>
      MiningHealthOutputSchema.parse({ ...valid, extra: "nope" }),
    ).toThrow();
  });

  it("rejects an empty summary and an over-long summary", () => {
    expect(() =>
      MiningHealthOutputSchema.parse({ ...valid, summary: "" }),
    ).toThrow();
    expect(() =>
      MiningHealthOutputSchema.parse({ ...valid, summary: "x".repeat(1001) }),
    ).toThrow();
  });

  it("accepts each of the three alert levels", () => {
    for (const level of ["green", "amber", "red"] as const) {
      expect(
        MiningHealthOutputSchema.parse({ ...valid, alert_level: level })
          .alert_level,
      ).toBe(level);
    }
  });
});

describe("RiskExplanationOutputSchema (risk-explanation response parser)", () => {
  const risk = {
    risk_id: "market" as const,
    name: "Market Risk",
    explanation:
      "Under the assumption that BTC stays within its current range, market exposure dominates.",
    suggested_guardrail:
      "Consider trimming directional exposure per Rule RISK-02; review at next cycle.",
  };
  const valid = {
    top_risks: [risk],
    overall_summary:
      "Assuming stable funding, overall posture is elevated but contained.",
  };

  it("parses a well-formed single-risk payload", () => {
    const parsed = RiskExplanationOutputSchema.parse(valid);
    expect(parsed.top_risks).toHaveLength(1);
    expect(parsed.top_risks[0]?.risk_id).toBe("market");
    expect(parsed.overall_summary).toContain("Assuming");
  });

  it("accepts exactly two top_risks", () => {
    const parsed = RiskExplanationOutputSchema.parse({
      ...valid,
      top_risks: [risk, { ...risk, risk_id: "mining", name: "Mining Risk" }],
    });
    expect(parsed.top_risks).toHaveLength(2);
    expect(parsed.top_risks[1]?.risk_id).toBe("mining");
  });

  it("rejects an empty top_risks array (min 1)", () => {
    expect(() =>
      RiskExplanationOutputSchema.parse({ ...valid, top_risks: [] }),
    ).toThrow();
  });

  it("rejects more than two top_risks (max 2)", () => {
    expect(() =>
      RiskExplanationOutputSchema.parse({
        ...valid,
        top_risks: [risk, risk, risk],
      }),
    ).toThrow();
  });

  it("rejects a risk_id outside the 5 canonical dimensions", () => {
    expect(() =>
      RiskExplanationOutputSchema.parse({
        ...valid,
        top_risks: [{ ...risk, risk_id: "weather" }],
      }),
    ).toThrow();
  });

  it("accepts every canonical risk dimension key", () => {
    for (const id of [
      "market",
      "mining",
      "liquidity",
      "smart_contract",
      "counterparty",
    ] as const) {
      const parsed = RiskExplanationOutputSchema.parse({
        ...valid,
        top_risks: [{ ...risk, risk_id: id }],
      });
      expect(parsed.top_risks[0]?.risk_id).toBe(id);
    }
  });

  it("rejects a risk entry missing a required field", () => {
    const { suggested_guardrail: _drop, ...incomplete } = risk;
    void _drop;
    expect(() =>
      RiskExplanationOutputSchema.parse({ ...valid, top_risks: [incomplete] }),
    ).toThrow();
  });
});

describe("ScenarioNarrativeOutputSchema + PtaiSchema (scenario-narrative response parser)", () => {
  const ptai = {
    projection: "Base case projects an APY range of 9.4-12.8%.",
    trigger: "No active rule triggered — holding current posture.",
    action: "Vault maintains 45/55 allocation posture.",
    impact: "Stressed APY 6.4%, risk score unchanged at 42.",
  };
  const valid = {
    narrative_md:
      "Assuming hashprice holds, the base scenario yields a 9.4-12.8% APY range.",
    risk_warning: "Projections are not guaranteed.",
    confidence: "medium" as const,
    key_drivers: ["hashprice stability", "uptime", "funding costs"],
    ptai,
  };

  it("parses a well-formed scenario-narrative payload with PTAI", () => {
    const parsed = ScenarioNarrativeOutputSchema.parse(valid);
    expect(parsed.confidence).toBe("medium");
    expect(parsed.key_drivers).toHaveLength(3);
    expect(parsed.ptai.projection).toContain("9.4-12.8%");
  });

  it("requires the mandatory ptai object (non-negotiable #3)", () => {
    const { ptai: _drop, ...noPtai } = valid;
    void _drop;
    expect(() => ScenarioNarrativeOutputSchema.parse(noPtai)).toThrow();
  });

  it("rejects a ptai object with an empty string field", () => {
    expect(() => PtaiSchema.parse({ ...ptai, trigger: "" })).toThrow();
  });

  it("rejects a ptai field over 500 chars", () => {
    expect(() =>
      PtaiSchema.parse({ ...ptai, action: "x".repeat(501) }),
    ).toThrow();
  });

  it("bounds key_drivers between 1 and 5 items", () => {
    expect(() =>
      ScenarioNarrativeOutputSchema.parse({ ...valid, key_drivers: [] }),
    ).toThrow();
    expect(() =>
      ScenarioNarrativeOutputSchema.parse({
        ...valid,
        key_drivers: ["a", "b", "c", "d", "e", "f"],
      }),
    ).toThrow();
    expect(
      ScenarioNarrativeOutputSchema.parse({ ...valid, key_drivers: ["only"] })
        .key_drivers,
    ).toEqual(["only"]);
  });

  it("rejects an invalid confidence enum value", () => {
    expect(() =>
      ScenarioNarrativeOutputSchema.parse({ ...valid, confidence: "certain" }),
    ).toThrow();
  });

  it("rejects a narrative_md over 2000 chars", () => {
    expect(() =>
      ScenarioNarrativeOutputSchema.parse({
        ...valid,
        narrative_md: "x".repeat(2001),
      }),
    ).toThrow();
  });
});

describe("provenance prompt-building helpers (used verbatim in buildUserPrompt)", () => {
  it("labels every provenance tag with its badge vocabulary", () => {
    expect(provenanceLabel("attested")).toBe("Attested");
    expect(provenanceLabel("live")).toBe("Live");
    expect(provenanceLabel("oracle")).toBe("Oracle");
    expect(provenanceLabel("manual")).toBe("Manual");
    expect(provenanceLabel("estimated")).toBe("Estimated");
    expect(provenanceLabel("stale")).toBe("Stale");
    expect(provenanceLabel("fallback")).toBe("Estimated (fallback)");
    expect(provenanceLabel("pending")).toBe("Pending");
  });

  it("classifies degraded tags that must be flagged in-line", () => {
    for (const tag of [
      "estimated",
      "stale",
      "fallback",
      "manual",
      "pending",
    ] as const) {
      expect(isDegradedProvenance(tag)).toBe(true);
    }
    for (const tag of ["attested", "live", "oracle"] as const) {
      expect(isDegradedProvenance(tag)).toBe(false);
    }
  });

  it("renders a plain provenance line for attested/live/oracle metrics", () => {
    expect(renderProvenanceLine("hashprice_usd_per_th", "live")).toBe(
      "- hashprice_usd_per_th provenance: Live",
    );
    expect(renderProvenanceLine("margin_pct", "attested")).toBe(
      "- margin_pct provenance: Attested",
    );
  });

  it("appends the FLAG marker for degraded metrics so the model cannot miss it", () => {
    const line = renderProvenanceLine("uptime_pct", "estimated");
    expect(line).toContain("Estimated");
    expect(line).toContain("FLAG IN-LINE, do not present as attested");
  });

  it("renders a consistent line for every provenance tag", () => {
    for (const tag of PROVENANCE_TAGS) {
      const line = renderProvenanceLine("metric_x", tag as ProvenanceTag);
      expect(line.startsWith("- metric_x provenance: ")).toBe(true);
      expect(line.includes("FLAG IN-LINE")).toBe(
        isDegradedProvenance(tag as ProvenanceTag),
      );
    }
  });

  it("pins non-negotiable #2 vocabulary into the shared system rule", () => {
    expect(PROVENANCE_SYSTEM_RULE).toContain("non-negotiable #2");
    expect(PROVENANCE_SYSTEM_RULE).toContain(
      "Live / Oracle / Attested / Estimated / Manual / Stale",
    );
    // Degraded data must never be presented as attested/settled fact.
    expect(PROVENANCE_SYSTEM_RULE).toMatch(/flag/i);
    expect(PROVENANCE_SYSTEM_RULE).toContain("Pending");
  });
});
