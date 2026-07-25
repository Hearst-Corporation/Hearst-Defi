// 03-admin — AdminPageFrame (nu) + AdminPageShell (composé) — canon admin.
//
// ⚠ Divergence preview CONNUE et ASSUMÉE (lot ultérieur) : le preview Storybook
// charge le CSS d'ARCHIVE (tokens-layer.css → globals.css → cockpit.css), PAS le
// CSS runtime (src/styles/app.css → theme/legacy-bridge/typography) ni
// src/app/admin/admin-canon.css (chargé par le layout /admin uniquement).
// Ici : `.h1` existe (cockpit.css) mais `.h1-accent`, `.page-canon-kicker`,
// `.page-canon-rule`, les BEM `.admin-page-header__*` et les marqueurs
// `.admin-canon-page-frame` restent INERTES (DOM et contrat corrects, une partie
// du chrome typo manque). NE PAS importer app.css / admin-canon.css dans une
// story — le CSS d'un module story bleed sur TOUTES les stories calibrées.

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the real admin canon primitives, imported as-is.
import {
  AdminPageFrame,
  AdminPageShell,
} from "@/components/admin/admin-page-shell";
import { CockpitButton } from "@/components/catalyst/cockpit-button";

const meta: Meta<typeof AdminPageShell> = {
  title: "03-admin/AdminPageFrame-Shell",
  component: AdminPageShell,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof AdminPageShell>;

/** Placeholder body block — clearly a specimen, carries no figures. */
function SpecimenBody() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--ct-border)] p-5 text-sm text-[var(--ct-text-muted)]">
      Specimen body block — the frame owns surface, border, radius and the
      padded column rhythm; page content mounts here.
    </div>
  );
}

// ── AdminPageFrame nu ────────────────────────────────────────────────────────
// The outer admin box WITHOUT a header — the primitive the views bridge
// (src/views/_shared/layout.tsx PageLayout) delegates to. One source of truth
// for the admin frame.

export const FrameBare: Story = {
  render: () => (
    <AdminPageFrame>
      <SpecimenBody />
    </AdminPageFrame>
  ),
  play: async ({ canvasElement }) => {
    // The canon marker class is present (styling comes from admin-canon.css at
    // runtime — inert here, see the header note).
    await expect(
      canvasElement.querySelector(".admin-canon-page-frame"),
    ).not.toBeNull();
    // A bare frame renders NO heading — the header is AdminPageShell's job.
    await expect(canvasElement.querySelector("h1")).toBeNull();
  },
};

// ── AdminPageShell complet (API canon) ──────────────────────────────────────
// titleLead (blanc) + titleAccent (vert) + contextLabel (kicker) + headerActions
// (CTA sur la MÊME ligne que le titre, aligné à droite — titleRowEnd).

export const ShellCanon: Story = {
  render: () => (
    <AdminPageShell
      titleLead="Investor"
      titleAccent="Registry"
      contextLabel="Admin canon — specimen"
      headerActions={<CockpitButton>New entry</CockpitButton>}
    >
      <SpecimenBody />
    </AdminPageShell>
  ),
  play: async ({ canvasElement, canvas }) => {
    // H1 composé : lead + accent dans le MÊME heading (jamais deux titres).
    const h1 = canvasElement.querySelector("h1");
    await expect(h1).not.toBeNull();
    await expect(h1?.textContent).toContain("Investor");
    await expect(h1?.textContent).toContain("Registry");
    // Kicker + CTA présents.
    await expect(canvas.getByText("Admin canon — specimen")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "New entry" }),
    ).toBeVisible();
    // Un seul h1 — règle typo admin (H1 = AdminPageHeader uniquement).
    await expect(canvasElement.querySelectorAll("h1")).toHaveLength(1);
  },
};

// ── AdminPageShell — API legacy (pages de détail) ────────────────────────────
// `title` simple + `eyebrow` + `description` + `lead` (back-link) : gardée pour
// que les pages de détail restent sur le shell canonique, pas sur un div maison.

export const ShellLegacyDetail: Story = {
  render: () => (
    <AdminPageShell
      title="Specimen detail"
      eyebrow="Admin canon"
      description="Legacy single-string API — kept so detail pages stay on the canonical shell."
      lead={
        <a
          href="#specimen-back"
          className="text-xs text-[var(--ct-text-muted)] transition-colors hover:text-[var(--ct-text-strong)]"
        >
          ← Back (specimen)
        </a>
      }
    >
      <SpecimenBody />
    </AdminPageShell>
  ),
  play: async ({ canvasElement, canvas }) => {
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Specimen detail" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "← Back (specimen)" }),
    ).toBeVisible();
    await expect(canvasElement.querySelectorAll("h1")).toHaveLength(1);
  },
};
