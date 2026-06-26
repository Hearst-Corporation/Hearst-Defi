# Hearst Connect — Design System (base de vérité)

> **Référence rendue (prioritaire)** : [`/admin/design-system`](/admin/design-system) —
> primitives live depuis `src/components/ui/*`. Ce markdown = checklist ; en cas de
> divergence, **la page rendue gagne** (cf. `docs/DS_CONFORMANCE_PROMPT.md`).
>
> **Résolution de conflits + absorption de directions visuelles** → [`docs/DS_SINGLE_SOURCE_OF_TRUTH.md`](DS_SINGLE_SOURCE_OF_TRUTH.md).
>
> Dérivé du dashboard corrigé + `@hearst/cockpit-shell/tokens.css` (source amont :
> `~/.claude/assets/cockpit/SPEC.md`). **Ne jamais réinventer ces valeurs.**
> Toute nouvelle page produit (scenario-lab, proof-center, investor-memo) se
> construit contre `/admin/design-system` + ce document. Dernière révision : 2026-06-25
> (terminologie surfaces graphite ; ADR-013 inchangé sur le fond).
>
> Guidelines tokens/primitives : [`README.md`](../README.md) § Design system.
> **Source runtime** : Cockpit (`--ct-*`) — pas de second design system (`@ds/core` retiré).
>
> Note chantier : ce document fixe les invariants de langage visuel et
> d'honnêteté produit, mais les calibrations actives de spacing, layout, nav,
> shell et doc-flow peuvent encore évoluer directement tant qu'elles ne
> réintroduisent ni faux live ni second design system.

## 1. Principe

Dark-mode unique au MVP. Fond global noir (`--ct-bg-deep`), accent vert `#A7FB90`
(`--ct-accent`). Le token `--ct-accent` porte la couleur du produit actif ;
**tous les autres accents en dérivent** via `color-mix` → re-coloration globale
d'un seul point.

**Surfaces modules (canon visuel)** : la classe `.ct-glass-panel` est un **nom legacy**
— le rendu n'est **pas** du verre dépoli. C'est un **panneau graphite opaque plat** :
fond `--ct-graphite-subtle-bg`, bordure 1px, `backdrop-filter: none`, pas de drop
shadow externe. Voir §10 et `/admin/design-system` §A (Elevation). L'ADR-013 « full
glass » signifie **une seule recette de conteneur partout**, pas du frosted glass.

Cascade CSS : `@hearst/cockpit-shell/tokens.css` → `cockpit.css` (extensions
projet : status, radius, z-index, overrides shell) → `globals.css` (`@theme`
Tailwind v4, alias `--color-*`). Override de composant externe = `!important`
dans `cockpit.css` (pattern établi : Sonner, rails).

## 2. Couleurs (canon)

| Token | Valeur | Usage |
|---|---|---|
| `--ct-bg-deep` | `#000000` | Fond global iOS-dark, rails, cellules |
| `--ct-accent` | `#A7FB90` | **Seul vert de l'UI** (piloté ThemeAccent) |
| `--ct-accent-soft` | `accent 18% + transparent` | Halo ambiant, charts soft tone |
| `--ct-accent-strong` | `accent 82% + #fff` | Arc actif jauges/charts |
| `--ct-surface-0..3` | charcoal opaque (`#0E0F0F` → `#242428`) | Élévation croissante (tiers graphite pleins) |
| `--ct-text-strong` | `#ffffff` | Chiffres clés, titres |
| `--ct-text-primary` | `rgba(245,245,245,.92)` | Texte courant |
| `--ct-text-body` | `rgba(245,245,245,.72)` | Texte secondaire |
| `--ct-text-muted` | `rgba(245,245,245,.48)` | Labels, captions |
| `--ct-text-faint` | `rgba(245,245,245,.40)` | Disclaimers, micro |
| `--ct-border-soft / border / strong` | `rgba(255,255,255,.06/.10/.16)` | Séparateurs |
| `--ct-status-success` | `var(--ct-accent)` | Live, positif — **= accent** (un seul vert) |
| `--ct-status-warning` | `#fbbf24` | Estimated, attention |
| `--ct-status-danger` | `#f87171` | Stale, négatif |
| `--ct-status-info` | `#60a5fa` | Oracle, USDC bucket, neutre info |

**Guidelines** (CI/audit) :
- Tout hex/rgba en dehors de ces tokens dans `src/**` = **interdit**.
  Exceptions documentées (hors CSS runtime) : `src/lib/pdf/pdf-palette.ts` (PDF print),
  `src/lib/brand-constants.ts` (`CONNECT_ACCENT_HEX` — Privy/email — ne peuvent pas
  lire de CSS vars runtime).
- **Un seul vert dans l'UI web** = `--ct-accent`. Pas de Tailwind green-*, pas
  de `#4ade80`, pas d'`accent-soft` comme « couleur de catégorie alternative ».
  Pour différencier visuellement, prendre `--ct-status-info` (bleu),
  `--ct-status-warning` (orange) ou `--ct-text-faint/muted` (gris).
- Aucun `dark:` modifier (dark-only au MVP).
- Aucun `font-mono` className (Tailwind utility) — utiliser `.mono` ou
  `.tabular` (custom, ajoutent `tabular-nums` + `ss01`). `var(--font-mono)`
  CSS var reste autorisée (alias officiel vers Satoshi).

## 3. Radius / Z / Motion

`--ct-radius-sm .375 / md .5 / lg .75 / xl 1rem / full 9999px`.
Z : `base 1 · raised 10 · rail 50 · overlay/​tooltip 100 · modal 1000`.
Transition : `var(--ct-dur-base) 180ms` + `var(--ct-ease) cubic-bezier(.2,.7,.2,1)`.

## 4. Typographie

Sans/mono = **Satoshi** (`--font-sans`/`--font-mono`). Échelle cockpit
(`cockpit.css` = source ; `globals.css` `@theme` miroir 1:1) :
`--ct-text-micro` 9px (`.5625rem`) · `--ct-text-xs` 10px · `--ct-text-sm` 14px ·
`--ct-text-base` 16px · `--ct-text-lg`…`--ct-text-display` (clamp responsive).
Poids `400/500/600/700/800`. Chiffres : `tabular-nums` obligatoire (`.mono`/`.tabular`).
Tracking titres : `--ct-tracking-tight` (`-0.03em`). KPI values :
`.stat-value` → `--ct-tracking-tighter` (`-0.05em`) pour les grands chiffres,
`font-feature-settings: "tnum","ss01"` (chiffres tabulaires + set stylistique Satoshi
— numéraux expressifs, absorption V4 / SSOT §3).
**Tier hero** : `--ct-text-hero` (40px, fixe) = le chiffre unique dominant d'une
surface hero/KPI, au-dessus de `--ct-text-display-fixed` (32px). Mirroir Tailwind
`text-hero`. La value-chart garde son `--ct-text-hero-num` (48px) propre. N'utiliser
le tier hero que pour LA figure dominante, jamais en cascade.
Labels KPI : `.stat-label` / `.eyebrow` → `uppercase` + `--ct-tracking-wider`
(`0.08em`) + `--ct-text-muted`. Micro utilitaire Tailwind : `text-micro` = `ct-text-micro-size`
(9px) — préférer la classe cockpit ou les rôles `.body-xs`/`.stat-label`.

## 4.1 Typographie — Deux modes

Le projet utilise **deux modes typographiques distincts et intentionnels**. Ne jamais mélanger les classes d'un mode dans l'autre — c'est un bug de hiérarchie.

### Règle partagée : H1 = 24px fixe dans les deux modes

`--ct-text-3xl-fixed` (24px, non-clamp) est le canon absolu du H1. Aucun mode ne le contourne.

---

### Mode A — Cockpit-dense (Bloomberg terminal)

**Scope CSS** : `.pf-container` (et descendants directs `.pf-cockpit-panel`, `.pf-hero-*`)
**Source** : `src/app/(product)/portfolio/portfolio.css`
**Philosophie** : densité maximale, max info par cm², pas de headline flottant

| Tier | Classe | Token | Taille | Traitement |
|------|--------|-------|--------|------------|
| Panel / section title | `.pf-panel-title` | `--ct-text-xs` | 13px | uppercase, semibold, `--ct-accent` |
| Stat label | `.stat-label` | `--ct-text-micro` | 11px | uppercase, muted |
| Chart label | `.chart-label` | `--ct-text-nano` | 9px | muted, tabular |
| KPI value | `.pf-hero-kpi-value` | `--ct-text-xl` | 20px clamp | 800, tabular |
| Corps | `.body-xs` | `--ct-text-xs` | 13px | — |

---

### Mode B — Doc-flow (pages admin, auth, légal, scenario-lab)

**Scope CSS** : `.product-doc`, `.admin-doc`
**Source** : `src/app/doc-flow-typography.css`
**Philosophie** : hiérarchie lisible, respiration, structure par niveaux

| Tier | Classe | Token | Taille | Traitement |
|------|--------|-------|--------|------------|
| H1 | `.h1` | `--ct-text-3xl-fixed` | **24px fixe** | 600, white (`--ct-text-strong`) |
| H2 sections | `.h2` | `--ct-text-2xl` | 18→22px clamp | 600, **white (`--ct-text-strong`)** |
| H3 modules | `.h3` | `--ct-text-lg` | 15→17px clamp | 500, **`--ct-accent`** (signature portfolio) |
| H4 sub-labels | `.h4` | `--ct-text-xs` | 13px | 600, muted |
| Corps | `.body-sm` / `.body-xs` | `--ct-text-sm` / `--ct-text-xs` | 15px / 13px | — |

---

### Règles de non-mélange

- `.pf-panel-title` dans un scope `.admin-doc` = **bug** (classe cockpit-dense hors contexte).
- `.h2` avec `--ct-accent` dans un `.pf-container` = collision avec la hiérarchie dense.
- `doc-flow-typography.css` est l'autorité pour admin / auth / légal. Ne pas y redéfinir de classes `.pf-*`.
- `portfolio.css` est l'autorité pour le cockpit produit. Ne pas y redéfinir les classes `.h1`/`.h2`/`.h3` doc-flow.

---

## 5. Charts SVG — convention canonique (RÈGLE)

Tous les anneaux/jauges/donuts utilisent un cercle **circonférence = pathLength**
et la **règle dasharray** :

```
strokeDasharray = `${arc} ${C - arc}`     // arc = (valeur/100) * C
```

- Donut plein : `r="15.9155"` → C ≈ 100 ; bg `"100 0"` ; segment `${pct} ${100-pct}` + `strokeDashoffset={-cumul}` ; SVG `transform: rotate(-90deg)`.
- Jauge demi-cercle : C = 100, arc max = 50 ; bg `"50 50"` ; fg `${arc} ${100-arc}`.
- Anneaux concentriques : C réelle = `2πr` (r=36→226, 28→175, 20→125) ; fg `${arc} ${C-arc}` + `transform="rotate(-90 cx cy)"`.

**Bug interdit (corrigé 2026-05-19)** : `${arc} ${C}` (gap = circonférence
pleine) → motif qui se répète → **arcs fantômes**. Toujours `gap = C − arc`.
Dimensions SVG **carrées** (width = height) ; un viewBox carré dans un cadre
non-carré déforme le cercle en ellipse.

### 5.1 Courbe + area fill — langage chart canonique (V4 / SSOT §3)

Une courbe premium (line chart NAV/valeur, time-to-target…) consomme des tokens
**sémantiques**, jamais `--ct-accent` ni `--ct-figma-*` en direct :

| Rôle | Token | Résout vers |
|------|-------|-------------|
| Stroke de la courbe | `--ct-chart-curve-color` | `--ct-accent` (`#A7FB90`) |
| Wash sous la courbe (haut) | `--ct-chart-area-top` | `--ct-figma-accent-area-top` (accent 60%) |
| Wash sous la courbe (bas) | `--ct-chart-area-bottom` | `--ct-figma-accent-area-bottom` (accent 0% = fondu) |

Recette minimale (SVG) :

```jsx
<defs>
  <linearGradient id="curveArea" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%"   stopColor="var(--ct-chart-area-top)" />
    <stop offset="100%" stopColor="var(--ct-chart-area-bottom)" />
  </linearGradient>
</defs>
<path d={areaPath} fill="url(#curveArea)" />               {/* wash sous-courbe */}
<path d={linePath} fill="none"
      stroke="var(--ct-chart-curve-color)" strokeWidth="2" /> {/* courbe */}
```

Pourquoi des alias : un futur restyle de courbe = **un seul token** à bouger, et
l'accent reste l'accent. Pas de hex en JSX, pas de stroke `--ct-accent` direct dans
de nouveaux charts (les usages existants migrent en Lot B / reconstruction Portfolio).

## 6. Primitives (`src/components/ui/`) — réutiliser, ne pas dupliquer

`card` · `metric` · `badge` · `button` · `progress` · `skeleton` ·
`provenance-badge` · `apy-range` · `ptai` · `toaster`/`client-toaster`.

- **ProvenanceBadge** sur **chaque métrique** : `live | oracle | attested | estimated | manual | stale` (non-négociable CLAUDE.md #2).
- **Metric** = bloc atomique label/value/meta. `Metric variant="nested"` garde le
  rendu `.ct-metric-nested` dans une card/panel parent.
- **MetricGrid** = grille sémantique canonique pour les groupes KPI compacts /
  nested. `NestedKpiGrid` reste un alias rétrocompatible ; `.ct-nested-kpi-grid`
  est une classe CSS d'implémentation uniquement. Tout nouvel usage JSX
  sémantique doit préférer `MetricGrid`.
- Non-cibles MetricGrid pour l'instant : `dashboard-kpi-strip` (futur
  `MetricStrip` spécialisé), `vault-detail-kpis` (header `MetricStrip` avec CTA
  mobile), `pf-hero-*` (display/rail metrics), `admin-doc-kpi-grid-*` (alias
  page-specific à auditer séparément).
- **ApyRange** : jamais un APY point unique — toujours `low–high %` (#1).
- **Ptai** : Projection → Trigger → Action → Impact pour simulations/rebalancing (#3).
- Skeleton : importer `SkeletonCard` — ne pas redéfinir par page.

## 7. Layout produit

### Shell 3 colonnes — modèle asymétrique (« chrome fixe, centre fluide »)

Largeurs **live** (`src/app/cockpit.css` `:root`) :

| Token | Valeur | Comportement |
|-------|--------|--------------|
| `--ct-rail-left` | `6.5rem` (104px) | Verrouillé `!important` sur `.ct-rail-left` — largeur fixe, ne scale pas avec le viewport |
| `--ct-rail-right` | `22rem` (352px) | `flex-shrink: 0` ; **modes utilisateur** (persistés `localStorage`) |
| `--ct-rail-right-expanded` | `26.25rem` (420px) | Preset élargi (bouton header) |

| Mode classe | Largeur | Contrôle |
|-------------|---------|----------|
| `.collapsed` | 48px | Toggle › / ‹ |
| default (ouvert) | 352px | — |
| `.expanded` | 420px | Bouton largeur (cycle default ↔ expanded) |

| `.ct-center-panel` | `flex: 1` + `min-width: 0 !important` | Override package `min-width: 520px` — **seule colonne qui absorbe la largeur** |

**Pourquoi rails et chat ne « grandissent » pas avec le viewport** : ce n'est pas un scaling
proportionnel au `vw`. Le **rail gauche** reste à 104px fixe. Le **chat** propose trois
**presets** (48 / 352 / 420px) — le centre (`flex: 1`, `min-width: 0`) absorbe le reste.
Persistance : `cockpit:rail-right-mode` (`collapsed` | `default` | `expanded`).
La typo du centre utilise `clamp()` sur
`--ct-text-lg`…`--ct-text-display` ; micro/xs/sm/base restent fixes pour la lisibilité.

Le **chat** (`cockpit-shell/tokens.css`) utilise des tailles **px fixes** (9–15px) — hors
échelle `--ct-text-*` fluide du centre, par design (densité rail, pas de reflow headline).

**Breakpoints Connect** (`cockpit.css` ~L4615–5295) — masquage, pas resize proportionnel :

| Breakpoint | Effet |
|------------|-------|
| `≤1199px` | Chat masqué (`.ct-rail-right { display: none }`) |
| `≤900px` | Rail gauche masqué → bottom bar **56px** ; `main#main-content` `padding-bottom: 72px` |
| `≤767px` | Padding horizontal `.ct-page-area` → 16px |

Zone contenu = `.ct-page-area` (colonne flex, `main#main-content` = seul scroll, footer
pin en bas viewport). Padding live : `var(--ct-space-6)` / `var(--ct-space-7)` / bas minimal.
Halo central :
`radial-gradient(ellipse 80% 70% at 50% 45%, accent-soft 45%+deep → deep 72%)`.

Chat GPT-4.1 Master Agent = rail droit unique — pas de chat embarqué ailleurs.

Bento dashboard : grille 12 col, gaps `1px` sur `--ct-border-soft`, cellules
`--ct-bg-deep`, `border-radius: var(--ct-radius-lg)`.

Détail agent : `docs/UI_CONTEXT.md` § Shell 3 colonnes · plages CSS : `docs/CSS_INDEX.md`.

## 8. Non-négociables (rappel, CI-enforced)

APY range jamais ponctuel · provenance partout · PTAI obligatoire · zéro chat IA
produit (agents = JSON structuré) · mots interdits agents ("guarantee",
"promise", "certain", "risk-free") · engine pure-function · disclaimer "not
guaranteed" sur toute projection.

## 9. Taxonomie des surfaces (Portfolio / Cockpit)

Typographie portfolio (page `/portfolio`, source `portfolio.css`) :

| Rôle | Classe | Token |
|------|--------|-------|
| Page title | `.h1` | `--ct-text-3xl` |
| Section (live) | `.h2` | `--ct-text-xl` |
| Panel label | `.pf-hero-rail-title` | `--ct-text-micro` |
| Panel primary (chart, CTA) | `.pf-cockpit-panel__title--primary` | `--ct-text-sm` |
| Subsection | `.pf-cockpit-panel__subhead` + `.stat-label` | micro |
| KPI value | `.pf-hero-kpi-value` | `--ct-text-xl` |
| Corps | `.body-sm` / `.body-xs` | sm / xs |

Trois niveaux — hiérarchie cockpit, pas de verrou empty-vs-active :

### 9.1 Active module surface

`ModuleChrome` / `Card` (→ `.ct-glass-panel`) — données réelles ou **preview cockpit**
(valeurs à zéro avec `PreviewModeChip`, pas de badge `Live`/`Verified` faux).
**Canonical material: `.ct-glass-panel`** (ADR-013 — opaque graphite, legacy class name).

### 9.2 Nested evidence surface

`NestedPanel` · `DataRow` · `LegalMetadataRow` · `ProofRow` · `.ct-nested-callout`
— détails **dans** une card déjà active.

Row taxonomy (zéro différence visuelle) :

- `DataRow` — faits génériques label/value : deposit summary, profile facts,
  metadata simple.
- `LegalMetadataRow` — faits legal/compliance : SPV structure, regulatory
  exemption, KYC/accreditation, custody, audit, multisig.
- `ProofRow` — faits proof/provenance : attestor, evidence hash, block, tx hash,
  signature, proof-center events.

`.ct-proof-row` reste une classe CSS d'implémentation. Ne pas introduire de
nouvel usage JSX sémantique direct de `.ct-proof-row` : passer par l'un des
wrappers ci-dessus.

### 9.3 Empty / inline placeholder (optionnel)

`EmptySurface` · `AwaitingMetricState` — messages légers **inline** dans un shell cockpit
ou seuls sur les surfaces admin/proof qui n'ont pas de preview structurale.
`PreviewModeChip` = label honnête quand le module est visible à zéro.

## 10. Surface tiers (canon ADR-013 — 2026-06-12)

Source de vérité : [`docs/decisions/ADR-013-design-system-canon-full-glass.md`](decisions/ADR-013-design-system-canon-full-glass.md).

### 10.1 Tier par défaut — Graphite opaque (`.ct-glass-panel`)

**`.ct-glass-panel`** est la surface par défaut pour TOUTES les pages (produit ET admin).
`Card` (`src/components/ui/card.tsx`) est le JSX canonical qui l'applique.

Recette définie **une seule fois** dans `src/app/cockpit.css` (`--ct-graphite-*` +
`--ct-surface-*`). Rendu live :

- `background: var(--ct-graphite-subtle-bg)` — charcoal **opaque plein**
- `border: 1px solid var(--ct-graphite-border-nested)`
- `backdrop-filter: none` · `box-shadow: none`
- Hover : bordure légèrement renforcée (pas de lift, pas de wash radial)

`material="flat"` sur `Card` = **même fond opaque** ; variante pour listes denses
(anti cage-in-cage), pas « moins noir ». Aucun fichier de page ne peut redéfinir
une recette graphite localement.

### 10.2 Tier DEPRECATED — Flat / SystemPanel

`.ct-system-panel` et la logique "flat admin" (introduite dans les commits 313ca71 /
9ad2b53) sont **DEPRECATED** et ne doivent PAS être utilisés dans du nouveau code.
Les usages existants sont des cibles de migration (voir ADR-013 §Lots de migration).

Les recettes legacy `.glass-panel` et `.glass-panel-subtle` sont également
DEPRECATED et seront retirées de `cockpit.css` une fois tous les call-sites migrés.

### 10.3 Exceptions documentées (sans panneau graphite)

Les exceptions suivantes sont les **seules** departures autorisées du conteneur
`.ct-glass-panel` par défaut.
Chaque usage doit être annoté d'un commentaire inline `/* ADR-013 exception */` :

| Surface | Exception | Raison |
|---|---|---|
| Dashboard command-board dense | strip `--ct-bg-deep`, séparateurs seuls | densité opérateur |
| `.scenario-preset-bar` (Scenario Lab) | rail plat `border-bottom` seul | toolbar viewport-locked |
| `Ptai variant="flat"` | dans les panneaux compare | compare mode flat par spec |
| `EmptySurface` seul | pas de box wrapper | placeholder inline, pas de conteneur |

### 10.4 Doc-flow — couche layout unique

`src/app/doc-flow.css` est le **seul** fichier de layout document-flow.
Il porte les deux scopes `.product-doc` et `.admin-doc` (et leurs stacks/grilles).
`product-doc.css` et `admin-doc.css` sont **supprimés** après migration (Lot 3 ADR-013).

Companion typographie : `src/app/doc-flow-typography.css` (`:is(.product-doc, .admin-doc)`),
inchangé et orthogonal.

`doc-flow.css` ne définit PAS de valeurs token — uniquement des primitives layout.
Ordre d'import : après `cockpit.css`, avant `globals.css`.

## 12. Invest Flow DS taxonomy (closure — 2026-06-13)

Established after the final DS closure audit and Batch 1–2 fixes.
These rules govern the invest flow surface hierarchy as the current default. Reopen them only when a materially better layout or readability outcome clearly requires it.

### 12.1 Three-level surface hierarchy (invest flow)

**Rule: no giant outer box. Yes to internal DS modules.**

The cockpit center panel already provides the outer visible boundary.
No page-level `<Card>` or `.ct-glass-panel` wrapper should wrap an entire page or workspace shell.

#### Level 1 — Card (`ct-glass-panel`)

`<Card>` / `.ct-card.ct-glass-panel` — primary visible content modules inside a workspace or document shell.

Use for self-contained information units that need visual separation from the workspace background.

Examples in invest flow:
- Target allocation panel (Term sheet workspace, primary column)
- Regime scenarios panel (Term sheet workspace, primary column)
- Vault metrics panel (Term sheet workspace, secondary column)
- Legal & structure panel (Term sheet workspace, secondary column)

Do **not** use to wrap:
- The workspace shell itself
- A page-level container
- A flat layout column or grid row

#### Level 2 — NestedPanel (`ct-nested-panel`)

`<NestedPanel>` — compact nested summaries or detail panels inside a flow, typically within the support rail or a narrow confirmation page.

Examples in invest flow:
- Deposit summary (Step 3 deposit rail)
- Position details (Step 4 confirmed page)

Do **not** use NestedPanel as a first-level visible container — it reads as nested-inside-something even when used alone.

#### Level 3 — Flat sections / layout-only wrappers

`vault-flow-flat-section`, `invest-flow-detail__grid`, `invest-flow-detail__primary/secondary`, `product-doc-stack`, `invest-flow-shell__body` — invisible layout chrome. No background, no border, no glass.

Use for:
- Workspace body wrappers
- Two-column desktop grids
- Section separators (border-top only, no box)
- Lightweight context text blocks

These must never acquire a background color, border-radius, or shadow. If you feel the need to add one, use a Card instead.

---

### 12.2 Invest Flow shell rules (per step)

#### Step 1 — `/vaults` (Select a product)

Shell: `<InvestFlowShell step="select">` — no `workspace` prop.
Layout: document-style `--cap` (64rem max-width, centered). Natural document scroll.
Surface: `<ProductSelectCard>` wraps `<Card>` — one glass layer per vault card. No outer wrapper.
Acceptable: standard document rhythm.

#### Step 2 — `/vaults/[id]` (Term sheet / vault detail)

Shell: `<InvestFlowShell step="product" workspace>` — `workspace` prop is **required**.
Layout: viewport-fit (`100dvh`), header fixed, body scrolls internally via `.invest-flow-shell__body`. Two-column `invest-flow-detail__grid` on desktop (≥52rem), single column on mobile.
Surface: **no outer Card**. Internal Card modules only (Level 1 above).
CTA: lives in the fixed header (`.invest-flow-shell__header-cta`), plus a mobile fallback in the KPI strip.
Mobile: reverts to natural document scroll — all `:has(.invest-flow-shell--workspace)` chains reset.

#### Step 3 — `/vaults/[id]/invest` (Deposit form)

Shell: `<InvestFlowShell step="deposit">` — no `workspace` prop (intentional).
Layout: natural document scroll — correct for a form with variable height. Two-column `vault-invest-grid` at ≥48rem.
Surface: left column uses flat `vault-flow-flat-section` separators; right rail uses `<NestedPanel>` (Level 2).

#### Step 4 — `/vaults/[id]/invest/confirmed` (Confirmation)

Shell: `<InvestFlowShell step="confirmed" width="narrow" align="center">` — intentionally document-like.
Layout: natural scroll, `--narrow` (600px max), centered. Correct — this is a success state, not a workspace.
Surface: `<NestedPanel>` for position details (Level 2); flat stack for next steps.

---

### 12.3 `ct-pill` vs `Badge` / `ProvenanceBadge`

These are distinct primitives with different roles. Do not substitute one for the other.

#### `ct-pill`

Mono product tag / compact chip / identifier label.
No status semantics. Use for structured codes, tickers, and compact product tags.

Examples:
- `HYV-A` (share class ticker)
- `Strategy: Mining-backed` (compact strategy chip)
- Step eyebrow tags in the invest flow header

Class: `ct-pill` (plain) · `ct-pill accent mono` (accent ticker variant).

#### `Badge` (`src/components/ui/badge.tsx`)

Status label with color semantics. Use for lifecycle states, availability, and typed conditions.

Examples:
- `Live` / `Coming soon` / `Pending` (vault status)
- `Mining-backed` (strategy badge inside term sheet)

Variants: `default` · `success` · `warning` · `danger` · `accent` · `flat`.

#### `ProvenanceBadge` (`src/components/ui/provenance-badge.tsx`)

Evidence provenance marker. Use on every metric — mandatory per Non-negotiable #2.

Kinds: `live` · `oracle` · `attested` · `estimated` · `partial` · `manual` · `stale`.
Display modes: `default` (pill) · `compact` (dot only) · `strip` (no glass, hero KPI strip).

Do not use `ProvenanceBadge` for general status. Do not use `Badge` for data provenance.

---

### 12.4 Accepted micro-adjustment exceptions

Tailwind micro-adjustment helpers are acceptable when:
- No `--ct-space-*` token maps to the required offset, **and**
- The adjustment is sub-rem and purely local (not a layout concern)

**Accepted exceptions in vault components:**

| Class | Usage | Why |
|---|---|---|
| `mt-auto` | Push CTA to bottom of flex column | No DS token equivalent for flex push |
| `mt-0.5` | 2px nudge on inline text/icon | Sub-pixel alignment, no `--ct-space-0_5` map |
| `mx-0.5` | 2px horizontal nudge on separator dot | Same |

**Not acceptable via Tailwind arbitrary values** — must use DS utilities/tokens:
- Spacing above 0.5rem → use `--ct-space-*` via a CSS class
- Colors / backgrounds → use `--ct-*` token via a `ct-*` utility class
- Focus rings / outlines → use `ct-ring-*` (see `cockpit.css`)
- Line-height → use `ct-leading-*` (see `cockpit.css`)
- Border color → use `ct-bc-*` (see `cockpit.css`)

---

### 12.5 `product-doc-stack--tight` standalone usage

`product-doc-stack--tight` is defined as a modifier name but is **standalone-safe** under `.product-doc`.

The CSS selector `.product-doc .product-doc-stack--tight` scopes to the product-doc container regardless of whether a `product-doc-stack` parent is present. Using it without a wrapping `product-doc-stack` element is intentional and tested (confirmed page, next-steps block).

Do not rename in a future batch without updating all call-sites and the selector in `doc-flow.css`.

---

## 13. UI Hierarchy Calibration (contract — 2026-06-13)

System-level contract for visual priority, typography dominance, surface weight,
KPI attention, scroll and responsive rhythm. Complements §4 (typo tokens), §9
(portfolio surfaces), §10 (glass tiers) and §12 (invest flow). The interface must
never give visual dominance to the wrong object: **one Level-1 object per route.**

### 13.1 Four hierarchy levels

| Level | Object | Heading | Surface |
|-------|--------|---------|---------|
| **L1** | Page thesis / primary decision object | the one `<h1>` (or h1 + a KPI block *fused into the same panel*) | page header (transparent) **or** one hero panel — never a generic card |
| **L2** | Section | `<h2>` / `.h2` | unstyled labelled region |
| **L3** | Module / card / widget | `<h3>` / `.h3` (= `CardTitle`) | `ct-card` / `pf-cockpit-panel` (graphite) |
| **L4** | Row / metric / detail | `.stat-label` / `.eyebrow` (never a heading tag) | row + divider, or `Metric` cell — **not** a nested card |

Rules:
1. **Exactly one visible `<h1>` per route.** It is the page title or the thesis,
   never a card title. Page headers (`AdminPageHeader`, `ProductPageHeader`,
   `InvestFlowShell`) own the h1 — a page must **not** add a second near-duplicate
   section h2 restating the thesis (fixed on `/vaults` 2026-06-13).
2. `CardTitle` is always `<h3>` (enforced in `card.tsx`).
3. L4 items never get heading tags.
4. No skipped levels *inside* one module.
5. KPI values may not visually outrank the L1 thesis unless structurally fused
   into it (§13.4).

### 13.2 Typographic scale + dominance

Modéré spacing between levels, **green accent reserved for module / card titles (H3)**
(portfolio signature — `.pf-container h3` → `--ct-accent`) so the structure reads at
a glance. H2 section titles stay **white-strong**. The authoritative scale for doc pages lives
in `doc-flow-typography.css` (`:is(.product-doc, .admin-doc)`, which overrides
the base `.h1/.h2/.h3` in `cockpit.css` by specificity); the base classes are
aligned to the same values so non-doc surfaces match.

| Role | Class | Size | Weight | Color | Allowed | Forbidden |
|------|-------|------|--------|-------|---------|-----------|
| h1 | `.h1` | 24 fixe (`3xl-fixed`) | 600 | white-strong (`--ct-text-strong`) | one per route — page title | card titles, repeated items |
| h2 | `.h2` | 18→22 (`2xl`) | 600 | **white-strong (`--ct-text-strong`)** | section titles | page title, card titles |
| h3 | `.h3` = `CardTitle` | 15→17 (`lg`) | 500 | **green (`--ct-accent`)** | module/card titles | section titles, row labels |
| stat-value | `.stat-value` | `--ct-text-2xl` | 800 | — | KPI inside an L3 module; tracking `--ct-tracking-tighter` | first viewport when it would beat the page h1 → demote to `--ct-text-xl` |
| stat-label / eyebrow | — | `--ct-text-micro` uppercase | — | muted; tracking `--ct-tracking-wider` | labels, kickers | as headings or body |
| body-md/sm/xs | `.body-*` | `--ct-text-sm`/`xs` | — | body/muted | prose, metadata | KPI values, headlines |

**H3 = green** is the single structural accent: a module / card title (`.h3` =
`CardTitle`, native `<h3>`, `.pf-cockpit-panel__title--primary`) is the text that
carries `--ct-accent` — the propagated portfolio signature. **H2 section titles
stay white-strong** (`--ct-text-strong`); do not turn them green. `h2 ct-text-strong`
is therefore redundant (the `.h2` class is already white) — drop the modifier; the
only place it is meaningful is a modal/dialog title, where `.h2` is used for *size*
on a non-doc surface that does not inherit the doc-flow white rule.

> **Canon = the rendered page (portfolio).** Source of truth for these colors:
> `portfolio.css` (`.pf-container .h2 { --ct-text-strong }`, `.pf-container h3/.h3
> { --ct-accent }`) mirrored by `doc-flow-typography.css`. When this doc and the
> rendered page disagree, the page wins (see header). This table was corrected
> 2026-06-26 — it previously said "H2 green / H3 white", the inverse of the render.

### 13.3 Surface taxonomy — one language, two names

`ct-card` (LP/admin doc) and `pf-cockpit-panel` (portfolio cockpit) stay distinct
semantic primitives but **share identical background / border / radius / blur**
(graphite family — unified in `cockpit.css` ~L2484). The only legitimate axes of
difference are **padding tier** and **interactivity**.

| Slot | Bg | Border | Radius | Padding | Hover | Primitive |
|------|----|--------|--------|---------|-------|-----------|
| L1 hero panel | graphite-subtle | graphite-nested | `--ct-radius-xl` | display (24) | none | `Card` / `pf-cockpit-panel--wide` |
| Standard module (L3) | graphite-subtle | graphite-nested | `--ct-radius-xl` | default | overlay **only if clickable** | `ct-card` / `pf-cockpit-panel` |
| Compact / data | same | same | `--ct-radius-xl` | `--ct-space-3/4` | none | `ct-card--compact` / `pf-cockpit-panel--compact` |
| Row (L4) | transparent | `--ct-border-soft` divider | 0 | `--ct-space-2/3 × 3/5` | tint only if row links | `admin-vaults-list__row`, `pf-positions-row`, `ct-divide-soft` |
| Inline callout | status-soft | status-border | `--ct-radius-lg` | `--ct-space-3 × 4` | none | `ct-panel-status` |

**`hoverOverlay`** — a static informational card must not shimmer on hover; pass
`hoverOverlay={false}` on it. Clickable / selectable cards keep the overlay as a
hover affordance. (`Card` default stays `true` for now; cleanup is per-call-site,
not a global flip, until every site is classified.)

### 13.4 KPI attention

- KPIs may be large **only** when the KPI block *is* the L1 object.
- Animation: at most one hero viz, first-load only (portfolio donut). **No
  count-up on stat-values.** Forbidden when KPIs share a viewport with a thesis.
- When a thesis exists, KPI cards are subordinated (`.stat-value` capped
  `--ct-text-xl`) or **fused** into the thesis panel (h1/prose + shared KPI strip)
  — the `vault-detail-kpis` strip-below-stepper is the canonical fused pattern.
- Never render the same metric as both a hero stat and a card.

### 13.5 Scroll / responsive

- Page headers are **static, not sticky.** Sticky is for in-panel toolbars only.
- Page scroll preferred; internal `overflow-y` only on a bounded sub-panel
  (projection input `max-height: clamp(28rem,70dvh,36rem)` is the sanctioned case).
- Container-query-first. Mobile < 40rem: single column; KPI grids 2-up → 1-up;
  product cards flip row→column (`vault-select-card`); admin rows reflow stacked
  (`admin-vaults-list`). Every flex/grid child carries `min-width:0`; widths use
  `minmax(0, …fr)`. **No horizontal overflow.**

## 12. Token cascade — intentional overrides (cockpit.css runtime)

`cockpit.css` is a **non-layered runtime stylesheet** that takes precedence over
`cockpit-shell/tokens.css` (which is @import'd first). The following tokens are
intentionally divergent — **do not "fix" them without a DS decision**:

| Token | `cockpit-shell/tokens.css` | `cockpit.css` (wins) | Reason |
|---|---|---|---|
| `--ct-border` | thin border value | overridden | project calibration |
| `--ct-border-soft` | soft border | overridden | project calibration |
| `--ct-border-strong` | strong border | overridden | project calibration |
| `--ct-shadow-depth` | base shadow | overridden | heavier ambient depth for dark surfaces |
| `--ct-text-muted` | muted text | overridden at higher contrast | **accessibility** — cockpit.css value is more readable on `--ct-bg-deep` |

`--ct-text-muted` in particular: cockpit.css sets a slightly lighter value than
the shell token. This is intentional for accessibility on the deep black background.
Do not revert to the shell value without checking WCAG contrast on `--ct-bg-deep`.

### 12.1 Overlay & dialog tokens (added 2026-06-26)

Two new tokens added to consolidate raw rgba values (P1 DS cleanup):

```css
--ct-overlay-backdrop: rgba(0, 0, 0, 0.6);   /* .cp-backdrop background */
--ct-dialog-shadow:    0 24px 80px rgba(0, 0, 0, 0.6);  /* .cp-dialog depth shadow */
--ct-dialog-ring:      0 0 0 1px rgba(255, 255, 255, 0.04); /* .cp-dialog inner ring */
```

Usage: `.cp-backdrop { background: var(--ct-overlay-backdrop); }` and
`.cp-dialog { box-shadow: var(--ct-dialog-shadow), var(--ct-dialog-ring); }`.
No raw rgba remains in either rule.

## 13. Working log / audit summary

| Date | Commit | Note |
|------|--------|------|
| 2026-06-26 | portfolio-premium | **Portfolio Home Premium Redesign + DS P1**: Portfolio Status → KPI tile 2×2 panel; Capital & Yield → APY band visual + partial state notice; Payout Calendar → "Distribution coming" box; Positions → premium card with status chip + correct accent logic; DS P1: overlay/dialog tokens + intentional overrides documented. |
| 2026-06-13 | `66b528f` (pushed `main`) | **Mixed checkpoint — accepted as-is.** DS row taxonomy (`DataRow` / `LegalMetadataRow` / `ProofRow`) and `MetricGrid` / `NestedKpiGrid` aliases shipped in `nested-panel.tsx` + §6/§9 doc updates. Same commit also contains scenario task-flow polish (`cockpit.css`, `central-task-runner.tsx`, `single-mode.tsx`). **No history rewrite** — commit already on `origin/main`; do not reopen or split `66b528f`. Next DS family: **fresh branch + isolated commit only.**
| 2026-06-13 | Batch A | **UI hierarchy contract (§13)** + `/vaults` thesis de-duplicated (removed redundant section h2 under the shell h1). `Card` default kept `true`; `hoverOverlay` cleanup is **per-call-site** (static cards opt out, clickable cards keep it) — no global default flip yet. |
| 2026-06-26 | DS doc fix | **§4.1 + §13.2 tables corrected** to match the rendered canon (portfolio): **H2 = white-strong, H3 = green `--ct-accent`** (the propagated portfolio signature, `.pf-container h3 → --ct-accent`). The tables previously claimed the inverse (H2 green / H3 white), which never matched `doc-flow-typography.css` / `portfolio.css`. No code/render change — only the doc was wrong. `h2 ct-text-strong` modifiers dropped as redundant (kept on modal titles only). |
| 2026-06-13 | Typo scale | **Typo hierarchy reworked (§13.2)** in `doc-flow-typography.css` (+ base in `cockpit.css`): modéré size steps. *(Note 2026-06-26: this row's "H2 green / H3 white" wording was a doc error — the actual render has always been H2 white / H3 green; see row above.)* Was: flat doc scale (H1 20→24, H2 16→18 grey, H3 16 grey). Applies to every `.product-doc`/`.admin-doc` page. |
