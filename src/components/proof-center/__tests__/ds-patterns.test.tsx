/**
 * Proof Center DS patterns — ProofRow, provenance headers, responsive shell hooks.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ContractsAuditTrail } from "@/components/proof-center/contracts-audit-trail";
import { EventTimeline } from "@/components/proof-center/event-timeline";
import { MiningCashFlowEvidence } from "@/components/proof-center/mining-cashflow-evidence";

import { freshEvent } from "./fixtures";

describe("Proof Center — DS patterns", () => {
  it("EventTimeline: active events render labelled meta rows (bento) with live provenance", () => {
    const html = renderToStaticMarkup(<EventTimeline events={[freshEvent()]} />);
    // Bento meta rows (Portfolio canon) instead of the legacy ct-proof-row DS.
    expect(html).not.toContain("ct-proof-row");
    expect(html).toContain("Timestamp");
    expect(html).toContain(">Live</span>");
  });

  it("ContractsAuditTrail: audit review panel carries manual provenance", () => {
    const html = renderToStaticMarkup(<ContractsAuditTrail />);
    const auditHeaderIdx = html.indexOf("Review status");
    expect(auditHeaderIdx).toBeGreaterThan(-1);
    const auditSection = html.slice(auditHeaderIdx, auditHeaderIdx + 600);
    expect(auditSection).toContain(">Manual</span>");
  });

  it("MiningCashFlowEvidence: live coverage renders panel provenance + nested KPI grid", () => {
    const html = renderToStaticMarkup(
      <MiningCashFlowEvidence
        coverage={{
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
        }}
      />,
    );
    // Bento KPI grid (Portfolio canon) carries the live provenance + coverage value.
    expect(html).toContain("bg-surface-inset");
    expect(html).toContain(">Live</span>");
    expect(html).toContain("1.12×");
  });
});
