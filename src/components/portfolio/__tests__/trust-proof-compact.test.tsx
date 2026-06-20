import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  TrustProofCompact,
  deriveTrustSummaryKpis,
} from "@/components/portfolio/trust-panel";

const BASE_RISK = {
  scores: [
    { dimension: "market" as const, score: 42, delta30d: 0 },
    { dimension: "mining" as const, score: 38, delta30d: 0 },
    { dimension: "liquidity" as const, score: 35, delta30d: 0 },
    { dimension: "smart_contract" as const, score: 40, delta30d: 0 },
    { dimension: "counterparty" as const, score: 36, delta30d: 0 },
  ],
  composite: 38,
  compositeLabel: "Low–Moderate" as const,
  composite30dTrend: "stable" as const,
};

const BASE_PROOF = {
  lastPor: {
    timestamp: new Date("2026-05-01T12:00:00Z"),
    statedTvlUsdc: 1_000_000,
    onChainTvlUsdc: 1_000_000,
  },
  methodologyVersion: "v1.0",
  methodologyLocked: true,
  nextAttestation: null,
  auditor: "",
};

describe("TrustProofCompact", () => {
  it("renders KPI headers and a live proof-center link in the header (no dead placeholder)", () => {
    const html = renderToStaticMarkup(
      <TrustProofCompact risk={BASE_RISK} proof={BASE_PROOF} />,
    );
    expect(html).toContain("Trust &amp; Proof");
    expect(html).toContain("Risk composite");
    expect(html).toContain("Proof status");
    expect(html).toContain("pf-trust-compact-kpis");
    expect(html).toContain('href="/proof-center"');
    expect(html).toContain("Proof center");
    expect(html).toContain("pf-panel-leaf-link");
    expect(html).not.toContain("disabled");
    expect(html).not.toContain("Security audit");
    expect(html).not.toContain("pf-trust-compact__see-more");
  });

  it("default hub (no leaf route): header links to the proof center, not a dead button", () => {
    const html = renderToStaticMarkup(
      <TrustProofCompact risk={BASE_RISK} proof={BASE_PROOF} />,
    );
    expect(html).toContain('href="/proof-center"');
    expect(html).not.toContain("disabled");
    expect(html).not.toContain('href="/portfolio/activity"');
  });

  it("optional leafHref: renders View full when explicitly wired", () => {
    const html = renderToStaticMarkup(
      <TrustProofCompact
        risk={BASE_RISK}
        proof={BASE_PROOF}
        leafHref="/portfolio/activity"
      />,
    );
    expect(html).toContain('href="/portfolio/activity"');
    expect(html).toContain("pf-panel-leaf-link__label");
    expect(html).toContain("pf-panel-leaf-link__arrow");
    expect(html).toContain("View full");
    expect(html).not.toContain("disabled");
  });

  it("no real data: KPI values show '—' (honest placeholder, no fabricated composite)", () => {
    const kpis = deriveTrustSummaryKpis({
      risk: {
        ...BASE_RISK,
        composite: 0,
        compositeLabel: undefined,
        scores: BASE_RISK.scores.map((s) => ({ ...s, score: 0 })),
      },
      proof: {
        ...BASE_PROOF,
        lastPor: {
          timestamp: new Date("2026-05-01T12:00:00Z"),
          statedTvlUsdc: 0,
          onChainTvlUsdc: 0,
        },
      },
    });
    expect(kpis.compositeValue).toBe("—");
    expect(kpis.proofValue).toBe("—");
  });
});
