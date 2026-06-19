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

### Colonne chart — `ValueChart` (`mode="zero"`)
- Panel `.pf-value-chart` (PAS de classe `--cta-only` : il n'y a **plus** de CTA).
- Titre **« Portfolio value »**, sous-titre **« Awaiting first position »**.
- Ghost chart : `<AreaChart muted>` → un `<polyline>` accent atténué + month labels.
- Disclaimer **« Placeholder chart until your first confirmed position. »**
- **INTERDIT** : tout CTA (« Get started », « Subscribe to … », bouton onboarding),
  toute string « No active positions yet » dans le **hero**, toute classe `pf-next-action-card*`.

### Colonne sidebar — `.pf-hero-sidebar.pf-hero-sidebar--zero`
Trois groupes, tous en `mode="zero"`, dans cet ordre :
1. `HeroKpiTable` → blurb « No position yet — metrics appear after your first confirmed deposit. »
2. `HeroPayoutRail` → valeur « — », méta « Cycle pending » (**pas de barre 0 %** — compact).
3. `HeroLiquidityRail` → méta « 60-day soft lock shown after deposit » (**pas de barre 0 %**).

### Autres widgets zero (honnêtes, pas de fausse data « Live »)
`ZERO_YIELD_STACK`, `zeroProofPulseProps`, `buildZeroDistribEntries` ;
provenance badges masqués (pas de « Live »/« Verified » faux).

## Contrat de hauteur (viewport-fit)
En `@media (min-width:80rem) and (min-height:52rem)` le cockpit est **no top-level scroll** :
les rangées sont cappées en flex, les cells ont `overflow:hidden`. **Tout panneau doit
honorer `min-height:0` dans ce gate.** Un `min-height` fixe est un plancher SCROLL-MODE
uniquement — neutralisé à `min-height:0` dans le gate.

**1280×800 (50rem h)** : sous le gate → **scroll main autorisé** (homogène avec dashboard /
proof / scenario lab — tous les hubs produit utilisent 52rem).

> **Garde-fou exécutable** : `e2e/portfolio-zero-layout.spec.ts` — à **1536×900** et
> **1600×850** (≥52rem) : pas de scroll top-level, disclaimer + 3e rail non rognés.
> À **1280×800** : éléments zero visibles, pas de scroll horizontal.

## Architecture (où « le zero » est défini)
**Un seul discriminant** `PortfolioViewState` dans `portfolio-view.ts`
(`{kind:'preview'} | {kind:'live'}`) + `heroWidgets.{value,metrics,payout,liquidity} = {mode, provenance}`
résolu une fois. Les composants hero consomment `mode` (+ `provenance` pour les rails),
ne re-calculent PAS `showZeroShell`. Les widgets mid/trio migrent sous le même pattern
(Phase 3).
