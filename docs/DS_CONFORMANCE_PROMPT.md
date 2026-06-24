# DS Conformance — Reference Prompt

> **Single source of truth** for auditing any page against the Hearst Connect
> design system. Used by the `/ds-conformance` command + `.claude/workflows/ds-conformance.js`
> and by any agent (or human) checking that a surface is "wired to the DS".
>
> The **living reference** is the page you can open: **`/admin/design-system`**
> (built from the real primitives). This doc is its machine-readable checklist.
> When the two disagree, the rendered page + `src/components/ui/*` win.

## What "linked to the design system" means

No page imports the reference page. "Linked to the DS" = the page is built from
the **same canon**: the same tokens, the same primitives, the same surface/nesting
rules, the same honesty rules. A page is conformant when an agent could rebuild it
using only `/admin/design-system` + `src/components/ui/*` and never reach for a raw
value.

## Where the canon lives (read these, in this order)

1. **`/admin/design-system`** — rendered reference (route: `src/app/admin/design-system/`).
2. **`src/components/ui/*`** — the approved primitives (the real signatures).
3. **`cockpit-shell/tokens.css` → `src/app/cockpit.css` → `src/app/globals.css`** — token cascade.
4. **`docs/DESIGN_SYSTEM.md`** — written canon (colours, type, surfaces, ADR-013).
5. **`docs/CSS_INDEX.md`** — map of the big CSS files.

## The 9 conformance dimensions

For each page, grade every dimension. Cite `file:line` + the **token-only** fix.

### D1 — Tokens only (P0 on colour)
- **No** raw `#hex`, `rgb()`, `rgba()`, `hsl()` in `src/**`. Only exception:
  `src/lib/cockpit-tokens.ts` (PDF print + Privy theme — can't read CSS vars).
- **No** Tailwind colour utilities: `green-*`, `red-*`, `emerald-*`, `text-white`,
  `bg-black`, etc. Colours come from `--ct-*` (via `.ct-*` utilities or `var()`).
- Check: `rg -n '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsl\(' <files> | grep -v cockpit-tokens`
  and `rg -n '\b(bg|text|border)-(red|green|emerald|blue|amber|yellow|slate|gray|zinc)-[0-9]' <files>`.

### D2 — One green (P0)
- The **only** green is `--ct-accent` (#A7FB90). `--ct-status-success` aliases it.
- No `#16a34a`, `#4ade80`, `green-*`, no second green as a "category" colour.
- Differentiate with `--ct-status-info` (blue) / `--ct-status-warning` (amber) /
  `--ct-status-danger` (red) / text opacity — never a second green.

### D3 — Dark-only (P1)
- **No** `dark:` modifiers anywhere. Dark mode is the only mode.
- Check: `rg -n '\bdark:' <files>`.

### D4 — Primitives reused, not re-implemented (P1)
- Use `Button` / `Card` / `Badge` / `ProvenanceBadge` / `Metric` / `MetricGrid` /
  `EmptySurface` / `PanelStatus` / `Skeleton` / `NestedPanel` / `DataRow`·`ProofRow` /
  `DashboardPanelHeader` / `SegmentedControl` / `ApyRange` / `Ptai` / `Progress`.
- **Flag** hand-rolled equivalents: a raw `<button class="rounded-full …">` instead
  of `<Button>`, an inline empty-state `<div>` instead of `<EmptySurface>`, a custom
  skeleton instead of `<Skeleton>`, a bespoke pill instead of `<Badge>`/`.ct-pill`.

### D5 — Surfaces & nesting (P1; cage/glow = P1, glow on a panel = P1)
- Default surface = `Card` (`.ct-glass-panel`). Dense lists/tables = `material="flat"`.
- Evidence box = `NestedPanel`. **Max two levels**: Card (active) → NestedPanel.
- **No** glass-inside-glass (cage-in-cage). **No** glow / halo / radial-gradient
  highlight / box-shadow bloom decorating a panel (the primary `<Button>` ships its
  own canonical accent treatment — allowed). No forced chart `min-height`.

### D6 — Typography roles (P2)
- Use role classes: `.h1` `.h2` `.h3` `.h4` `.body-lg/-md/-sm/-xs` `.eyebrow`
  `.stat-label` `.stat-value` `.mono` `.tabular`.
- **No** arbitrary `text-[13px]` / `font-[700]` / raw `leading-[…]`. Headlines via
  the role classes, not ad-hoc sizes. (Under `.admin-doc` the roles are overridden
  by `doc-flow-typography.css` — that's expected, still conformant.)

### D7 — Spacing & radius (P2)
- Gaps/paddings/margins from `--ct-space-*`; corners from `--ct-radius-*`.
- **No** magic px (`p-[7px]`, `gap-[13px]`, `rounded-[5px]`). `1px` hairlines and
  documented em values (OTP letter-spacing) are the only literals allowed.

### D8 — Product honesty (P0 on fake-live, P1 otherwise)
- Every metric carries a **provenance badge** (Live/Oracle/Attested/Estimated/Manual/Stale).
- **APY is always a range** (`9.4–12.8%` via `ApyRange`), never a single point.
- Projections show **assumptions** + a **"not guaranteed"** disclaimer.
- **No** fake `Live`/`Verified` badge on a zero/empty/preview state (use `EmptySurface`
  or an honest preview chip).
- **Forbidden words** in any human-facing/agent output: "guarantee", "promise",
  "certain", "will deliver", "risk-free".

### D9 — Page shell & states (P2; horizontal scroll = P1)
- Admin pages open with `AdminPageHeader` inside the `.admin-doc` shell; product
  pages use `ProductPageHeader`. Empty/error/loading via `EmptySurface` /
  `PanelStatus` / `Skeleton` — not cheap inline placeholders.
- **No horizontal scroll** at 390 / 768 / 1024 / 1280 / 1536 (and 1536 with chat
  open for product/admin shells). Auto-fit grids, `min-width: 0` on flex children.

## Severity → score

Per page, start at **100** and subtract:
- each **P0** = −20 (colour drift, second green, fake-live, APY single point)
- each **P1** = −8 (dark:, re-implemented primitive, cage/glow, horizontal scroll, missing provenance)
- each **P2** = −3 (typo role drift, magic spacing, missing honest empty/skeleton)

Floor at 0. **Pass = ≥ 90 and zero P0.** Report the per-page score + the global mean.

## Output schema (per scope/agent)

```json
{
  "scope": "<route group, e.g. /admin/dashboard>",
  "score": 0,
  "summary": "<one paragraph>",
  "findings": [
    { "severity": "P0|P1|P2", "dimension": "D1..D9",
      "file": "src/...", "location": "line/symbol",
      "issue": "what drifts from the DS canon",
      "fix": "the token-only / primitive correction" }
  ]
}
```

## Portfolio = canon SEED, not an audit target (READ-ONLY)

`/portfolio` (`src/app/(product)/portfolio/*` + `portfolio.css` + the `.pf-*`
vocabulary + `WidgetShell` + the view-state contract) is the **most-tokenized
surface and the designated seed of the next design system** (decision 2026-06-21:
"le nouveau DS partira de portfolio"). It shares the SAME foundation (one green
#A7FB90, `--ct-*`, dark-only) but carries its own, more advanced page vocabulary.

Therefore the conformance audit treats portfolio as a **second reference, not a
deviation**:
- **Never `--fix` it.** Its zero-state DOM is frozen (`docs/PORTFOLIO_ZERO_CONTRACT.md`).
- Audit it **read-only** for awareness only (token purity), and report it as
  `reference` — convergence flows *toward* portfolio, not away from it.
- A `.pf-*` class or a portfolio-local pattern on the portfolio page is **not** a
  "re-implemented primitive" finding — it is canon.

## Do NOT flag (intentional — known exceptions)

- **`/admin/design-system` itself**: Section F "cage-in-cage" DON'T demo nests glass
  on purpose; the anti-pattern cards *describe* forbidden effects in text. Its
  product-pattern examples are labelled "Design System example" — not real data.
- **Primitive-internal** chrome: `ct-shadow-soft` on `Badge`/`ProvenanceBadge`, the
  primary `Button` accent glow — they live in the primitive, are canon, out of scope.
- **`src/lib/cockpit-tokens.ts`** raw hex (PDF/Privy/registry — can't read CSS vars).
- **Dashboard ambient light**: the green PNG/nappes behind `/admin/dashboard` is a
  deliberate product direction (see `cockpit.css` signed comment) — not a "green wash".
- **Unwired-but-built** components (GlobalSearch ⌘K, ShortcutsOverlay, etc.) are not
  dead code — don't flag as "unused".
- **Portfolio** — see the dedicated section above (canon seed, read-only, never fixed).

## Guardrails for any agent acting on this

- Read-only audit by default. **No** `git add/commit/push/reset`.
- If `--fix`: token-only / primitive-swap fixes, **worktree-isolated**, surgical, no
  behaviour change, no new token/colour/glow/`dark:`. Leave the frozen zero-state and
  Section F demo untouched. Show the consolidated diff; do not auto-commit.
