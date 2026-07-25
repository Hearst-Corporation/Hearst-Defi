// 03-admin — AlertBanner (3 tones) + ScopeFallbackNotice.
// Doctrine couleur : error → --color-danger, RÉSERVÉ aux erreurs bloquantes
// (role=alert par défaut) ; warning → --color-warning, état dégradé non
// bloquant (role=status) ; info → gris neutre (role=status).
//
// ⚠ Divergence preview CONNUE et ASSUMÉE (lot ultérieur) : le preview charge le
// CSS d'ARCHIVE (tokens-layer/globals/cockpit), pas app.css. `text-danger` /
// `text-warning` / `border-border` sont générés (globals.css mappe
// --color-danger/warning/border sur les tokens --ct-*), mais `text-muted` et
// `--color-foreground` (tone info) vivent dans le monde greenfield
// (src/styles/theme.css) → le tone info rend ici avec le texte hérité et un
// wash de fond neutre. Contrat de rôles/contenu inchangé. NE PAS importer
// app.css ici (bleed sur les stories calibrées).
//
// Honnêteté : les messages sont des specimens explicites — aucun état réel.

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the real admin canon primitives, imported as-is.
import { AlertBanner } from "@/components/admin/alert-banner";
import { ScopeFallbackNotice } from "@/components/admin/scope-fallback-notice";

const meta: Meta<typeof AlertBanner> = {
  title: "03-admin/AlertBanner-ScopeFallback",
  component: AlertBanner,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof AlertBanner>;

// ── error → role=alert (défaut) : la seule tone qui interrompt ───────────────

export const ErrorTone: Story = {
  args: {
    tone: "error",
    title: "Write blocked (specimen)",
    children:
      "Specimen blocking error — simulated copy for the canon gallery, no real state behind it.",
  },
  play: async ({ canvas }) => {
    const banner = canvas.getByRole("alert");
    await expect(banner).toBeVisible();
    await expect(banner.textContent).toContain("Write blocked (specimen)");
  },
};

// ── warning → role=status : dégradé, à remarquer, non bloquant ───────────────

export const WarningTone: Story = {
  args: {
    tone: "warning",
    title: "Degraded read (specimen)",
    children:
      "Specimen caution — a degraded state the operator must notice, simulated for the gallery.",
  },
  play: async ({ canvas }) => {
    const banner = canvas.getByRole("status");
    await expect(banner).toBeVisible();
    await expect(banner.textContent).toContain("Degraded read (specimen)");
  },
};

// ── info → role=status : notice neutre, gris ─────────────────────────────────

export const InfoTone: Story = {
  args: {
    tone: "info",
    children:
      "Specimen neutral notice — no title, grey wash, never an emphasis colour.",
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toBeVisible();
  },
};

// ── ScopeFallbackNotice ──────────────────────────────────────────────────────
// Rend VISIBLE une substitution de scope vault (`usedFallback`) — tone warning
// exprès : une substitution est une prudence, pas une erreur (le rouge reste
// réservé aux erreurs). role=status : n'interrompt pas la lecture.

export const ScopeFallback: Story = {
  render: () => (
    <ScopeFallbackNotice
      requested="specimen-vault-042"
      resolvedLabel="Series 1 flagship (specimen)"
    />
  ),
  play: async ({ canvas }) => {
    const notice = canvas.getByRole("status");
    await expect(notice).toBeVisible();
    // La substitution nomme LES DEUX scopes : celui montré et celui demandé.
    await expect(notice.textContent).toContain("Series 1 flagship (specimen)");
    await expect(notice.textContent).toContain("specimen-vault-042");
  },
};
