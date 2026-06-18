# PORTFOLIO ZERO-STATE — CONTRAT FIGÉ

> **Règle d'or : ne pas re-litiger ce DOM.** Le hero zero-state du portfolio a été
> ré-écrit 3 fois en une session (ghost → CTA → ghost) parce que sa définition vivait
> implicitement dans 4 surfaces couplées (`page.tsx`, `value-chart.tsx`, `portfolio.css`,
> tests). Ce fichier EST la définition. Toute modif du zero-state passe par ici d'abord ;
> sinon on relance le flip-flop.

## Quand ?
`previewZeros === !hasPositions` (source : `isLayoutPreview()` dans
`src/lib/portfolio/layout-preview.ts`, dérivé une fois dans `src/lib/data/portfolio-view.ts`).
**Jamais forcé pour l'identité démo** (le démo a des positions → état live + `DemoDataBanner`).

## DOM figé du hero zero (verrouillé par tests)

### Colonne chart — `ValueChart` (`previewZeros`)
- Panel `.pf-value-chart` (PAS de classe `--cta-only` : il n'y a **plus** de CTA).
- Titre **« Portfolio value »**, sous-titre **« Awaiting first position »**.
- Ghost chart : `<AreaChart muted>` → un `<polyline>` accent atténué + month labels.
- Disclaimer **« Placeholder chart until your first confirmed position. »**
- **INTERDIT** : tout CTA (« Get started », « Subscribe to … », bouton onboarding),
  toute string « No active positions yet », toute classe `pf-next-action-card*`.

### Colonne sidebar — `.pf-hero-sidebar.pf-hero-sidebar--zero`
Trois groupes, tous en `previewZeros`, dans cet ordre :
1. `HeroKpiTable` → blurb « No position yet — metrics appear after your first confirmed deposit. »
2. `HeroPayoutRail` → valeur « — », barre 0 %, méta « Cycle pending · Pending », note projection.
3. `HeroLiquidityRail` → barre 0 %, méta « 60-day soft lock shown after deposit ».

### Autres widgets zero (honnêtes, pas de fausse data « Live »)
`ZERO_YIELD_STACK`, `zeroProofPulseProps`, `buildZeroDistribEntries` ;
`PreviewModeChip` ; provenance badges masqués (pas de « Live »/« Verified » faux).

## Contrat de hauteur (viewport-fit) — la classe de bug à NE PAS réintroduire
En `@media (min-width:90rem) and (min-height:52rem)` le cockpit est **no top-level scroll** :
les rangées sont cappées en flex, les cells ont `overflow:hidden`. **Tout panneau doit
honorer `min-height:0` dans ce gate.** Un `min-height` fixe (ex. la ladder chart 16→20rem)
est un plancher SCROLL-MODE uniquement — il DOIT être neutralisé à `min-height:0` dans le
gate (cf. `.pf-cockpit-row--summary .pf-value-chart` dans `portfolio.css`). Backstop :
`aspect-ratio` sur `.pf-value-chart__chart-wrapper` évite l'effondrement du SVG à 0px.

> **Garde-fou exécutable** : `e2e/portfolio-zero-layout.spec.ts` mesure qu'à 1280×800 /
> 1536×900 / **1600×850** le disclaimer + le 3e rail ne sont PAS rognés et qu'il n'y a
> aucun scroll top-level. Les tests SSR (string-match) ne voient pas ce bug — ce spec, si.

## Architecture (où « le zero » est défini)
Cible : **un seul discriminant** `PortfolioViewState` dans `portfolio-view.ts`
(`{kind:'preview'} | {kind:'live', …}`) + une map `widgets.X = {mode, provenance, props}`
résolue une fois. Les composants consomment `mode`, ne re-calculent PAS `showZeroShell`.
(Migration A du refactor D→A→E — voir le plan d'architecture.)
