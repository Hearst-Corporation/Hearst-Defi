/**
 * Proof Center — product hub root contract (regression guard).
 *
 * Locks in the already-shipped de-duplicated state (commits be961c00 / 43aefa84 /
 * a317f2c7, codified in docs/DS_SHELL_CONTRACT.md). The product hub must keep a
 * single product root with ZERO admin grammar and a single page header, so the
 * suspected admin↔user / double-shell / title-vs-eyebrow conflict can never
 * silently reappear.
 *
 * Test-only: the components are NOT refactored, so ProofCenterHub keeps its
 * `variant` API; we render `variant="product"`. renderToStaticMarkup does not
 * emit the RSC flight-payload echo, so the ×2 false positive seen in the live
 * hydrated DOM does not exist here.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProofCenterHub } from "@/components/proof-center/proof-center-hub";
import type { CoverageView } from "@/lib/engine/coverage-view";

import { freshAttestation, zeroReservesCustody } from "./fixtures";

// CoverageView template reused verbatim from ds-patterns.test.tsx.
const liveCoverage: CoverageView = {
  provenance: "live",
  state: "healthy",
  ratio: 1.12,
  period: "2026-05",
  lastUpdated: "2026-05-31",
  netMiningCashUsd: 1_000_000,
  targetDistributionUsdc: 900_000,
  vaultRef: "hearst-yield-vault",
  missingInputs: [],
  summary: "Coverage healthy.",
  healthy: true,
  recommendation: {
    action: "normal",
    maxPayout: 1,
    reason: "test",
    lpExplanation: "test",
    badge: "live",
    state: "healthy",
  },
};

const occ = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

function expectNoAdminGrammar(html: string): void {
  expect(html).not.toContain("admin-doc");
  expect(html).not.toContain("admin-page-header");
  expect(html).not.toContain("section-nav");
  expect(html).toContain("product-doc");
}

describe("Proof Center — product hub root contract", () => {
  it("cold: single product root, investor CTA, zero admin grammar", () => {
    const html = renderToStaticMarkup(
      <ProofCenterHub
        variant="product"
        chainConfigured
        latestAttestation={null}
        attestationVerified={false}
        custody={zeroReservesCustody()}
        coverage={liveCoverage}
        recentDistributions={[]}
        recentRebalances={[]}
        platformAddresses={[]}
        coldEmpty
        demo={false}
      />,
    );

    expectNoAdminGrammar(html);
    expect(html).toContain("product-doc-stack");
    expect(html).toContain("proof-center-cold-shell");
    // "Explore products" CTA is product-cold only.
    expect(html).toContain("Explore products");
    // Exactly one page header.
    expect(occ(html, "<h1")).toBe(1);
  });

  it("populated: single h1, product cockpit, no double title, zero admin grammar", () => {
    const html = renderToStaticMarkup(
      <ProofCenterHub
        variant="product"
        chainConfigured
        latestAttestation={freshAttestation()}
        attestationVerified
        custody={zeroReservesCustody()}
        coverage={liveCoverage}
        recentDistributions={[]}
        recentRebalances={[]}
        platformAddresses={[]}
        coldEmpty={false}
        demo={false}
      />,
    );

    expectNoAdminGrammar(html);
    expect(html).toContain("proof-cockpit");
    expect(occ(html, "<h1")).toBe(1);
    // No cold CTA once populated.
    expect(html).not.toContain("Explore products");
    // `bare` suppresses the inner PorSummary eyebrow, so the label appears only
    // as the card title — proving no title-vs-eyebrow duplication.
    expect(occ(html, "Proof of Reserves")).toBe(1);
  });
});
