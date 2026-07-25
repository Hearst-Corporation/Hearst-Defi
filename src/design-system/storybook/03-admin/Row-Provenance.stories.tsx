// 03-admin — Row du bridge (src/views/_shared/layout) : nu · provenance · tone.
// Le bridge ne définit AUCUN vocabulaire visuel propre — il rend le canon admin
// (doctrine « délégation, jamais swap »). Contrat clé de Row : provenance et
// tone ABSENTS ⇒ markup historique STRICTEMENT identique (au pixel) — la story
// « Bare » le verrouille.
//
// Tones : nuances grises + accent UNIQUEMENT, jamais de rouge — `alert`
// s'exprime par texte fort + préfixe « ! » (+ sr-only "Alert:"), pas par une
// couleur d'erreur (doctrine « zéro rouge »).
//
// ⚠ Divergence preview CONNUE et ASSUMÉE (lot ultérieur) : le preview charge le
// CSS d'ARCHIVE (tokens-layer/globals/cockpit), pas app.css. Row n'utilise que
// des tokens --ct-* (fidèle ici) ; le badge de provenance est le chrome
// ui/badge dont le fond/texte greenfield rend hérité (voir
// ProvenanceBadge.stories.tsx). NE PAS importer app.css ici (bleed sur les
// stories calibrées).
//
// Honnêteté : chaque ligne est étiquetée « (specimen) » et la figure chiffrée
// porte un badge `simulated`.

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the real bridge primitives, imported as-is.
import { Row, RowList } from "@/views/_shared/layout";

const meta: Meta<typeof Row> = {
  title: "03-admin/Row-Provenance",
  component: Row,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Row>;

/** Specimen card backdrop — rows live inside a welded card body at runtime. */
function CardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card">
      {children}
    </div>
  );
}

// ── Nu : le défaut est INCHANGÉ ──────────────────────────────────────────────
// Sans provenance ni tone, Row rend le markup historique : pas de pastille,
// pas de badge, valeur en <p> simple.

export const Bare: Story = {
  render: () => (
    <CardFrame>
      <RowList>
        <Row
          label="BTC reserve (specimen)"
          value="0.01520000 BTC"
          hint="Specimen row — simulated figure, Storybook only"
        />
        <Row label="Network (specimen)" value="Base Sepolia" />
      </RowList>
    </CardFrame>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("0.01520000 BTC")).toBeVisible();
    // Défaut inchangé : AUCUNE pastille de tone (span aria-hidden) et AUCUN
    // badge de provenance dans le rendu historique.
    await expect(
      canvasElement.querySelectorAll("span[aria-hidden]"),
    ).toHaveLength(0);
    await expect(canvas.queryByText("Simulated")).toBeNull();
  },
};

// ── Avec provenance ──────────────────────────────────────────────────────────
// Le badge (chrome ui/badge, canon admin) se rend À CÔTÉ de la valeur.

export const WithProvenance: Story = {
  render: () => (
    <CardFrame>
      <RowList>
        <Row
          label="BTC reserve (specimen)"
          value="0.01520000 BTC"
          hint="Specimen row — figure carries its simulated badge"
          provenance="simulated"
        />
        <Row
          label="Operator note (specimen)"
          value="Entered by hand"
          provenance="manual"
        />
      </RowList>
    </CardFrame>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Simulated")).toBeVisible();
    await expect(canvas.getByText("Manual")).toBeVisible();
  },
};

// ── Avec tone : ok / watch / alert / idle ────────────────────────────────────
// Pastille grise/accent (aria-hidden) ; `alert` ajoute le préfixe « ! » et un
// sr-only "Alert:" — l'information ne repose pas que sur la couleur pour ce
// cas-là (voir SIGNALEMENT rapport pour ok/watch/idle).

export const WithTones: Story = {
  render: () => (
    <CardFrame>
      <RowList>
        <Row
          label="Keeper heartbeat (specimen)"
          value="Nominal"
          tone="ok"
        />
        <Row
          label="RPC latency (specimen)"
          value="Elevated"
          tone="watch"
        />
        <Row
          label="Report overdue (specimen)"
          value="3 days"
          hint="Specimen duration — simulated"
          tone="alert"
        />
        <Row label="Backfill job (specimen)" value="Idle" tone="idle" />
      </RowList>
    </CardFrame>
  ),
  play: async ({ canvas, canvasElement }) => {
    // 4 pastilles de tone (une par ligne), toutes décoratives (aria-hidden).
    const dots = canvasElement.querySelectorAll(
      "span[aria-hidden].rounded-full",
    );
    await expect(dots).toHaveLength(4);
    // alert : préfixe sr-only lisible par les lecteurs d'écran.
    await expect(canvas.getByText("Alert:")).toBeInTheDocument();
    // Zéro rouge : la pastille alert est GRISE (text-strong), pas danger.
    const html = canvasElement.innerHTML;
    await expect(html.includes("--ct-status-danger")).toBe(false);
    await expect(/\btext-red-|\bbg-red-|\bborder-red-/.test(html)).toBe(false);
  },
};

// ── Tone + provenance combinés ───────────────────────────────────────────────

export const ToneAndProvenance: Story = {
  render: () => (
    <CardFrame>
      <RowList>
        <Row
          label="Reserve check (specimen)"
          value="Consistent"
          tone="ok"
          provenance="simulated"
        />
      </RowList>
    </CardFrame>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("Consistent")).toBeVisible();
    await expect(canvas.getByText("Simulated")).toBeVisible();
    await expect(
      canvasElement.querySelectorAll("span[aria-hidden].rounded-full"),
    ).toHaveLength(1);
  },
};
