# Hearst Connect — Design System (base de vérité)

> Dérivé du dashboard corrigé + `@hearst/cockpit-shell/tokens.css` (source amont :
> `~/.claude/assets/cockpit/SPEC.md`). **Ne jamais réinventer ces valeurs.**
> Toute nouvelle page produit (scenario-lab, proof-center, investor-memo) se
> construit contre ce document. Dernière révision : 2026-05-19.
>
> **🔒 VERROU** : le DS est figé depuis 2026-05-20. Règles anti-hardcode et process
> d’ajout de token : [`README.md`](../README.md) § Design system. **Source unique
> runtime** : Cockpit (`--ct-*`) — pas de second design system (`@ds/core` retiré).

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

**🔒 Règles dures** (CI/audit) :
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

Sans/mono = **Satoshi** (`--font-sans`/`--font-mono`). Échelle
`--text-micro .6875 → --text-5xl 3.75rem`. Poids `400/500/600/700/800`.
Chiffres : `font-variant-numeric: tabular-nums` obligatoire. Tracking titres
`-0.02em`. Labels : `uppercase` + `letter-spacing .08em` + `--ct-text-muted`.

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

Trois niveaux de surface — ne pas les confondre. **Règle canonique** :

> **Empty states replace active module surfaces; they are not rendered inside
> active module surfaces.**

### 9.1 Active module surface

**Quand** : vraie donnée disponible · action disponible · preuve disponible ·
chart réel · module opérationnel.

**Exemples** : `.dash-cell-premium` · `.ct-card` · `.glass-panel` ·
`MergedSurface` (section shell quand elle porte du contenu actif).

**Interdit** : ne pas utiliser pour un **module entièrement vide** (pas de
données principales). Une card noire + header + badge + placeholder intérieur
= faux signal d'activité.

### 9.2 Nested evidence surface

**Quand** : détails **à l'intérieur** d'une card active déjà peuplée — proof
rows · metric breakdowns · evidence panels · alertes status localisées.

**Exemples** : `NestedPanel` · `ProofRow` · `.ct-nested-callout` ·
`Metric variant="nested"`.

**Interdit** : ne pas utiliser comme **faux empty state** quand la card entière
est vide. Si les données principales manquent, ne pas rendre une card active
avec un `NestedCallout` dedans.

### 9.3 Empty / awaiting surface

**Quand** : absence de données principales · awaiting first snapshot · awaiting
first position · awaiting attestation · chart sans data · module non initialisé.

**Composants** (Portfolio, noms locaux — pas de promotion `ct-*` pour l'instant) :

| Composant | Classe CSS | Usage |
|---|---|---|
| `EmptyChartState` | `.pf-empty-chart` | Zone chart/donut/calendrier sans data |
| `AwaitingMetricState` | `.pf-empty-widget` | Widget métrique / pulse sans snapshot |

Styles : `src/app/(product)/portfolio/portfolio.css` (scopé `.pf-container`).

**Obligatoire** : si les données principales d'un widget sont absentes, le
widget rend **directement** l'état vide léger — **pas** :

- `dash-cell-premium` / header actif / badge Stale ou provenance
- chart label actif · rows vides · SVG/chart fantôme
- `ct-nested-callout` dans une card active
- double message · N/A répété ligne par ligne
- valeurs fallback hardcodées présentées comme actives

**Interdits empty state** :

- pas de `dash-cell-premium` ni `ct-card` / `glass-panel` complet
- pas de badge Stale / provenance sur le placeholder
- pas de `border-dashed` (sauf vraie dropzone upload)
- pas de `ct-surface-1` imbriqué
- pas de SVG/chart fantôme

**Exemple accepté** (allocation vide) :

```html
<div role="note" class="pf-empty-chart pf-empty-chart--round …">
  <span class="body-xs ct-text-faint">Allocation will appear after the first active position.</span>
</div>
```

**Garde-fous** : `src/components/portfolio/__tests__/empty-state-rendering.test.tsx`
verrouille le contrat structurel (pas de shell actif autour du message vide).

**Promotion future** : quand le pattern sera généralisé hors Portfolio, renommer
`pf-empty-*` → tokens Cockpit globaux — documenter ici avant migration.
