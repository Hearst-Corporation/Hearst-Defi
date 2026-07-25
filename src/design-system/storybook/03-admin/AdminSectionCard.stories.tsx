// 03-admin — AdminSectionCard : la « welded section » du canon admin.
// Variantes : titre+sous-titre · KPI strip embarqué · table Catalyst (contrat
// gouttière #059) · FORM_SURFACE.
//
// ⚠ Divergence preview CONNUE et ASSUMÉE (lot ultérieur) : le preview Storybook
// charge le CSS d'ARCHIVE (tokens-layer.css → globals.css → cockpit.css), PAS le
// CSS runtime (app.css → theme/legacy-bridge/typography) ni admin-canon.css
// (chargé par le layout /admin uniquement). Ici : `.ct-section-title`,
// `.ct-metric-caption`, `.ct-bento-label` (typography.css) et les marqueurs
// `.admin-canon-first-block` / `.admin-canon-table-surface` /
// `.admin-canon-form-surface` (admin-canon.css) restent INERTES — le DOM et le
// contrat sont corrects, une partie du rythme typo/padding manque. NE PAS
// importer app.css / admin-canon.css ici (bleed global sur les stories calibrées).
//
// Honnêteté : TOUTES les valeurs sont des specimens étiquetés — provenance
// `simulated`/`manual` sur chaque KPI et chaque ligne de table, jamais un
// chiffre qui se fait passer pour du réel.

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect } from "storybook/test";

// Zero-copy: the real admin canon primitives, imported as-is.
import {
  AdminSectionCard,
  AdminTableSurface,
  FORM_SURFACE,
  ROW,
  TABLE_HEAD,
  TABLE_WRAP,
} from "@/components/admin/admin-page-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import type { HeroKpi } from "@/lib/admin/kpi-strip-view";
import { ProvenanceBadge } from "@/ui/badge";
import { Input } from "@/ui/input";

const meta: Meta<typeof AdminSectionCard> = {
  title: "03-admin/AdminSectionCard",
  component: AdminSectionCard,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof AdminSectionCard>;

// ── Titre + sous-titre ───────────────────────────────────────────────────────
// Le sub-header canonique « Investor Base / New investor » : pile de titre à
// gauche, slot trailing shrink-0 à droite, hairline en dessous.

export const TitleAndSubtitle: Story = {
  render: () => (
    <AdminSectionCard
      title="Specimen register"
      subtitle="Simulated rows — Storybook specimen, not production data"
      headerTrailing={<CockpitButton>Specimen action</CockpitButton>}
      ariaLabel="Specimen register"
    >
      <p className="p-5 text-sm text-[var(--ct-text-muted)]">
        Specimen body — the card body mounts here (table, empty state, or any
        content).
      </p>
    </AdminSectionCard>
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { level: 2, name: "Specimen register" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Specimen action" }),
    ).toBeVisible();
  },
};

// ── KPI strip embarqué ──────────────────────────────────────────────────────
// `kpis` (HeroKpi[]) soude un AdminKpiStripPanel en tête de carte. Specimens
// étiquetés : provenance `simulated`/`manual` sur CHAQUE cellule (l'honnêteté
// vaut aussi dans Storybook). Pas de flag `alert` ici : le rouge est réservé
// aux vrais états dégradés, pas à une galerie de référence.

const SPECIMEN_KPIS: HeroKpi[] = [
  {
    label: "BTC reserve",
    value: "0.01520000 BTC",
    sublabel: "specimen — simulated",
    provenance: "simulated",
  },
  {
    label: "Capital subscribed",
    value: "127,000.00 USDC",
    sublabel: "specimen — simulated",
    provenance: "simulated",
  },
  {
    label: "Active vaults",
    value: "3",
    sublabel: "specimen — manual entry",
    provenance: "manual",
  },
  {
    label: "Pending reviews",
    value: "2",
    sublabel: "specimen — needs attention",
    provenance: "manual",
    accent: true,
  },
];

export const WithKpiStrip: Story = {
  render: () => (
    <AdminSectionCard
      kpis={SPECIMEN_KPIS}
      kpiTitle="Specimen capital strip"
      kpiSubtitle="All figures simulated for the canon gallery"
      kpiAction={<CockpitButton>Specimen CTA</CockpitButton>}
      title="Underlying list"
      subtitle="The strip welds to the section below by a bottom hairline"
      ariaLabel="Specimen capital strip section"
    >
      <p className="p-5 text-sm text-[var(--ct-text-muted)]">
        Specimen body under the welded strip.
      </p>
    </AdminSectionCard>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText("Specimen capital strip")).toBeVisible();
    // Chaque cellule KPI porte son dot de provenance (non-négociable #2) :
    // 4 specimens → 4 badges strip role=status.
    const dots = canvasElement.querySelectorAll(".provenance-badge--strip");
    await expect(dots).toHaveLength(4);
  },
};

// ── Table Catalyst (contrat gouttière #059) ─────────────────────────────────
// Table soudée bord à bord : la gouttière est portée par les CELLULES
// (px-4 partout, first:pl-5 / last:pr-5), pas par un padding de wrapper — la
// première colonne s'aligne sur le texte du header de carte. AdminTableSurface
// garde le scroll horizontal LOCAL à la carte.

export const WithTable: Story = {
  render: () => (
    <AdminSectionCard
      title="Investor base — specimen"
      subtitle="3 simulated rows, welded edge to edge"
      ariaLabel="Specimen investor table"
    >
      <AdminTableSurface>
        <Table className={TABLE_WRAP}>
          <TableHead className={TABLE_HEAD}>
            <TableRow>
              <TableHeader>Investor</TableHeader>
              <TableHeader>Commitment</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Provenance</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow className={ROW}>
              <TableCell>Specimen Alpha LLC</TableCell>
              <TableCell className="tabular-nums">82,000.00 USDC</TableCell>
              <TableCell>Onboarded</TableCell>
              <TableCell>
                <ProvenanceBadge source="simulated" />
              </TableCell>
            </TableRow>
            <TableRow className={ROW}>
              <TableCell>Specimen Beta SA</TableCell>
              <TableCell className="tabular-nums">45,000.00 USDC</TableCell>
              <TableCell>In review</TableCell>
              <TableCell>
                <ProvenanceBadge source="simulated" />
              </TableCell>
            </TableRow>
            <TableRow className={ROW}>
              <TableCell>Specimen Gamma Ltd</TableCell>
              <TableCell className="tabular-nums">12,500.00 USDC</TableCell>
              <TableCell>Committed</TableCell>
              <TableCell>
                <ProvenanceBadge source="simulated" />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </AdminTableSurface>
    </AdminSectionCard>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole("table")).toBeVisible();
    // Honnêteté : chaque ligne specimen porte son badge Simulated.
    await expect(canvas.getAllByText("Simulated")).toHaveLength(3);
    // Contrat gouttière : les cellules de bord portent la gouttière (pl-5/pr-5
    // via first:/last: sur TableHeader/TableCell), pas le wrapper.
    const firstHeader = canvasElement.querySelector("th");
    await expect(firstHeader?.className).toContain("first:pl-5");
  },
};

// ── FORM_SURFACE ─────────────────────────────────────────────────────────────
// Le corps de carte non-table canonique : `admin-canon-form-surface`
// (p-5 → lg:p-6 + gap colonne, via admin-canon.css au runtime — inert ici,
// voir la note d'en-tête). Jamais de padding improvisé pour un formulaire.

export const WithFormSurface: Story = {
  render: () => (
    <AdminSectionCard
      title="Specimen form"
      subtitle="FORM_SURFACE — the canon form body rhythm"
      ariaLabel="Specimen form"
    >
      <div className={FORM_SURFACE}>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="specimen-entity"
            className="text-sm text-[var(--ct-text-muted)]"
          >
            Entity name (specimen)
          </label>
          <Input id="specimen-entity" defaultValue="Specimen Alpha LLC" />
        </div>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="specimen-reference"
            className="text-sm text-[var(--ct-text-muted)]"
          >
            Internal reference (specimen)
          </label>
          <Input id="specimen-reference" defaultValue="SPC-0042" />
        </div>
        <div>
          <CockpitButton>Save draft (specimen)</CockpitButton>
        </div>
      </div>
    </AdminSectionCard>
  ),
  play: async ({ canvas, canvasElement }) => {
    // Chaque champ est étiqueté (label htmlFor → id).
    await expect(
      canvas.getByLabelText("Entity name (specimen)"),
    ).toBeVisible();
    await expect(
      canvas.getByLabelText("Internal reference (specimen)"),
    ).toBeVisible();
    // Le marqueur canon est posé (le rythme p-5→p-6 vient d'admin-canon.css
    // au runtime).
    await expect(
      canvasElement.querySelector(".admin-canon-form-surface"),
    ).not.toBeNull();
  },
};
