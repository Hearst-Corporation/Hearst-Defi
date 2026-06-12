import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PorSummary } from "@/components/proof-center/por-summary";

import { freshAttestation, zeroReservesCustody } from "./fixtures";

const ATTESTED_BADGE = ">Attested</span>";
const STALE_BADGE = ">Stale</span>";

function headerProvenanceBadge(html: string): string {
  const headerEnd = html.indexOf("ct-nested-kpi-grid");
  return headerEnd === -1 ? html : html.slice(0, headerEnd);
}

describe("PorSummary — Attested requires verification (A4)", () => {
  it("shows Stale (not Attested) for a fresh but UNVERIFIED attestation", () => {
    const html = renderToStaticMarkup(
      <PorSummary attestation={freshAttestation()} verified={false} />,
    );
    const header = headerProvenanceBadge(html);
    expect(header).toContain(STALE_BADGE);
    expect(header).not.toContain(ATTESTED_BADGE);
    expect(html).toContain("not yet verified against the allowlist");
  });

  it("defaults to Stale when the verified flag is omitted (fail-closed)", () => {
    const html = renderToStaticMarkup(<PorSummary attestation={freshAttestation()} />);
    const header = headerProvenanceBadge(html);
    expect(header).toContain(STALE_BADGE);
    expect(header).not.toContain(ATTESTED_BADGE);
  });

  it("shows Attested only when fresh AND verified", () => {
    const html = renderToStaticMarkup(
      <PorSummary attestation={freshAttestation()} verified />,
    );
    const header = headerProvenanceBadge(html);
    expect(header).toContain(ATTESTED_BADGE);
    expect(header).not.toContain(STALE_BADGE);
  });
});

describe("PorSummary — zero custody reserves", () => {
  it("does not render active CustodyCard with $0 and Stale when reserves are zero", () => {
    const html = renderToStaticMarkup(
      <PorSummary attestation={null} custody={zeroReservesCustody()} />,
    );
    expect(html).toContain("ct-empty-surface--widget");
    expect(html).toContain(
      "Custody reserves will appear after the first verified Fireblocks snapshot.",
    );
    expect(html).not.toMatch(/Custody \(Fireblocks\)<\/h3>/);
    expect(html).not.toContain("$0");
    expect(html).not.toContain(STALE_BADGE);
  });
});
