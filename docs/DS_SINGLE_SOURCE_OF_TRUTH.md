# DS Single Source of Truth — Hearst Connect

> **Created:** 2026-06-25  
> **Purpose:** Prevent double sources. Any visual direction (including HTML mockups
> such as `hearst-ds-premium-v4-visual-upgrade.html`) must be absorbed into the
> canonical code layers below — never maintained as a parallel active reference.

---

## 1. The hierarchy (in cascading order)

| Layer | What lives here | Files |
|---|---|---|
| **1 — Token values** | Every raw value: colours, sizes, spacing, radius, motion, opacity, z | `cockpit-shell/tokens.css` (base) → `src/app/cockpit.css` (11 runtime overrides) |
| **2 — Tailwind aliases** | `--color-*`, `--text-*`, `--font-*`, `--tracking-*`, `--leading-*` mirrored 1:1 from `--ct-*` | `src/app/globals.css` `@theme` block |
| **3 — Primitive components** | `Button`, `Card`, `Badge`, `ProvenanceBadge`, `Metric`, `MetricGrid`, `EmptySurface`, `PanelStatus`, `Skeleton`, `NestedPanel`, `DataRow`, `ProofRow`, `DashboardPanelHeader`, `SegmentedControl`, `ApyRange`, `Ptai`, `Progress`, `Tooltip`, `ConfirmDialog`, `Modal`, `Checkbox`, `ChoiceCard`, `WizardStepProgress`, `ChartTimeSelector`, `PresetPicker` | `src/components/ui/*.tsx` |
| **4 — Shell primitives** | Title, KpiGrid, KpiCard, Eyebrow, Sub — shell-scoped display wrappers | `cockpit-shell/src/primitives/index.tsx` |
| **5 — Pattern CSS** | Surface nesting rules, chart patterns, doc-flow, portfolio density mode, cockpit dense mode | `src/app/cockpit.css`, `src/app/doc-flow.css`, `src/app/(product)/portfolio/portfolio.css` |
| **6 — Living documentation** | Rendered reference (open before any UI work). Text description of every layer above. | `src/app/admin/design-system/` (route), `docs/DESIGN_SYSTEM.md`, `docs/CSS_INDEX.md`, `docs/DS_SHELL_CONTRACT.md`, `docs/DS_CONFORMANCE_PROMPT.md` |
| **7 — Architecture decisions** | Why a decision was made (append-only). | `docs/decisions/ADR-013-*.md`, `ADR-015-*.md` |
| **8 — DS bundle (snapshot)** | Compiled read-only snapshot for external consumers. **Not the source.** Needs `_ds_needs_recompile` cleared after any primitive change. | `ds-bundle/` |

**In case of conflict between layers: lower number wins.**  
Example: if `docs/DESIGN_SYSTEM.md` says one thing and `src/components/ui/badge.tsx` does
another, the implementation in layer 3 is correct and the doc (layer 6) must be updated.

---

## 2. What "absorbing a visual direction" means

When a new visual direction arrives (HTML mockup, Figma, screenshot, description):

1. **Identify the gap.** Map each visual concept to a layer (token / primitive / pattern / doc).
2. **Token gaps** → add or update a `--ct-*` token in `cockpit-shell/tokens.css` (base) or
   `cockpit.css` (runtime override). If it's a product override, add to `ds-token-allowlist.json`.
3. **Shape / primitive gaps** → update the component in `src/components/ui/`. Update the DS page
   section that documents it (`src/components/admin/design-system/section-*.tsx`).
4. **Composition gaps** → add a CSS pattern in the appropriate `.css` file; annotate with a
   reference to the motivating direction (one-line comment max).
5. **Documentation** → update `docs/DESIGN_SYSTEM.md` + `/admin/design-system` section.
6. **Archive the original.** Move or annotate the source HTML/mockup as `docs/archive/` — it is
   read-only reference material, not a living source.

**What NOT to do:**
- Do not copy-paste HTML/CSS from a mockup into the app. Extract the intent, implement via tokens.
- Do not create a parallel `v4-*` CSS namespace. If a value is new, it gets a `--ct-*` token.
- Do not create duplicate token definitions. If a token exists, update it in place.
- Do not hardcode colours in JSX. Even one-off design experiments go through `--ct-*` tokens.

---

## 3. V4 visual direction — absorption map

Reference: `hearst-ds-premium-v4-visual-upgrade.html` (visual direction, not yet in repo).

| V4 concept | Final source in repo | Action required | Priority |
|---|---|---|---|
| **More accent green — peps, energy** | `--ct-accent` `#A7FB90` already canonical. More green usage in titles via `--ct-title-1/2/3` | ✅ **Lot A done** — `.h3` + kicker + hairline + `.stat-value` already accent (portfolio canon). H1/H2 stay white by design (cockpit instruments, not bloating titles). No code change needed; confirmed. | Lot A |
| **Huge expressive numbers** | `.stat-value` class + `--ct-text-display-fixed` (32px) / `--ct-text-3xl-fixed` (24px). Scale exists; expressiveness = weight 800 + `--ct-tracking-tighter` | ✅ **Lot A done** — added `--ct-text-hero` (40px) tier + Tailwind mirror `text-hero`; added `font-feature-settings:"tnum","ss01"` to `.stat-value` (tabular-nums was already present) | Lot A |
| **Typography data — expressive** | `--ct-text-display` clamp (28→34px) exists. `.stat-value` in `cockpit.css`. `--ct-tracking-tighter` on KPI values | Document display-tier usage in DS page Section A (typography sub-section) | Lot B |
| **Chart curves / SVG assets** | `--ct-figma-accent-area-top/bottom` tokens exist (chart area wash). `chart-disclaimer-underlay.tsx`. `ChartTimeSelector` primitive | ✅ **Lot A done** — added `--ct-chart-curve-color` (→ accent), `--ct-chart-area-top/bottom` (→ figma area wash) semantic aliases; canonical curve+area recipe documented in `docs/DESIGN_SYSTEM.md §5.1`. Existing charts migrate to the aliases in Lot B. | Lot A |
| **Fintech premium desirable feel** | Surface model already graphite + ambient green glow on shell (signed in `cockpit.css`). Premium = density + contrast | Increase surface contrast where needed via `--ct-surface-*` tier; not a new system | Lot B |
| **Accent glow on shell / hero** | Ambient light behind dashboard already exists (`cockpit.css` signed comment). NOT on panels | ✅ **Lot A done (doc)** — glow-stays-shell-only rule added as `docs/DS_SHELL_CONTRACT.md §5 Glow / Ambient`. No render change. | Lot A (doc only) |
| **Radial gradient / spatial background** | `.ct-spatial-root` + `cockpit.css` ambient gradient already exists | ✅ **Lot A done** — added `--ct-ambient-stop-1/2` semantic aliases over existing `--ct-ambient-glow-bg-top/bottom` (no new value, no render change). | Lot A |
| **Component constellation view** | `/admin/design-system` Section C (Components). Already exists with live primitives | Enhance Section C to show Metric + ProvenanceBadge + ApyRange composed together | Lot B |
| **Agent board visual** | `/admin/design-system` doc + DS conformance doc. Existing Section E (States) | Add agent-board pattern to Section D (Patterns) | Lot B |
| **Final poster / reference specimen** | `/admin/design-system` Section A (Foundations) — already shows colour swatches, type scale, spacing | Add a "hero specimen" block to Section A showing the full fintech premium language | Lot B |
| **V4 surface layers** | `--ct-surface-0/1/2/3` already canonical opaque charcoal tiers | ✅ **Lot A done (confirm)** — `--ct-surface-0..3` charcoal tiers unchanged, allowlisted, contrast step intact. No token change. | Lot A (doc only) |

---

### 3.1 Lot A — tokens added (token + primitive bridge, 2026-06-25)

These tokens were added to `src/app/cockpit.css` `:root` (runtime source) to bridge
the V4 direction. All are **new** (no drift vs `tokens.css`), all alias an existing
canonical value or extend the scale — none duplicates a value or introduces a 2nd green.

| Token | File | Value / alias | V4 concept | Mirror |
|---|---|---|---|---|
| `--ct-text-hero` | `cockpit.css` | `2.5rem` (40px) | Huge expressive hero number | `--text-hero` in `globals.css @theme` (byte-identical) |
| `--ct-chart-curve-color` | `cockpit.css` | `var(--ct-accent)` | Chart curve stroke | — |
| `--ct-chart-area-top` | `cockpit.css` | `var(--ct-figma-accent-area-top)` | Chart under-curve wash (top) | — |
| `--ct-chart-area-bottom` | `cockpit.css` | `var(--ct-figma-accent-area-bottom)` | Chart under-curve wash (bottom) | — |
| `--ct-ambient-stop-1` | `cockpit.css` | `var(--ct-ambient-glow-bg-top)` | Spatial radial near stop | — |
| `--ct-ambient-stop-2` | `cockpit.css` | `var(--ct-ambient-glow-bg-bottom)` | Spatial radial far stop | — |

Primitive change: `.stat-value` gained `font-feature-settings:"tnum","ss01"`
(expressive numerals; `tabular-nums` was already present). No page/product surface
was touched in Lot A — wiring consumers (charts → curve aliases, hero KPI → `--ct-text-hero`)
is **Lot B**.

---

## 4. Token contract (immutable rules)

These rules are enforced by CI (`scripts/ds-token-drift.mjs`, `scripts/ds-layout-audit.mjs`):

1. **One green.** `--ct-accent` `#A7FB90` is the only green in the UI. `--ct-status-success` aliases it. No second green.
2. **No raw hex in `src/**/*.tsx|ts|css`** (exceptions: `src/lib/pdf/pdf-palette.ts`, `src/lib/brand-constants.ts`).
3. **Token cascade order.** `cockpit-shell/tokens.css` → `cockpit.css` → `globals.css @theme`. Runtime value = highest specificity. Edit base values in `cockpit-shell/tokens.css`; product-specific overrides in `cockpit.css`.
4. **Allowlist-gated drift.** `cockpit.css` may override only the 11 tokens listed in `scripts/ds-token-allowlist.json`. New override = must add to allowlist first.
5. **No `--ds-*` namespace.** All tokens are `--ct-*`. If you feel the urge to create a `--v4-*` or `--ds-*` token, it's a signal to find or create the `--ct-*` equivalent.

---

## 5. What an agent must do before creating a new class or token

**Read first (in this order):**
1. `docs/CSS_INDEX.md` — which file owns which surface.
2. `docs/DESIGN_SYSTEM.md` — colour/type/surface canon.
3. `src/app/admin/design-system/page.tsx` + rendered `/admin/design-system` — live primitive reference.
4. `docs/DS_CONFORMANCE_PROMPT.md` — the 9 dimensions every surface must pass.

**Then ask yourself:**
- Does a `--ct-*` token already express this value? → Use it.
- Does a primitive in `src/components/ui/` already express this pattern? → Use it.
- Is this a product override of a shell token? → `cockpit.css` + `ds-token-allowlist.json`.
- Is this genuinely new? → Add a `--ct-*` token in `cockpit-shell/tokens.css`, document in DS page.

**Forbidden shortcuts:**
- `color: #hex` in JSX / TSX / CSS — always a P0 regression.
- A new class whose value duplicates an existing `--ct-*` token.
- A shadow / glow on a content panel (only allowed on the shell ambient layer).

---

## 6. Prohibited parallel sources

The following must NEVER be treated as a living active source:

| Item | Status | Reason |
|---|---|---|
| `hearst-ds-premium-v4-visual-upgrade.html` | **Archived visual reference** — to be absorbed as per §3, then moved to `docs/archive/` | Direction is absorbed into tokens + primitives. HTML has no runtime status. |
| `ds-bundle/` | **Read-only compiled snapshot** | Source is `cockpit-shell/` + `src/components/ui/`. `ds-bundle/` is the output, not the input. |
| Any `v4-*`, `--ds-*`, `heritage-*` CSS namespace | **Forbidden** | All values live in `--ct-*` tokens. |
| A second `tailwind.config.js` | **Forbidden** | Theme lives in `globals.css @theme` block only. |
| Figma tokens JSON (not reconciled with `cockpit-shell/tokens.css`) | **Forbidden as a runtime source** | Figma values land in `cockpit.css` via `--ct-figma-*` tokens (already established pattern), then are promoted to `--ct-*` canonicals. |

---

## 7. When the rendered page and this doc disagree

**The rendered code wins.** This doc is the written contract; `src/components/ui/` + `/admin/design-system` are the implementation. If they diverge:
- If the code is clearly wrong (regression), fix the code and update this doc.
- If this doc is outdated, update this doc to match the code.
- Never patch this doc to retroactively justify a bad implementation.

---

## 8. Archived visual references

| File | Date archived | Direction absorbed | Absorption lot |
|---|---|---|---|
| `hearst-ds-premium-v4-visual-upgrade.html` | *(pending)* | See §3 absorption map | Lots A → C |

Move to `docs/archive/` after absorption of Lot A is validated.

---

## Cross-references

- `docs/DESIGN_SYSTEM.md` — colour, type, surface, chart, provenance canon
- `docs/CSS_INDEX.md` — map of every CSS file by feature area
- `docs/DS_SHELL_CONTRACT.md` — shell ownership, surface nesting, cage-in-cage rules
- `docs/DS_CONFORMANCE_PROMPT.md` — 9-dimension audit checklist
- `docs/decisions/ADR-013-design-system-canon-full-glass.md` — surface recipe decision
- `docs/decisions/ADR-015-ds-token-source.md` — two-layer token model
- `scripts/ds-token-allowlist.json` — allowlisted cockpit.css overrides
- `scripts/ds-token-drift.mjs` — CI drift detector
