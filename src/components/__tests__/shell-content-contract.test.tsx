// Shell/content contract — Design Studio Phase 2.
//
// The rule: the PARENT controls the surface (coque: border, radius, fill,
// shadow, scroll); the CHILD controls the content. A component offered in
// `embedded` variant must ship ZERO surface of its own; its `fullSurface`
// default must ship exactly ONE coque, and never a parasitic internal
// scroll container (max-h / overflow-y-auto inside content).
//
// DOM proofs via renderToStaticMarkup — same technique as the existing
// series1-proof-event-stepper tests.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Series1ProofEventStepper } from "@/components/proof-center/series1-proof-event-stepper";
import { Series1ChartPlaceholder } from "@/components/series1-shell/Series1ChartPlaceholder";
import { Series1Panel } from "@/components/series1-shell/Series1Panel";
import type { Series1ProofStepperState } from "@/lib/proof-center/series1-event-stepper";

const LIVE: Series1ProofStepperState = { envelopeStatus: "empty", events: [] };

/** Count self-owned coques: bordered + rounded shells in the markup. */
function countCoques(html: string): number {
  return (html.match(/rounded-\(--ct-radius-xl\)/g) ?? []).length;
}

function hasParasiticScroll(html: string): boolean {
  return /overflow-y-auto|max-h-\[/.test(html);
}

describe("shell/content contract — Series1ProofEventStepper", () => {
  it("fullSurface (default) ships exactly one coque and no internal scroll", () => {
    const html = renderToStaticMarkup(<Series1ProofEventStepper state={LIVE} />);
    expect(countCoques(html)).toBe(1);
    expect(hasParasiticScroll(html)).toBe(false);
  });

  it("embedded ships zero surface — the parent owns the coque", () => {
    const embedded = renderToStaticMarkup(
      <Series1ProofEventStepper state={LIVE} variant="embedded" />,
    );
    expect(countCoques(embedded)).toBe(0);
    expect(embedded).not.toContain("border-(--ct-border-soft)");
    // No duplicated component-owned header when embedded.
    expect(embedded).not.toContain("Proof event stepper");

    const composed = renderToStaticMarkup(
      <Series1Panel>
        <Series1ProofEventStepper state={LIVE} variant="embedded" />
      </Series1Panel>,
    );
    expect(countCoques(composed)).toBe(1);
  });
});

describe("shell/content contract — Series1ChartPlaceholder", () => {
  const args = {
    title: "Reserve trajectory",
    label: "No series yet",
    detail: "Waiting for the ledger.",
  };

  it("fullSurface (default) ships exactly one coque", () => {
    const html = renderToStaticMarkup(<Series1ChartPlaceholder {...args} />);
    expect(countCoques(html)).toBe(1);
  });

  it("embedded ships zero frame — a parent panel composes without double coque", () => {
    const embedded = renderToStaticMarkup(
      <Series1ChartPlaceholder {...args} variant="embedded" />,
    );
    expect(countCoques(embedded)).toBe(0);

    const composed = renderToStaticMarkup(
      <Series1Panel>
        <Series1ChartPlaceholder {...args} variant="embedded" />
      </Series1Panel>,
    );
    expect(countCoques(composed)).toBe(1);
  });
});

describe("shell/content contract — VaultChainReadout (source contract)", () => {
  // Async server component (awaits an RPC read) — proved at source level:
  // the divergent coque grammar (rounded-2xl + shadow + raw border var) is
  // gone, the variant switch exists, and `embedded` drops the surface.
  it("no divergent coque grammar; embedded variant present", async () => {
    const fs = await import("node:fs/promises");
    const source = await fs.readFile(
      new URL("../vaults/vault-chain-readout.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toContain("rounded-2xl");
    expect(source).not.toContain("shadow-[var(--ct-shadow-soft)]");
    expect(source).toContain('variant?: "fullSurface" | "embedded"');
    expect(source).toContain('variant === "embedded"');
    // fullSurface aligns on the host page's KycPanel grammar.
    expect(source).toContain("rounded-xl border border-(--ct-border-soft) bg-(--ct-surface-card)");
  });
});
