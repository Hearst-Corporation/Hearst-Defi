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
  { cls: "h1", label: "Page title", size: "~24px / extrabold" },
  { cls: "h2", label: "Section", size: "20–22px / bold" },
  { cls: "h3", label: "Module / card", size: "16–18px / bold · accent" },
  { cls: "h4", label: "Card heading", size: "16px / semibold" },
  { cls: "body-lg", label: "Body large", size: "16–18px" },
  { cls: "body-md", label: "Body medium", size: "14px" },
  { cls: "body-sm", label: "Body small", size: "14px" },
  { cls: "body-xs", label: "Body extra-small", size: "10px" },
] as const;

const RADII = [
  { cls: "ds-radius-chip--sm", name: "sm", token: "0.375rem" },
  { cls: "ds-radius-chip--md", name: "md", token: "0.5rem" },
  { cls: "ds-radius-chip--lg", name: "lg", token: "0.75rem" },
  { cls: "ds-radius-chip--xl", name: "xl", token: "1rem" },
  { cls: "ds-radius-chip--full", name: "full", token: "9999px" },
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
      <DsBlock title="Surfaces" hint="Frosted-glass elevation, lightest at the back">
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
                <span className="body-xs ct-text-faint">{t.size}</span>
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

      <DsBlock title="Elevation" hint="Glass bevel vs flat — no external drop shadow (ADR-013)">
        <div className="ds-grid--two ds-grid">
          <DsSpecimen caption="Default surface — glass premium" classHint=".ct-glass-panel">
            <Card hoverOverlay={false} className="w-full">
              <p className="body-sm ct-text-body m-0">
                Inner bevel (inset highlight), 1px graphite border. The canonical
                module surface for every page.
              </p>
            </Card>
          </DsSpecimen>
          <DsSpecimen caption="Dense surface — flat" classHint='material="flat"'>
            <Card hoverOverlay={false} material="flat" className="w-full">
              <NestedPanel className="p-[var(--ct-space-3)]">
                <p className="body-sm ct-text-body m-0">
                  Opaque, no frost — for dense lists / tables where glass-on-glass
                  would cage-in-cage.
                </p>
              </NestedPanel>
            </Card>
          </DsSpecimen>
        </div>
      </DsBlock>
    </DsSection>
  );
}
