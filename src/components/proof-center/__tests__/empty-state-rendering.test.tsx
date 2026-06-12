/**
 * Proof Center empty-state rendering — structural contract (DS §9).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EventTimeline } from "@/components/proof-center/event-timeline";
import { PorSummary } from "@/components/proof-center/por-summary";

import { freshAttestation, zeroReservesCustody } from "./fixtures";

function assertModuleEmptyContract(html: string, message: string): void {
  expect(html).toContain(message);
  expect(html).toContain("ct-empty-surface--widget");
  expect(html).not.toContain("glass-panel");
  expect(html).not.toContain("ct-system-panel");
  expect(html).not.toContain("border-dashed");
  expect(html).not.toContain("Stale");
}

describe("Proof Center empty states — design contract", () => {
  it("PorSummary: no attestation → widget empty, no active card shell", () => {
    const html = renderToStaticMarkup(<PorSummary attestation={null} />);
    assertModuleEmptyContract(
      html,
      "No on-chain Proof of Reserves attestation yet.",
    );
  });

  it("EventTimeline: no events → widget empty, no active card shell", () => {
    const html = renderToStaticMarkup(<EventTimeline events={[]} />);
    assertModuleEmptyContract(html, "No on-chain events yet.");
  });

  it("PorSummary: nested custody empty uses inline variant inside active card", () => {
    const html = renderToStaticMarkup(
      <PorSummary attestation={freshAttestation()} custody={zeroReservesCustody()} />,
    );
    expect(html).toContain("glass-panel");
    expect(html).toContain("ct-empty-surface--inline");
    expect(html).toContain(
      "Custody reserves will appear after the first verified Fireblocks snapshot.",
    );
    expect(html).not.toContain("ct-empty-surface--widget");
  });
});
