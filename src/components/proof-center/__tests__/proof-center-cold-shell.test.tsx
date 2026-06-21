import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProofCenterColdShell } from "@/components/proof-center/proof-center-cold-shell";

describe("ProofCenterColdShell", () => {
  it("renders CTA and unlock list without ghost metrics", () => {
    const html = renderToStaticMarkup(<ProofCenterColdShell chainConfigured />);
    expect(html).toContain("proof-center-cold-shell");
    expect(html).toContain("Explore products");
    expect(html).toContain("Proof of Reserves");
    expect(html).not.toContain("ct-nested-kpi-grid");
    expect(html).not.toContain('value="—"');
  });
});
