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
  it("wired (défaut v2) → « Branché v2 » + point bleu", () => {
    const html = renderToStaticMarkup(<WiredChip state="wired" />);
    expect(html).toContain("Branché v2");
    expect(html).toContain("text-info");
    expect(html).toContain('aria-label="Source de données : Branché v2"');
  });

  it("wired + source=legacy → « Branché (legacy) », pas « Branché v2 »", () => {
    const html = renderToStaticMarkup(
      <WiredChip state="wired" source="legacy" />,
    );
    expect(html).toContain("Branché (legacy)");
    expect(html).not.toContain("Branché v2");
  });

  it("pending → « En attente de déploiement », bleu atténué", () => {
    const html = renderToStaticMarkup(<WiredChip state="pending" />);
    expect(html).toContain("En attente de déploiement");
    expect(html).toContain("text-info");
    expect(html).toContain("opacity-[var(--ct-opacity-60)]");
  });

  it("unavailable → libellé dérivé du motif", () => {
    const html = renderToStaticMarkup(
      <WiredChip state="unavailable" reason="not_deployed" />,
    );
    expect(html).toContain("Contrat non déployé");
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
    expect(html).toContain("Donnée indisponible");
  });

  it("un motif inconnu ne se déguise pas en motif connu", () => {
    const html = renderToStaticMarkup(
      <WiredChip state="unavailable" reason="totally_unknown" />,
    );
    expect(html).toContain("Motif inconnu");
    expect(html).not.toContain("Contrat non déployé");
    expect(html).not.toContain("Lecture chaîne indisponible");
    expectNoBlue(html);
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

    expect(rpc).toContain("Lecture chaîne indisponible");
    expect(rpc).not.toContain("Contrat non déployé");

    expect(notDeployed).toContain("Contrat non déployé");
    expect(notDeployed).not.toContain("Lecture chaîne indisponible");

    expect(rpc).not.toEqual(notDeployed);
  });

  it("revert et not_supported_by_legacy sont eux aussi distincts", () => {
    const revert = renderToStaticMarkup(
      <WiredChip state="unavailable" reason="revert" />,
    );
    const unsupported = renderToStaticMarkup(
      <WiredChip state="unavailable" reason="not_supported_by_legacy" />,
    );
    expect(revert).toContain("Rejeté par le contrat");
    expect(unsupported).toContain("Non supporté par le contrat actuel");
    expect(revert).not.toEqual(unsupported);
  });
});

describe("WiredValue", () => {
  it("status=wired → valeur en bleu + chip « Branché v2 »", () => {
    const html = renderToStaticMarkup(
      <WiredValue
        wired={{ status: "wired", value: 12, source: "v2" }}
        render={(v) => <span className="stat-value">{v} USDC</span>}
        label="Total assets"
      />,
    );
    expect(html).toContain("12 USDC");
    expect(html).toContain("text-info");
    expect(html).toContain("Branché v2");
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
    expect(html).toContain("Lecture chaîne indisponible");
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
