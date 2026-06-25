# Hearst Connect — design system conventions

Institutional single-vault DeFi cockpit (the **Hearst Yield Vault**). **Dark mode only**,
premium/graphite, one accent: **green `--ct-accent` `#A7FB90`**. Body font is **Satoshi**.

## Setup
- **Render on the deep background.** Every surface sits on `var(--ct-bg-deep)` (`#0E0F0F`). Put
  designs on a dark root (e.g. `<div style={{background:"var(--ct-bg-deep)", color:"var(--ct-text-body)"}}>`).
  Components are dark-themed and styled entirely by the bound **`styles.css`** — there is **no React
  provider to wrap**; just include the stylesheet (already wired) and render the components.
- No `dark:` variants, no light mode. Don't introduce other brand hues — accent is green only.

## Styling idiom (hybrid — use these, don't invent class names)
Three layers, in order of preference:
1. **Semantic `.ct-*` classes** for color / surface / text / border:
   - Surfaces: `ct-surface-0` `ct-surface-1` `ct-surface-2` `ct-surface-3`, accent fill `ct-bg-accent`.
   - Text: `ct-text-strong` `ct-text-primary` `ct-text-body` `ct-text-muted` `ct-text-faint` `ct-text-accent`.
   - Borders: `ct-bc-soft` `ct-bc-base` `ct-bc-strong` `ct-bc-accent` `ct-bc-success` `ct-bc-warning` `ct-bc-danger`.
   - Type roles: `h1` `h2` `h3` `h4`, `eyebrow`, `body-sm` `body-xs`, `stat-label` `stat-value`, `mono`, `tabular` (use `tabular`/`mono` for all numbers).
   - Glass module surface: `ct-glass-panel` (its flat variant `ct-glass-panel--flat` for dense lists).
2. **Tailwind v4 utilities** for layout/spacing (`flex`, `grid`, `gap-*`, `items-center`, `rounded-full`, …).
3. **`--ct-*` CSS variables** for arbitrary values via Tailwind's arbitrary syntax, e.g.
   `px-[var(--ct-space-3)]`, `gap-(--ct-space-2)`, `text-(--ct-text-strong)`. Spacing scale is `--ct-space-1 … --ct-space-8`.

## Where the truth lives
- **`styles.css`** and its `@import` closure (esp. `_ds_bundle.css`) define every `.ct-*` class and `--ct-*` token — read it before styling.
- Each component ships a `<Name>.d.ts` (the prop contract) and `<Name>.prompt.md` (usage) — read those before composing a component.

## Brand rules (non-negotiable — the design agent MUST follow these)
- **APY is always a range**, never a single point — use `<ApyRange low={9.4} high={12.8} />` or text like `9.4–12.8%`.
- **Every metric carries a provenance badge** — `<ProvenanceBadge kind="attested" />` (live / oracle / attested / estimated / partial / manual / stale / simulated). `Metric` takes a `provenance` prop.
- **PTAI format** for any simulation/rebalance rationale — `<Ptai projection trigger action impact />` (Projection → Trigger → Action → Impact).
- **Forbidden words** in any copy: "guarantee", "promise", "certain", "will deliver", "risk-free". Every projection shows assumptions + a "not guaranteed" stance.

## Idiomatic snippet
```tsx
<div style={{ background: "var(--ct-bg-deep)", padding: "var(--ct-space-6)" }}>
  <Card>
    <CardHeader><CardTitle>Hearst Yield Vault</CardTitle></CardHeader>
    <MetricGrid columns={3}>
      <Metric variant="nested" label="Net APY (range)"
        value={<ApyRange low={9.4} high={12.8} />} provenance="estimated" />
      <Metric variant="nested" label="NAV / share" value="$1.041" provenance="oracle" />
      <Metric variant="nested" label="Soft lock-up" value="60 days" provenance="manual" />
    </MetricGrid>
    <div className="flex justify-end gap-[var(--ct-space-3)]">
      <Button variant="ghost">View proof</Button>
      <Button variant="primary">Invest now</Button>
    </div>
  </Card>
</div>
```
