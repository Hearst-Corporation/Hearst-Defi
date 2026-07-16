import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WiredChip } from "@/components/catalyst/wired-chip";
import { WiredValue } from "@/components/catalyst/wired-value";

// Le repo teste les composants via `renderToStaticMarkup` (vitest env = node,
// pas de @testing-library/react installé) — cf. por-summary-truth.test.tsx.

const BLUE_TOKENS = ["text-info", "--ct-status-info"] as const;

function expectNoBlue(html: string): void {
  for (const token of BLUE_TOKENS) {
    expect(html).not.toContain(token);
  }
}

describe("WiredChip — libellés des 3 états", () => {
  it("wired (défaut v2) → « Wired v2 » + point bleu", () => {
    const html = renderToStaticMarkup(<WiredChip state="wired" />);
    expect(html).toContain("Wired v2");
    expect(html).toContain("text-info");
    expect(html).toContain('aria-label="Data source: Wired v2"');
  });

  it("wired + source=legacy → « Wired (legacy) », pas « Wired v2 »", () => {
    const html = renderToStaticMarkup(
      <WiredChip state="wired" source="legacy" />,
    );
    expect(html).toContain("Wired (legacy)");
    expect(html).not.toContain("Wired v2");
  });

  it("pending → « Pending deployment », bleu atténué", () => {
    const html = renderToStaticMarkup(<WiredChip state="pending" />);
    expect(html).toContain("Pending deployment");
    expect(html).toContain("text-info");
    expect(html).toContain("opacity-[var(--ct-opacity-60)]");
  });

  it("unavailable → libellé dérivé du motif", () => {
    const html = renderToStaticMarkup(
      <WiredChip state="unavailable" reason="not_deployed" />,
    );
    expect(html).toContain("Contract not deployed");
  });
});

describe("WiredChip — unavailable n'est JAMAIS bleu", () => {
  it.each([
    "not_deployed",
    "not_supported_by_legacy",
    "rpc_error",
    "revert",
  ])("reason=%s ne rend aucun ton bleu", (reason) => {
    const html = renderToStaticMarkup(
      <WiredChip state="unavailable" reason={reason} />,
    );
    expectNoBlue(html);
    expect(html).toContain("var(--ct-text-faint)");
  });

  it("un motif absent reste honnête (pas de bleu, pas de faux libellé)", () => {
    const html = renderToStaticMarkup(<WiredChip state="unavailable" />);
    expectNoBlue(html);
    expect(html).toContain("Data unavailable");
  });

  it("un motif inconnu ne se déguise pas en motif connu", () => {
    const html = renderToStaticMarkup(
      <WiredChip state="unavailable" reason="totally_unknown" />,
    );
    expect(html).toContain("Unknown reason");
    expect(html).not.toContain("Contract not deployed");
    expect(html).not.toContain("Read unavailable");
    expectNoBlue(html);
  });

  it("un motif inconnu reste en anglais institutionnel, y compris dans le motif brut (title/tooltip)", () => {
    const html = renderToStaticMarkup(
      <WiredChip state="unavailable" reason="totally_unknown" />,
    );
    expect(html).toContain("Raw reason: totally_unknown");
    expect(html).not.toContain("Motif brut");
  });
});

describe("WiredChip — une panne RPC est DISCERNABLE d'une absence de donnée", () => {
  it("rpc_error et not_deployed ne portent pas le même libellé", () => {
    const rpc = renderToStaticMarkup(
      <WiredChip state="unavailable" reason="rpc_error" />,
    );
    const notDeployed = renderToStaticMarkup(
      <WiredChip state="unavailable" reason="not_deployed" />,
    );

    expect(rpc).toContain("Read unavailable");
    expect(rpc).not.toContain("Contract not deployed");

    expect(notDeployed).toContain("Contract not deployed");
    expect(notDeployed).not.toContain("Read unavailable");

    expect(rpc).not.toEqual(notDeployed);
  });

  it("revert et not_supported_by_legacy sont eux aussi distincts", () => {
    const revert = renderToStaticMarkup(
      <WiredChip state="unavailable" reason="revert" />,
    );
    const unsupported = renderToStaticMarkup(
      <WiredChip state="unavailable" reason="not_supported_by_legacy" />,
    );
    expect(revert).toContain("Rejected by contract");
    expect(unsupported).toContain("Not supported");
    expect(revert).not.toEqual(unsupported);
  });
});

describe("WiredValue", () => {
  it("status=wired → valeur en bleu + chip « Wired v2 »", () => {
    const html = renderToStaticMarkup(
      <WiredValue
        wired={{ status: "wired", value: 12, source: "v2" }}
        render={(v) => <span className="stat-value">{v} USDC</span>}
        label="Total assets"
      />,
    );
    expect(html).toContain("12 USDC");
    expect(html).toContain("text-info");
    expect(html).toContain("Wired v2");
    expect(html).toContain("Total assets");
  });

  it("status=unavailable → em-dash, jamais 0 ni N/A, jamais de valeur de repli", () => {
    const html = renderToStaticMarkup(
      <WiredValue<number>
        wired={{ status: "unavailable", reason: "rpc_error" }}
        render={(v) => <span>{v} USDC</span>}
        label="Total assets"
      />,
    );
    expect(html).toContain("—");
    expect(html).toContain("Read unavailable");
    expect(html).not.toContain("USDC");
    expect(html).not.toContain("N/A");
    expectNoBlue(html);
  });

  it("status=unavailable n'appelle jamais `render`", () => {
    let called = false;
    renderToStaticMarkup(
      <WiredValue<number>
        wired={{ status: "unavailable", reason: "not_deployed" }}
        render={(v) => {
          called = true;
          return <span>{v}</span>;
        }}
      />,
    );
    expect(called).toBe(false);
  });
});
