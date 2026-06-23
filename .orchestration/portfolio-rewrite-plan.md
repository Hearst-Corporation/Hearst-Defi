# Plan de Refonte Portfolio - Orchestration

## Contexte
Refonte architecturale du module portfolio suite à 283 commits chaotiques (57 fixes, 15 refactors) et accumulation de dette technique.

## Objectifs
1. **Modularité**: Composants <150 lignes
2. **Séparation des concerns**: Data / UI / Geometry séparés
3. **Zero duplication**: Formatters, icônes, couleurs centralisés
4. **CSS atomique**: Remplacer le monolithe 2922 lignes

## Architecture Cible

```
src/
├── app/(product)/portfolio/
│   ├── page.tsx              # Orchestration seule
│   └── layout.tsx            # Minimal
├── components/portfolio/
│   ├── _core/                # Infrastructure partagée
│   │   ├── PfCockpitPanel.tsx
│   │   ├── PfPanelHeader.tsx
│   │   └── usePortfolioData.ts
│   ├── chart/                # Géométrie SVG isolée
│   │   ├── ValueChart.tsx
│   │   ├── geometry/
│   │   │   ├── project.ts
│   │   │   ├── smoothPath.ts
│   │   │   └── areaFromLine.ts
│   │   └── components/
│   │       ├── ChartSvg.tsx
│   │       ├── DistributionMarkers.tsx
│   │       └── ValueTooltip.tsx
│   ├── yield/                # Capital & Yield décomposé
│   │   ├── CapitalYield.tsx
│   │   ├── AllocationDonut.tsx
│   │   ├── YieldLedger.tsx
│   │   └── hooks/
│   │       └── useAllocationHover.ts
│   ├── positions/
│   │   ├── PositionsList.tsx
│   │   ├── PositionCard.tsx
│   │   └── PositionKPIs.tsx
│   ├── distributions/
│   │   ├── DistribCalendar.tsx
│   │   └── MonthCell.tsx
│   └── status/
│       ├── PortfolioStatus.tsx
│       └── StatusIndicators.tsx
├── lib/portfolio/
│   ├── formatters/           # Centralisé
│   │   ├── formatCurrency.ts
│   │   ├── formatDate.ts
│   │   └── formatApy.ts
│   ├── geometry/             # Extrait de value-chart
│   │   ├── types.ts
│   │   ├── project.ts
│   │   ├── smoothCurve.ts
│   │   └── svgConstants.ts   # VB_W, VB_H, etc.
│   └── data/
│       ├── loadPortfolio.ts
│       └── calculateTotals.ts
└── styles/portfolio/
    ├── _tokens.css           # Variables locales
    ├── _layout.css           # Grid/flex structures
    ├── _chart.css            # SVG styles
    └── _components.css       # Widgets spécifiques
```

## Phases d'exécution

### Phase 1: Fondations (1-2h)
- [ ] Créer structure dossiers
- [ ] Extraire constants SVG
- [ ] Centraliser formatters
- [ ] PfCockpitPanel refactor

### Phase 2: Chart (2-3h)
- [ ] Découper value-chart.tsx
- [ ] Extraction géométrie pure
- [ ] Tests unitaires geometry

### Phase 3: Yield (1-2h)
- [ ] Séparer donut vs ledger
- [ ] Hook useAllocationHover

### Phase 4: Positions (1h)
- [ ] Décomposition PositionsList

### Phase 5: CSS (2h)
- [ ] Découper 2922 lignes
- [ ] Tokeniser valeurs restantes

### Phase 6: Intégration (1-2h)
- [ ] Nouvelle page.tsx
- [ ] Tests d'intégration
- [ ] Clean anciens fichiers

## Guardrails

### Non-négociables
- APY toujours en range ("9.4-12.8%")
- Pas de "guarantee/promise/certain"
- Provenance badges obligatoires
- Zero-state honnête (pas de faux Live)

### STOP conditions
- Test cassé = pause
- Typecheck failed = pause
- >150 lignes par composant = redécouper
- Magic number détecté = constante

### Validation obligatoire chaque phase
```bash
pnpm typecheck
pnpm test src/components/portfolio
pnpm test src/lib/portfolio
```

## Prompts par phase

Voir fichiers:
- `prompt-phase-1.md`
- `prompt-phase-2.md`
- `prompt-phase-3.md`
- `prompt-phase-4.md`
- `prompt-phase-5.md`
- `prompt-phase-6.md`
