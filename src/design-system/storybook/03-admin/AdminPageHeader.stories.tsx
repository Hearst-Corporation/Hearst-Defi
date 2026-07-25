// 03-admin — AdminPageHeader : le H1 canon admin (règle typo : H1 =
// AdminPageHeader UNIQUEMENT, gardien CI sur tout <h1 manuel).
// Slots : eyebrow · titre bicolore (titleLead/titleAccent) · kicker
// (contextLabel) · description · actions · filters.
//
// ⚠ Divergence preview CONNUE et ASSUMÉE (lot ultérieur) : le preview Storybook
// charge le CSS d'ARCHIVE (tokens-layer.css → globals.css → cockpit.css), PAS le
// CSS runtime (app.css → theme/legacy-bridge/typography). Les classes
// page-canon-* restaurées en vague 0 (`.page-canon-kicker`, `.page-canon-rule`,
// `.page-canon-toolbar*`) et les BEM `.admin-page-header__*` vivent dans
// src/styles/typography.css → INERTES ici ; `.h1` et `.eyebrow` existent dans
// cockpit.css, `.h1-accent` non. Le DOM et le contrat de slots restent LE sujet
// de ces stories. NE PAS importer app.css ici (bleed sur les stories calibrées).

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the real admin canon primitives, imported as-is.
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminUrlTabFilter } from "@/components/admin/admin-url-tab-filter";
import { CockpitButton } from "@/components/catalyst/cockpit-button";

const meta: Meta<typeof AdminPageHeader> = {
  title: "03-admin/AdminPageHeader",
  component: AdminPageHeader,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof AdminPageHeader>;

// ── API canon : titre bicolore + kicker ──────────────────────────────────────

export const Canon: Story = {
  args: {
    titleLead: "Investor",
    titleAccent: "Operations",
    contextLabel: "Admin canon — specimen",
  },
  play: async ({ canvasElement, canvas }) => {
    const h1 = canvasElement.querySelector("h1");
    await expect(h1).not.toBeNull();
    // Lead + accent composent UN seul heading (span .h1-accent à l'intérieur).
    await expect(h1?.textContent).toContain("Investor");
    await expect(h1?.querySelector(".h1-accent")?.textContent).toBe(
      "Operations",
    );
    await expect(canvas.getByText("Admin canon — specimen")).toBeVisible();
  },
};

// ── Tous les slots : eyebrow + description + actions + filters ──────────────
// La toolbar canon rend filters à GAUCHE, actions à DROITE, sous le trait
// accent (page-canon-rule, toujours rendu).

export const AllSlots: Story = {
  args: {
    eyebrow: "Specimen eyebrow",
    titleLead: "Investor",
    titleAccent: "Operations",
    contextLabel: "Admin canon — specimen",
    description:
      "Specimen description — every slot of the canonical header, filled with labelled placeholder copy.",
    actions: <CockpitButton>Specimen action</CockpitButton>,
    filters: (
      <AdminUrlTabFilter
        ariaLabel="Specimen header filter"
        activeKey="all"
        tabs={[
          { key: "all", label: "All", href: "?specimen=all" },
          { key: "flagged", label: "Flagged", href: "?specimen=flagged" },
        ]}
      />
    ),
  },
  play: async ({ canvasElement, canvas }) => {
    await expect(canvas.getByText("Specimen eyebrow")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Specimen action" }),
    ).toBeVisible();
    // Le slot filters accueille le filtre canon avec son contrat tablist.
    await expect(
      canvas.getByRole("tablist", { name: "Specimen header filter" }),
    ).toBeVisible();
    // Le trait accent est toujours rendu (aria-hidden, purement décoratif).
    await expect(
      canvasElement.querySelector(".page-canon-rule"),
    ).not.toBeNull();
    await expect(canvasElement.querySelectorAll("h1")).toHaveLength(1);
  },
};

// ── API legacy : titre simple ────────────────────────────────────────────────
// Gardée pour les pages de détail (single-string title) — même squelette,
// jamais un h1 maison.

export const LegacyTitle: Story = {
  args: {
    eyebrow: "Specimen eyebrow",
    title: "Specimen detail title",
    description: "Legacy single-string API — same skeleton, same rule.",
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Specimen detail title" }),
    ).toBeVisible();
    await expect(canvasElement.querySelectorAll("h1")).toHaveLength(1);
  },
};
