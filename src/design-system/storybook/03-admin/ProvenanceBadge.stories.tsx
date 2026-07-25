// 03-admin — ProvenanceBadge : UNE sémantique, DEUX chromes.
// Le vocabulaire (8 kinds, labels, descriptions) vit dans src/lib/provenance.ts ;
// deux primitives le rendent :
//   - chrome catalyst  (src/components/catalyst/provenance-badge) — investisseur
//     (/proof-center), pill BentoBadge + Tooltip, live = SEUL kind sur l'accent ;
//   - chrome ui/badge  (src/ui/badge ProvenanceBadge) — vues admin, chip sobre,
//     simulated = outline + `title` sandbox natif.
// Le contrat croisé est verrouillé par src/ui/__tests__/provenance-contract.test.ts
// (jamais de rouge, jamais un deuxième vert). Cette story les met CÔTE À CÔTE
// pour verrouiller visuellement la correspondance.
//
// ⚠ Divergence preview CONNUE et ASSUMÉE (lot ultérieur) : le preview charge le
// CSS d'ARCHIVE (tokens-layer/globals/cockpit), pas app.css. Le chrome catalyst
// (tokens --ct-*) rend fidèlement ; côté ui/badge, `text-accent` existe
// (globals.css) mais `bg-surface-raised` / `text-muted` / `text-foreground` /
// `bg-accent-muted` vivent dans le monde greenfield (src/styles/theme.css) →
// le chip admin rend ici avec fond/texte hérités (plus clairs qu'au runtime).
// Sémantique, labels et attributs inchangés. NE PAS importer app.css ici
// (bleed sur les stories calibrées).

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the two real chromes + the canonical vocabulary, imported as-is.
import { ProvenanceBadge as CatalystProvenanceBadge } from "@/components/catalyst/provenance-badge";
import {
  PROVENANCE_DESCRIPTIONS,
  PROVENANCE_KINDS,
} from "@/lib/provenance";
import { ProvenanceBadge as AdminProvenanceBadge } from "@/ui/badge";

const meta: Meta<typeof CatalystProvenanceBadge> = {
  title: "03-admin/ProvenanceBadge",
  component: CatalystProvenanceBadge,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof CatalystProvenanceBadge>;

// ── Les 8 kinds, deux chromes côte à côte ────────────────────────────────────

export const TwoChromesSideBySide: Story = {
  render: () => (
    <div className="grid w-fit grid-cols-[8rem_auto_auto] items-center gap-x-8 gap-y-3">
      <span className="text-xs text-[var(--ct-text-muted)]">kind</span>
      <span className="text-xs text-[var(--ct-text-muted)]">
        catalyst chrome (investor)
      </span>
      <span className="text-xs text-[var(--ct-text-muted)]">
        ui/badge chrome (admin)
      </span>
      {PROVENANCE_KINDS.map((kind) => (
        <div key={kind} className="contents">
          <code className="font-mono text-xs text-[var(--ct-text-strong)]">
            {kind}
          </code>
          <span>
            <CatalystProvenanceBadge kind={kind} />
          </span>
          <span>
            <AdminProvenanceBadge source={kind} />
          </span>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    // 8 kinds × 2 chromes — chaque label rendu deux fois (Live, Oracle, …).
    await expect(canvas.getAllByText("Live")).toHaveLength(2);
    await expect(canvas.getAllByText("Simulated")).toHaveLength(2);
    // Le chrome catalyst expose l'aria-label canonique (role=status).
    const status = canvasElement.querySelectorAll(
      '[aria-label^="Data provenance:"]',
    );
    await expect(status).toHaveLength(8);
  },
};

// ── simulated : le marqueur sandbox ──────────────────────────────────────────
// Côté admin, `simulated` porte la description sandbox en `title` NATIF — une
// ligne de démo ne peut jamais passer pour une ligne de production. Côté
// catalyst, même description en tooltip + aria-label. Ni l'un ni l'autre n'est
// une alarme : chrome neutre/outline, jamais une couleur d'erreur.

export const SimulatedSandboxTitle: Story = {
  render: () => (
    <div className="flex items-center gap-6">
      <CatalystProvenanceBadge kind="simulated" />
      <AdminProvenanceBadge source="simulated" />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getAllByText("Simulated")).toHaveLength(2);
    // ui/badge : title sandbox natif, exactement la description canonique.
    const titled = canvasElement.querySelector(
      `[title="${PROVENANCE_DESCRIPTIONS.simulated}"]`,
    );
    await expect(titled).not.toBeNull();
    // catalyst : aria-label canonique.
    await expect(
      canvasElement.querySelector('[aria-label="Data provenance: Simulated"]'),
    ).not.toBeNull();
  },
};
