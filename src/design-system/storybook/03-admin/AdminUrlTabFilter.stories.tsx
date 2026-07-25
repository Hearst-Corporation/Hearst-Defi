// 03-admin — AdminUrlTabFilter : tabs de filtre pilotés par l'URL.
// LE sujet ici est le contrat ARIA : role=tablist nommé par `ariaLabel`
// (OBLIGATOIRE — pas de story sans ariaLabel), chaque onglet role=tab avec
// aria-selected. Server component : navigation par href, zéro état client.
//
// Contrat `count` (honnêteté) : fournir un count SEULEMENT quand le nombre est
// réellement connu — un zéro DISPONIBLE s'affiche « (0) » ; un count
// indisponible s'OMET (pas de 0 fabriqué). Les counts ci-dessous sont des
// specimens de structure, pas des mesures réelles.
//
// ⚠ Divergence preview CONNUE et ASSUMÉE (lot ultérieur) : le preview charge le
// CSS d'ARCHIVE (tokens-layer/globals/cockpit), pas app.css. Le focus ring
// global `:focus-visible` vit dans src/styles/app.css (@layer base) → absent
// ici ; les chips (tokens --ct-*) rendent correctement. NE PAS importer
// app.css ici (bleed sur les stories calibrées).

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, within } from "storybook/test";

// Zero-copy: the real admin canon primitive, imported as-is.
import { AdminUrlTabFilter } from "@/components/admin/admin-url-tab-filter";

const meta: Meta<typeof AdminUrlTabFilter> = {
  title: "03-admin/AdminUrlTabFilter",
  component: AdminUrlTabFilter,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof AdminUrlTabFilter>;

// Specimen tabs — « Paused » porte un zéro CONNU (affiché « (0) ») ;
// « Archived » omet `count` : nombre indisponible, on n'invente pas.
const SPECIMEN_TABS = [
  { key: "all", label: "All", href: "?status=all", count: 12 },
  { key: "active", label: "Active", href: "?status=active", count: 8 },
  { key: "paused", label: "Paused", href: "?status=paused", count: 0 },
  { key: "archived", label: "Archived", href: "?status=archived" },
] as const;

export const WithCounts: Story = {
  args: {
    tabs: SPECIMEN_TABS,
    activeKey: "all",
    ariaLabel: "Specimen status filter",
  },
  play: async ({ canvas }) => {
    // Contrat ARIA : le tablist est NOMMÉ par ariaLabel.
    const tablist = canvas.getByRole("tablist", {
      name: "Specimen status filter",
    });
    const tabs = within(tablist).getAllByRole("tab");
    await expect(tabs).toHaveLength(4);
    // Un seul onglet sélectionné, c'est l'activeKey.
    await expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    await expect(tabs[1]).toHaveAttribute("aria-selected", "false");
    // Le zéro CONNU s'affiche — jamais masqué, jamais fabriqué.
    await expect(within(tablist).getByText("(0)")).toBeVisible();
    // Le count indisponible est OMIS : « Archived » ne rend pas de parenthèses.
    await expect(tabs[3]?.textContent).toBe("Archived");
  },
};

// Un onglet à zéro peut être l'onglet ACTIF — la chip accent rend son « (0) »
// en tabular-nums comme les autres.
export const ActiveZeroCountTab: Story = {
  args: {
    tabs: SPECIMEN_TABS,
    activeKey: "paused",
    ariaLabel: "Specimen status filter",
  },
  play: async ({ canvas }) => {
    const tablist = canvas.getByRole("tablist", {
      name: "Specimen status filter",
    });
    const tabs = within(tablist).getAllByRole("tab");
    await expect(tabs[2]).toHaveAttribute("aria-selected", "true");
    await expect(tabs[2]?.textContent).toContain("(0)");
    await expect(tabs[0]).toHaveAttribute("aria-selected", "false");
  },
};
