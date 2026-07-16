# Catalyst components — Canonical UI layer

This folder is the **destination** layer for Hearst Connect UI primitives.

## Canonical primitives (PROMPT 232)

| Need | Primitive | Path |
|------|-----------|------|
| Button | `CockpitButton` | `cockpit-button.tsx` |
| Card | `Card` (+ `CardHeader`, `CardTitle`, `CardContent`, `CardDescription`) | `card.tsx` |
| Badge / status chip | `BentoBadge` | `bento-badge.tsx` |
| Provenance | `ProvenanceBadge` | `provenance-badge.tsx` |
| Panel status | `PanelStatus` | `panel-status.tsx` |
| Input (Headless) | `Input` | `input.tsx` |
| Input (native field) | `TextField` | `field.tsx` |
| Select | `Select` | `select.tsx` |
| Textarea | `Textarea` | `textarea.tsx` |
| Field layout | `Field`, `FieldLabel`, `FieldDescription`, `FieldError` | `field.tsx` |
| Table | `Table` | `table.tsx` |
| Tabs / segmented | `SegmentedControl` | `segmented-control.tsx` |
| Charts | `ChartContainer` (Recharts layer) | `src/components/ui/chart.tsx` |
| Page shell (admin) | `AdminPageShell` | `src/components/admin/admin-page-shell.tsx` |
| Page shell (bento) | `BentoPageShell` | `bento.tsx` |

## Deprecated / compatibility only

| Legacy | Replacement | Removal condition |
|--------|-------------|-------------------|
| `BENTO_PRIMARY_BTN` / `BENTO_SECONDARY_BTN` | `CockpitButton` `variant` + `shape="rect"` | exports removed from `bento.tsx` when grep-clean |
| `catalyst/button.tsx` | `CockpitButton` | shim re-exports `Button` alias only |
| `CATALYST_ACCENT_BTN` | `CockpitButton variant="primary"` | delete `lib/ui/catalyst-accent.ts` |
| `src/components/ui/card` | `@/components/catalyst/card` | compatibility re-export |
| `src/components/ui/provenance-badge` | `@/components/catalyst/provenance-badge` | compatibility re-export |

## Rules

- Focus ring = `--ct-accent` (never Tailwind blue).
- Borders = `var(--ct-border)` / `var(--ct-border-soft)`.
- Text = `var(--ct-text-*)`.
- Status = `var(--ct-status-*)`.
- Green = `var(--ct-accent)` only.
- No `font-mono` — use `.mono` / `.tabular`.
- No `dark:` modifiers in new primitives (dark-only product).
- No page-local `const FIELD =` / `INPUT_CLASS` — use `field-controls.ts` + Field primitives.

Guards: `src/lib/ds/__tests__/ds-canonicalization-guard.test.ts`
