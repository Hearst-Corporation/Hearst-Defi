# Hearst Connect — Design System (base de vérité)

> Dérivé du dashboard corrigé + `@hearst/cockpit-shell/tokens.css` (source amont :
> `~/.claude/assets/cockpit/SPEC.md`). **Ne jamais réinventer ces valeurs.**
> Toute nouvelle page produit (scenario-lab, proof-center, investor-memo) se
> construit contre ce document. Dernière révision : 2026-05-19.
>
> Guidelines tokens/primitives : [`README.md`](../README.md) § Design system.
> **Source runtime** : Cockpit (`--ct-*`) — pas de second design system (`@ds/core` retiré).

## 1. Principe

Dark-mode unique au MVP. Shell bordeaux verre dépoli. Le token `--ct-accent`
porte la couleur du produit actif ; **tous les autres accents en dérivent** via
`color-mix` → re-coloration globale d'un seul point.

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
| `--ct-surface-0..3` | `rgba(255,255,255,.02→.09)` | Verre dépoli (élévation croissante) |
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
  Exception unique documentée : `src/lib/cockpit-tokens.ts` (palette PDF print
  + Privy theme — ne peuvent pas lire de CSS vars runtime).
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
Tracking titres : `--ct-tracking-tight` (`-0.03em`). Labels KPI :
`.stat-label` / `.eyebrow` → `uppercase` + `--ct-tracking-wide` (`0.04em`) +
`--ct-text-muted`. Micro utilitaire Tailwind : `text-micro` = `ct-text-micro-size`
(9px) — préférer la classe cockpit ou les rôles `.body-xs`/`.stat-label`.

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

## 6. Primitives (`src/components/ui/`) — réutiliser, ne pas dupliquer

`card` · `metric` · `badge` · `button` · `progress` · `skeleton` ·
`provenance-badge` · `apy-range` · `ptai` · `toaster`/`client-toaster`.

- **ProvenanceBadge** sur **chaque métrique** : `live | oracle | attested | estimated | manual | stale` (non-négociable CLAUDE.md #2).
- **ApyRange** : jamais un APY point unique — toujours `low–high %` (#1).
- **Ptai** : Projection → Trigger → Action → Impact pour simulations/rebalancing (#3).
- Skeleton : importer `SkeletonCard` — ne pas redéfinir par page.

## 7. Layout produit

Rails `--ct-rail-left 88px` / `--ct-rail-right 420px` (chat Kimi, rail droit
unique — pas de chat embarqué ailleurs). Zone contenu = `.ct-page-area`
(scrollable, padding `32px 40px 80px`). Halo central :
`radial-gradient(ellipse 80% 70% at 50% 45%, accent-soft 45%+deep → deep 72%)`.
Bento dashboard : grille 12 col, gaps `1px` sur `--ct-border-soft`, cellules
`--ct-bg-deep`, `border-radius: var(--ct-radius-lg)`.

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

`ModuleChrome` / `.ct-card` / `.glass-panel` — données réelles ou **preview cockpit**
(valeurs à zéro avec `PreviewModeChip`, pas de badge `Live`/`Verified` faux).

### 9.2 Nested evidence surface

`NestedPanel` · `ProofRow` · `.ct-nested-callout` — détails **dans** une card déjà active.

### 9.3 Empty / inline placeholder (optionnel)

`EmptySurface` · `AwaitingMetricState` — messages légers **inline** dans un shell cockpit
ou seuls sur les surfaces admin/proof qui n'ont pas de preview structurale.
`PreviewModeChip` = label honnête quand le module est visible à zéro.
