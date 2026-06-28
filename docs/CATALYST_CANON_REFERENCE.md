# Catalyst Canon — Typography Reference

`/admin/customers` is the **canon page**. Catalyst / Tailwind Plus is the component
authority; Hearst `--ct-*` tokens brand it. Portfolio is the typographic source of
truth (`doc-flow-typography.css` mirrors `portfolio.css`).

This file documents the **7 typography roles**. They are centralized classes —
**never** repeat `text-[11px]`, `text-[12px]`, `text-[13px]`, `text-[18px]`,
`tracking-[0.15em]`, or raw colors inline in a page.

All roles live in `src/app/doc-flow-typography.css`, scoped to `.product-doc` /
`.admin-doc`, 100% `--ct-*` tokens.

| # | Role | Class | Size token | Weight | Color | Use |
|---|------|-------|-----------|--------|-------|-----|
| 1 | Page title | `.h1` | `--ct-text-3xl-fixed` (24px) | semibold | `--ct-text-strong` | the page H1 |
| 1b| Page title accent | `.h1-accent` | inherits | semibold | `--ct-accent` | the variable/bicolor part of the H1 |
| 2 | Page kicker | `.page-canon-kicker` | `--ct-text-nano` | semibold | `--ct-text-secondary` | "— CONTEXT" under the H1 (accent dash) |
| 3 | Section title | `.ct-section-title` | `--ct-text-sm` (15px) | semibold | `--ct-text-strong` | block titles (Investor Base / Directory) |
| 4 | Panel title | `.ct-panel-title` | `--ct-text-lg` (15→17) | medium | `--ct-accent` | card/panel chrome titles |
| 5 | Micro label | `.ct-bento-label` | `--ct-text-nano` | bold | `--ct-text-muted` | uppercase nano labels, table heads |
| 6 | Metric value | `.ct-metric-value` | `--ct-text-sm` (15px) | semibold | `--ct-text-strong` | inline/cell figures (tabular) |
| 6b| Big KPI value | `.stat-value` | `--ct-text-lg` | bold | `--ct-accent` | the large KPI-strip numbers (stronger tier) |
| 7 | Metric caption | `.ct-metric-caption` | `--ct-text-2xs` (12px) | normal | `--ct-text-muted` | sub-lines under titles/values |

## Rules

- **Section title ≠ micro label.** A section heading uses `.ct-section-title`
  (readable, strong). Do not detour `.ct-bento-label` (a muted uppercase nano)
  as a section title.
- **No inline type sizes** in pages: use the role class, not `text-[Npx]`.
- **No `tracking-[0.15em]`** inline — the role classes carry their own tracking.
- **One green**: `--ct-accent` only (never `#A7FB90`).
- **Borders**: `--ct-border` / `--ct-border-soft`. **Text**: `--ct-text-*`.
  **Hover/surfaces**: tokenized `color-mix(in_srgb, var(--ct-...), transparent)`.

## How to migrate a page to the canon

1. H1 → `<AdminPageHeader titleLead titleAccent contextLabel />`
   (renders `.h1` + `.h1-accent` + `.page-canon-kicker` + `.page-canon-rule`).
2. Replace section headings with `<h2 className="ct-section-title">`.
3. Replace card/panel titles with `.ct-panel-title` (or semantic `<h3>`).
4. Replace inline metric figures with `.ct-metric-value`.
5. Replace inline sub-lines with `.ct-metric-caption`.
6. Replace any uppercase nano label with `.ct-bento-label`.
7. Remove every `text-[Npx]` / `tracking-[0.15em]` / raw hex left behind.

Responsive: validate **full screen** with the assistant rail **open and closed**;
no global overflow; tables scroll locally inside their card.
