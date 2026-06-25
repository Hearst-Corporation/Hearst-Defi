import { Card } from "@/components/ui/card";
import { NestedPanel } from "@/components/ui/nested-panel";

import { DsBlock, DsSection, DsSpecimen, DsSwatch } from "./ds-kit";

const SURFACES = [
  { chipClass: "ct-surface-0", name: "Surface 0", token: "--ct-surface-0" },
  { chipClass: "ct-surface-1", name: "Surface 1", token: "--ct-surface-1" },
  { chipClass: "ct-surface-2", name: "Surface 2", token: "--ct-surface-2" },
  { chipClass: "ct-surface-3", name: "Surface 3", token: "--ct-surface-3" },
  { chipClass: "ds-swatch__chip--bg-deep", name: "Background", token: "--ct-bg-deep" },
] as const;

const BORDERS = [
  { chipClass: "ds-swatch__chip--line ds-swatch__chip--border-soft", name: "Border soft", token: "--ct-border-soft" },
  { chipClass: "ds-swatch__chip--line ds-swatch__chip--border", name: "Border", token: "--ct-border" },
  { chipClass: "ds-swatch__chip--line ds-swatch__chip--border-strong", name: "Border strong", token: "--ct-border-strong" },
  { chipClass: "ds-swatch__chip--line ds-swatch__chip--border-accent", name: "Border accent", token: "--ct-border-accent" },
] as const;

const ACCENTS = [
  { chipClass: "ds-swatch__chip--accent", name: "Accent (only green)", token: "--ct-accent" },
  { chipClass: "ds-swatch__chip--success", name: "Success = accent", token: "--ct-status-success" },
  { chipClass: "ds-swatch__chip--warning", name: "Warning", token: "--ct-status-warning" },
  { chipClass: "ds-swatch__chip--danger", name: "Danger", token: "--ct-status-danger" },
  { chipClass: "ds-swatch__chip--info", name: "Info", token: "--ct-status-info" },
] as const;

const TEXT_ROLES = [
  { cls: "ct-text-strong", name: "Text strong", token: "--ct-text-strong" },
  { cls: "ct-text-primary", name: "Text primary", token: "--ct-text-primary" },
  { cls: "ct-text-body", name: "Text body", token: "--ct-text-body" },
  { cls: "ct-text-muted", name: "Text muted", token: "--ct-text-muted" },
  { cls: "ct-text-faint", name: "Text faint", token: "--ct-text-faint" },
] as const;

const SPACING = [
  "0_5", "1", "1_5", "2", "2_5", "3", "3_5", "4", "5", "6", "7", "8", "9", "10", "12", "16", "20", "24",
] as const;

const TYPE_ROLES = [
  { cls: "h1", label: "Page title", size: "24px / semibold" },
  { cls: "h2", label: "Section", size: "18–22px / semibold" },
  { cls: "h3", label: "Module / card", size: "15–17px / medium · accent" },
  { cls: "h4", label: "Card heading", size: "13px / medium" },
  { cls: "body-lg", label: "Body large", size: "15–17px" },
  { cls: "body-md", label: "Body medium", size: "15px" },
  { cls: "body-sm", label: "Body small", size: "15px" },
  { cls: "body-xs", label: "Body extra-small", size: "13px" },
] as const;

const RADII = [
  { cls: "ds-radius-chip--sm", name: "sm", token: "0.375rem" },
  { cls: "ds-radius-chip--md", name: "md", token: "0.5rem" },
  { cls: "ds-radius-chip--lg", name: "lg", token: "0.75rem" },
  { cls: "ds-radius-chip--xl", name: "xl", token: "1rem" },
  { cls: "ds-radius-chip--full", name: "full", token: "9999px" },
] as const;

/* V4 foundation tokens absorbed in Lot A (commit b43a0a30) — referenced here so
   the showcase is their canonical home, not the archived HTML mockup. */
const V4_TOKENS = [
  {
    chipClass: "ds-token-ref__chip--hero",
    chipLabel: "40",
    name: "Hero data tier",
    token: "--ct-text-hero",
    role: "40px headline KPI — the single dominant figure of a hero surface",
  },
  {
    chipClass: "ds-token-ref__chip--curve",
    name: "Chart curve stroke",
    token: "--ct-chart-curve-color",
    role: "Line stroke for curves — aliases the accent, never a second green",
  },
  {
    chipClass: "ds-token-ref__chip--area",
    name: "Chart area wash",
    token: "--ct-chart-area-top / -bottom",
    role: "Under-curve gradient fill — accent at the top, fading to transparent",
  },
] as const;

function spacingLabel(key: string): string {
  return key.replace("_", ".");
}

export function SectionFoundations() {
  return (
    <DsSection
      id="foundations"
      index="A"
      title="Foundations"
      lead="Tokens are the source of truth. Every surface, colour, space and type role below is a CSS variable — never a raw hex, px or Tailwind colour. One green only: --ct-accent."
    >
      <DsBlock title="Surfaces" hint="Opaque charcoal tiers — darkest at the back">
        <div className="ds-grid">
          {SURFACES.map((s) => (
            <DsSwatch key={s.token} {...s} />
          ))}
        </div>
      </DsBlock>

      <DsBlock title="Borders" hint="Separators only — no drop shadows">
        <div className="ds-grid">
          {BORDERS.map((b) => (
            <DsSwatch key={b.token} {...b} />
          ))}
        </div>
      </DsBlock>

      <DsBlock title="Accent & status" hint="Differentiate with blue / amber / red — never a second green">
        <div className="ds-grid">
          {ACCENTS.map((a) => (
            <DsSwatch key={a.token} {...a} />
          ))}
        </div>
      </DsBlock>

      <DsBlock title="Text colours" hint="Hierarchy by opacity, not by hue">
        <div className="ds-text-rows">
          {TEXT_ROLES.map((t) => (
            <div key={t.token} className="ds-text-row">
              <span className={`body-md ${t.cls}`}>{t.name} — institutional yield</span>
              <span className="ds-swatch__token">{t.token}</span>
            </div>
          ))}
        </div>
      </DsBlock>

      <DsBlock title="Spacing scale" hint="--ct-space-* · the only allowed gaps / paddings">
        <div className="ds-scale">
          {SPACING.map((k) => (
            <div key={k} className="ds-scale-row">
              <span className="ds-scale-label">space-{spacingLabel(k)}</span>
              <span
                className="ds-scale-bar"
                style={{ width: `var(--ct-space-${k})` }}
                aria-hidden="true"
              />
            </div>
          ))}
        </div>
      </DsBlock>

      <DsBlock title="Typography scale" hint="Semantic roles — not arbitrary text-[Npx]">
        <div className="ds-type">
          {TYPE_ROLES.map((t) => (
            <div key={t.cls} className="ds-type-row">
              <span className={`${t.cls} ct-text-strong`}>{t.label}</span>
              <span className="ds-type-row__meta">
                <span className="ds-type-row__class">.{t.cls}</span>
                <span className="body-xs ct-text-muted">{t.size}</span>
              </span>
            </div>
          ))}
          <div className="ds-type-row">
            <span className="eyebrow">Eyebrow / label</span>
            <span className="ds-type-row__class">.eyebrow · .stat-label</span>
          </div>
          <div className="ds-type-row">
            <span className="stat-value">12.4</span>
            <span className="ds-type-row__class">.stat-value (KPI, tabular)</span>
          </div>
        </div>
      </DsBlock>

      <DsBlock
        title="Hero data typography"
        hint="--ct-text-hero (40px) — the dominant figure of a hero surface, never in cascade"
      >
        <div className="ds-grid--two ds-grid">
          <DsSpecimen caption="Headline value" classHint=".stat-value · --ct-text-hero" example stack>
            <div className="ds-hero-figure">
              <span className="stat-label ct-text-muted">Net asset value</span>
              <span className="ds-hero-figure__row">
                <span className="ds-hero-figure__affix">$</span>
                <span className="stat-value ds-hero-figure__value">12.40</span>
                <span className="ds-hero-figure__affix">M</span>
              </span>
              <span className="body-xs ct-status-success font-medium">↑ +4.2% this month</span>
            </div>
          </DsSpecimen>
          <DsSpecimen caption="Headline range" classHint="range, never a single point" example stack>
            <div className="ds-hero-figure">
              <span className="stat-label ct-text-muted">Target APY</span>
              <span className="stat-value ds-hero-figure__value">9.4–12.8%</span>
              <span className="body-xs ct-text-muted">A range — not a single point · not guaranteed</span>
            </div>
          </DsSpecimen>
        </div>
      </DsBlock>

      <DsBlock title="Radius" hint="--ct-radius-* · no arbitrary corner values">
        <div className="ds-grid--narrow ds-grid">
          {RADII.map((r) => (
            <div key={r.name} className="ds-swatch">
              <div className={`ds-radius-chip ${r.cls}`} aria-hidden="true" />
              <div className="ds-swatch__meta">
                <span className="body-xs ct-text-body">radius-{r.name}</span>
                <span className="ds-swatch__token">{r.token}</span>
              </div>
            </div>
          ))}
        </div>
      </DsBlock>

      <DsBlock title="Elevation" hint="Graphite opaque vs flat — no external drop shadow (ADR-013)">
        <div className="ds-grid--two ds-grid">
          <DsSpecimen caption="Default module surface" classHint=".ct-glass-panel">
            <Card hoverOverlay={false} className="w-full">
              <p className="body-sm ct-text-body m-0">
                Opaque charcoal fill, 1px graphite border, no backdrop blur. The
                canonical module surface for every page (.ct-glass-panel is a legacy
                class name — not frosted glass).
              </p>
            </Card>
          </DsSpecimen>
          <DsSpecimen caption="Dense surface — flat" classHint='material="flat"'>
            <Card hoverOverlay={false} material="flat" density="compact" className="w-full">
              <NestedPanel className="p-[var(--ct-space-3)]">
                <p className="body-sm ct-text-body m-0">
                  Same opaque fill — for dense lists / tables where a nested panel
                  would cage-in-cage.
                </p>
              </NestedPanel>
            </Card>
          </DsSpecimen>
        </div>
      </DsBlock>

      <DsBlock
        title="V4 foundation tokens"
        hint="Absorbed into the canon — the visual direction lives here, not in a mockup"
      >
        <div className="ds-token-ref">
          {V4_TOKENS.map((t) => (
            <div key={t.token} className="ds-token-ref__row">
              <span className={`ds-token-ref__chip ${t.chipClass}`} aria-hidden="true">
                {"chipLabel" in t ? t.chipLabel : null}
              </span>
              <div className="ds-token-ref__meta">
                <span className="body-sm ct-text-strong">{t.name}</span>
                <span className="body-xs ct-text-muted">{t.role}</span>
              </div>
              <span className="ds-swatch__token">{t.token}</span>
            </div>
          ))}
        </div>
      </DsBlock>
    </DsSection>
  );
}
