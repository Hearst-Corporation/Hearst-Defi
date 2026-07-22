# Series1 Hybrid Command Center V3 — Implementation Plan

## 1. Mapping DS → Composants Series1

| Pattern nécessaire Series1 | Pattern DS correspondant | Composant existant repo | À créer / adapter |
| :--- | :--- | :--- | :--- |
| **1. Header compact** | `panel-header` (avec `badge` et `btn`) | `DashboardPanelHeader` | Adapter `Series1DashboardHero` ou créer `Series1DashboardHeader` |
| **2. Hero command center** | `surface-hero`, `dc-halo`, `ambient-grid` | Aucun natif | Créer `Series1DashboardHero` (refonte) |
| **3. BTC inventory block** | `kpi-cell is-featured`, `t-kpi`, `t-eyebrow` | `Metric` (partiel) | Intégrer dans `Series1DashboardHero` |
| **4. Flow spine** | SVG avec `dc-halo` et palette `accent`/`zinc` | Aucun | Créer `Series1FlowSpine.tsx` |
| **5. Status rail** | `list-item`, `divide-y` ou `kpi-band` | `Card`, `Table` | Créer `Series1StatusRail.tsx` |
| **6. Data rail** | `kpi-band`, `kpi-cell`, `gap-px` | Aucun (`kpi-band` absent du repo) | Créer `Series1DataRail.tsx` |
| **7. Reserve trajectory chart** | `chart-frame`, `grid-line`, `axis-text` | Aucun (graphique vide premium) | Créer `Series1ReserveTrajectory.tsx` |
| **8. Evidence stepper** | `stepper`, `step`, `step-icon` | `StepTimeline` (vertical uniquement) | Adapter/Créer `Series1EvidenceStepper.tsx` (horizontal/vertical) |
| **9. Provenance strip** | `row between`, `mono`, `ink-3` | `ProvenanceBadge` | Créer `Series1ProvenanceStrip.tsx` |
| **10. Mobile layout** | `grid-auto`, `stack`, `stepper` vertical | Tailwind `flex-col`, `grid` | Gérer le responsive dans `Series1Dashboard.tsx` |

## 2. Règles DS à respecter
- **Aucun mini design system parallèle** : Utilisation stricte des tokens `--ct-*` existants.
- **Pas de CSS brut dispersé** : Les styles spécifiques (comme le SVG) utiliseront les variables CSS du DS.
- **Pas de raw hex en TSX** : Vérifié par `ds-layout-audit.mjs`.
- **Surfaces** : Respect de la hiérarchie `surface-hero` (Hero), `panel` (Cartes), `page-bg` (Fond).
- **KPI Bands** : Implémentation via `gap-px` et fond `separator` pour éviter les bordures lourdes.
- **Graphiques** : Palette `accent` (Hearst Green) + `zinc`, avec `btc` (Orange) uniquement pour Bitcoin.
- **Cockpit** : Pleine largeur, pas de `max-width` arbitraire.

## 3. Fichiers React à créer / adapter
- `src/components/series1-dashboard/Series1AssetIcon.tsx` : Icônes SVG inline (BTC, USDC, Hearst) utilisant les tokens de couleur.
- `src/components/series1-dashboard/Series1FlowSpine.tsx` : Le graphique SVG central avec `dc-halo` et gradients.
- `src/components/series1-dashboard/Series1DataRail.tsx` : Le composant KPI Band.
- `src/components/series1-dashboard/Series1StatusRail.tsx` : Les listes de statuts (Allocation, Mining, Contract).
- `src/components/series1-dashboard/Series1ReserveTrajectory.tsx` : Le faux graphique avec état "Awaiting telemetry".
- `src/components/series1-dashboard/Series1EvidenceStepper.tsx` : Le stepper horizontal/vertical.
- `src/components/series1-dashboard/Series1ProvenanceStrip.tsx` : Le footer de provenance.
- `src/components/series1-dashboard/Series1Dashboard.tsx` : Assemblage final.

## 4. Données
- Si la donnée manque : "Not reported", "Awaiting v2.1", "Legacy mode", "Pending", "Not indexed".
- Jamais de zéro inventé, jamais de courbe fake.

## 5. Validation prévue
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test:sqlite:isolated`
- `node scripts/ds-layout-audit.mjs`
