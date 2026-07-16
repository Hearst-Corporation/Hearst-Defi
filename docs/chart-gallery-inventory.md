# Chart Gallery Inventory

| Chart | Chemin | Bibliothèque | Animation | Responsive | Usage actuel | Usage recommandé |
|-------|--------|--------------|-----------|------------|--------------|------------------|
| Projection - Area | `src/components/admin/product-workspace/chart-gallery.tsx` | Recharts | Oui (Recharts) | Oui (`ChartContainer`) | Demo | Accumulation BTC dans le temps (Area chart détaillé avec sources Mining + Strategic) |
| Monthly distribution - Bar | `src/components/admin/product-workspace/chart-gallery.tsx` | Recharts | Oui | Oui | Demo | Crédits mensuels (Bar chart), ou Activity / Mining production |
| Allocation - Pie | `src/components/admin/product-workspace/chart-gallery.tsx` | Recharts | Oui | Oui | Demo | Strategy Composition (Donut / Pie) - Mining, Reserve, Liquidité |
| Profile - Radar | `src/components/admin/product-workspace/chart-gallery.tsx` | Recharts | Oui | Oui | Demo | `LEGACY` - Ne correspond pas à l'histoire d'accumulation |
| Trend - Line Step | `src/components/admin/product-workspace/chart-gallery.tsx` | Recharts | Oui | Oui | Demo | Accumulation BTC / product progress |
| Trend - Line Dots | `src/components/admin/product-workspace/chart-gallery.tsx` | Recharts | Oui | Oui | Demo | Trajectoire d'accumulation avec points de rebalancing vérifiés |
| Stacked - Bar | `src/components/admin/product-workspace/chart-gallery.tsx` | Recharts | Oui | Oui | Demo | Sources d'accumulation (Stacked columns: Mining vs Strategic) |
| Allocation - Radial | `src/components/admin/product-workspace/chart-gallery.tsx` | Recharts | Oui | Oui | Demo | `REUSABLE` - Option alternative pour la composition stratégique |

## Classification

- **AreaChart (Projection - Area)**: `CANONICAL`
- **PieChart (Allocation - Pie)**: `CANONICAL`
- **BarChart (Stacked - Bar)**: `CANONICAL`
- **LineChart (Trend)**: `CANONICAL`
- **RadialBarChart**: `REUSABLE`
- **RadarChart**: `LEGACY` / `DELETE`

## Mapping Produit

### Dashboard
- **BTC accumulé**: `AreaChart` pleine largeur (Area - projection band).
- **Répartition stratégique**: `PieChart` (Allocation - pie) sous forme de donut.
- **Mining pulse**: `BarChart` (Monthly distribution).
- **Progression produit**: Adaptations simples des `Progress` existants.

### Bitcoin
- **Accumulation dans le temps**: `AreaChart` détaillé (le même que Dashboard).
- **BTC issu du mining vs stratégie**: `BarChart` empilé (Stacked - Bar).
- **Composition actuelle**: `PieChart` (Donut).
