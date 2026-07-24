# Series 1 — Catalyst Compliance Audit

> Audit read-only avant reconstruction des modules. **Aucun code touché, aucun commit.**
> Statut : 2026-07-24 · HEAD `09dd0334` (= origin/main) · working tree = reconstruction
> dashboard non commitée (15 fichiers) préservée.
> Règle : **Earth = Hearst.**

---

## 1. Résumé verdict

**Les composants Series 1 sont conformes aux TOKENS (`--ct-*`) mais NON conformes aux
PRIMITIVES.** Ils n'importent presque pas Catalyst pour leur contenu : ils ont bâti un
**second design-system de surface parallèle** au-dessus de `src/lib/ui/surface-classes.ts`,
qui redouble Catalyst 1-pour-1 (Card, CardHeader, Row/Table, chips de statut, KPI band).

Chiffre qui tranche — sur `series1-dashboard/**` + `series1-shell/**` :
- imports `@/components/catalyst/*` : **3** (tous shell : sidebar/navbar, zéro primitive de contenu)
- imports `@/components/ui/*` : **0**
- fichiers s'appuyant sur `surface-classes` : **6**

Les 14 primitives Catalyst cibles **existent déjà** (rien à inventer pour l'essentiel).

**VERDICT : SERIES1 CATALYST COMPLIANCE KNOWN — MODULE REBUILD BLOCKED UNTIL DS TARGET
MAP IS APPLIED.**

---

## 2. Doctrine lue

Source : `README_DESIGN_SYSTEM.md`, `src/components/catalyst/README.md`,
`src/components/ui/README.md`, guards `ds-hardcode-guard.mjs`,
`ds-convergence-guard.mjs`, `ds-layout-audit.mjs`.
(3 docs cités par le prompt absents : `DS_SINGLE_SOURCE_OF_TRUTH.md`,
`CATALYST_CANON_REFERENCE.md`, `.cursor/rules/design-system.mdc`.)

**Autorisé** : `@/components/catalyst/*` (couche canonique — Button/Badge/Table/Input/
Select/Card/Dialog/Field), `cockpit-shell` (shell/rails), tokens `--ct-*`,
`@/components/ui/*` uniquement pour usages legacy existants ou wrappers transitoires
délégant à Catalyst.

**Interdit** : nouvelle primitive visuelle dans `ui/` ; Button/Badge/Table/Input
recréés inline dans une page/feature ; raw `blue`/`zinc` comme autorité ; `#A7FB90`
hors définition de token ; un 2ᵉ vert / namespace `--ds-*` / `tailwind.config.js`.

**Exceptions charts/HIS** : `src/components/dataviz/his/**` (SVG pur) est autorisé pour
les **graphiques uniquement**. `HcChartCard`, `HcSourceBadge`, `HcAssumptionLedger` sont
des chromes de chart tolérés **scoped HIS** — jamais à réutiliser comme Badge/Card/Table
générique hors chart.

**Guards existants** : `pnpm ds:guard` (hardcode), `pnpm ds:guard:convergence`
(ui/ scellé + accent-hex + px-token + named-color), `pnpm ds:guard:all`, `pnpm ds:layout`,
`pnpm ds:classes`, `pnpm ds:token-drift`.
> Note : aucun guard actuel ne détecte « card/row/chip recréés à la main via
> surface-classes » — d'où l'invisibilité de cette dette jusqu'ici (tokens OK, primitives KO).

---

## 3. Composants conformes

| File | Verdict | Raison |
|---|---|---|
| `src/components/series1-shell/Series1Nav.tsx` | OK_CATALYST | importe Sidebar* de Catalyst, aucune primitive recréée |
| `src/components/series1-shell/Series1Shell.tsx` | OK_CATALYST | Navbar/SidebarLayout Catalyst, wrapper `.s1-shell` re-skin par tokens |
| `src/components/admin/product-workspace/asset-analytics-gallery.tsx` | OK_CATALYST | Card/CardHeader/CardContent/Table Catalyst (chip « Demo data » mineur à surveiller) |

## 4. Composants NON conformes (NEEDS_CATALYST_REFACTOR)

| File | Primitive maison recréée | Cible Catalyst |
|---|---|---|
| `series1-dashboard/Series1DashboardSection.tsx` | **RACINE** : Card / CardHeader / Inset / Row recréés via `surfaceClassName()` | `Card`, `DashboardPanelHeader`, `nested-panel`, `Metric`/`Table` |
| `series1-shell/Series1Panel.tsx` | Panel / PanelHeader / Row / RowList maison (câblé 5 routes produit) | `Card`, `DashboardPanelHeader`, `Table`/`Metric` |
| `series1-shell/Series1KpiBand.tsx` | Bande KPI 100% maison (`dl/dt/dd` + grid-gap-px) | `Metric` |
| `series1-shell/Series1Wired.tsx` | provenance chip + `Series1WiredRow` (4ᵉ variante de row) | `WiredChip`/`ProvenanceBadge` + `Table`/`Metric` |
| `series1-shell/Series1ChartPlaceholder.tsx` | `Series1ProvenanceTag` (chip) + `<figure>` chart shell | `BentoBadge`/`WiredChip` + `HcChartCard` |
| `series1-shell/Series1Timeline.tsx` | timeline/process (steps numérotés) maison | primitive timeline à créer dans Catalyst (voir §9) |
| `series1-dashboard/Series1AllocationCockpit.tsx` | Card maison + source-health chips inline + rangées dl répétées | `Card` + `PanelStatus`/`BentoBadge` + `Metric` |
| `series1-dashboard/Series1DashboardHero.tsx` | badge « Not yet reported » inline + grille KPI cells maison | `WiredChip` + `Metric` |
| `series1-dashboard/Series1BitcoinAccumulation.tsx` | Card maison + empty-state à la main | `Card` + `HcChartCard` (empty-state) |
| `series1-dashboard/Series1CapitalArchitecture.tsx` | Card maison + track vide + flow steps numérotés | `Card` + timeline primitive |
| `series1-dashboard/Series1MiningRegister.tsx` | Card maison + gated notice-well + rows maison | `Card` + `Table`/`Metric` + `PanelStatus` |
| `series1-dashboard/Series1DataState.tsx` | provenance/source chips inline (reste = logique honnêteté, OK) | `WiredChip`/`ProvenanceBadge` (chip seul) |
| `series1-dashboard/Series1Dashboard.tsx` | composition root — hérite la non-conformité de la couche `Series1Dashboard*` | (suit le refactor de la racine) |

**Duplication la plus nette** : la row label/valeur est réécrite **4×**
(`Series1DashboardSection.tsx:144`, `Series1Panel.tsx:55`, `Series1Panel.tsx:79`,
`Series1Wired.tsx:154`). Card+Header dupliqués **2×**. Chips de statut **2×**.

## 5. Wrappers temporaires tolérés (OK_WRAPPER_TEMPORARY)

| File | Raison de tolérance |
|---|---|
| `series1-shell/Series1Page.tsx` | Layout scaffolding léger (header/section/page) ; chip index de section à surveiller |
| `src/lib/ui/surface-classes.ts` | Socle de surfaces `--ct-*`. **Tolérable UNIQUEMENT s'il devient l'implémentation interne de `Card` Catalyst** — pas une API applicative parallèle. À faire converger, pas à figer. |

## 6. HIS / dataviz autorisés (OK_HIS_DATAVIZ — charts uniquement)

Tous les `src/components/dataviz/his/Hc*.tsx` : `HcBarChart`, `HcStackedBar`,
`HcValueChart`, `HcFanChart`, `HcWaterfall`, `HcCompositionRing`, `HcMetricSparkline`,
`HcChartCard`, `HcSourceBadge`, `HcAssumptionLedger`.
**Vigilance** : `HcSourceBadge` (badge) et `HcAssumptionLedger` (table maison) ne doivent
JAMAIS être réutilisés comme Badge/Table génériques hors instruments HIS.

## 7. Refactors obligatoires (avant tout rebuild de module)

1. **Converger la couche surface** : `Series1DashboardSection.tsx` + `Series1Panel.tsx`
   → réimplémentés au-dessus de Catalyst `Card`/`DashboardPanelHeader`/`nested-panel`
   (ou `surface-classes` devient l'interne de `Card`, pas une API parallèle).
2. **Unifier la row label/valeur (4→1)** → `Metric` / `Table` Catalyst.
3. **Unifier les chips de statut/provenance (2+→1)** → `WiredChip` / `BentoBadge` / `PanelStatus`.
4. **KPI band** (`Series1KpiBand`, grille KPI du hero) → `Metric`.
5. **Chart shells** hors HIS → `HcChartCard`.
6. Ajouter un **guard de convergence primitives** (voir §9) pour que cette dette ne
   revienne pas silencieusement (les guards actuels ne voient que tokens/hex/px).

## 8. Composants Catalyst à utiliser (existants — cibles directes)

`card.tsx` (Card/CardHeader/CardTitle/CardContent) · `dashboard-panel-header.tsx`
(DashboardPanelHeader) · `nested-panel.tsx` · `table.tsx` · `metric.tsx` (Metric) ·
`bento-badge.tsx` (BentoBadge) · `wired-chip.tsx` (WiredChip) · `provenance-badge.tsx` ·
`panel-status.tsx` (PanelStatus) · `cockpit-button.tsx` (CockpitButton, pour les CTA
Reserve/Subscribe) · `field.tsx` / `input.tsx` / `select.tsx` (formulaires subscription) ·
`segmented-control.tsx` (toggles).

## 9. Composants Catalyst manquants à créer au bon endroit

| Besoin | Manque | Où le créer |
|---|---|---|
| Timeline / process numéroté (Capital Flow, Series1Timeline) | pas de primitive Catalyst | **`src/components/catalyst/` (nouvelle primitive)** — jamais un mini-composant local Series1 |
| Chart-shell empty/gated hors HIS | partiellement `HcChartCard` | étendre `HcChartCard` (HIS) — pas de card chart maison |

> Règle : si une primitive Catalyst manque, l'étendre dans `src/components/catalyst/` ou
> créer **un** wrapper DS unique — **ne pas** recréer un mini-composant local dans Series1.

## 10. Impact sur les modules Dashboard / Reserve / Proof / Profile

- **Dashboard** : le plus touché — toute la couche `Series1Dashboard*` passe par la
  surface parallèle. Le rebuild doit s'appuyer sur `Card`/`Metric`/`WiredChip`/`PanelStatus`.
- **Reserve** (`/vaults`) : consomme `Series1Panel/Row/RowList` (maison) → même convergence
  avant d'ajouter Constitution/cap/minimum/terms/subscribe (CTA = `CockpitButton`,
  formulaire = `Field`/`Input`).
- **Proof** (`/proof-center`) : proof chips → `WiredChip`/`BentoBadge` ; timeline
  d'events → primitive timeline Catalyst (§9).
- **Profile** (`/profile`) : consomme `Series1Panel` + `Series1WiredRow` → `Card` +
  `Table`/`Metric` ; status KYC/wallet → `PanelStatus`/`BentoBadge`.

**Conclusion** : la DS Target Map ci-dessus (§7–§9) doit être appliquée AVANT de
reconstruire un module, sinon chaque rebuild réinjecte le 2ᵉ design system parallèle.

---

## Verdict sur les 13 fichiers dashboard non commités

Ils **passent Storybook** (105 tests verts précédemment) et respectent tokens/honnêteté,
**mais** consomment la couche surface parallèle (`Series1DashboardCard/Section/Row`,
chips inline) — donc **conformes tokens, non conformes primitives**. Un module peut passer
Storybook et rester refusé s'il rebâtit un mini-DS local : **c'est le cas ici**.
Recommandation : **NE PAS committer tel quel** ; les garder comme base fonctionnelle, mais
les faire passer par la DS Target Map (§7) avant commit final.

| Fichier | Change | Catalyst-compliant | Keep | Rewrite | Raison |
|---|---|---|---|---|---|
| Series1DashboardHero.tsx | donut + KPI grid | non (KPI maison, badge inline) | oui (base) | partiel | KPI→Metric, badge→WiredChip |
| Series1AllocationCockpit.tsx | donut + chips | non (chips + rows maison) | oui | partiel | chips→WiredChip, rows→Metric |
| Series1MiningRegister.tsx | gated state | non (card + rows maison) | oui | partiel | Card→Card, rows→Table |
| Series1BitcoinAccumulation.tsx | empty-state | non (card maison) | oui | partiel | Card→Card / HcChartCard |
| Series1CapitalArchitecture.tsx | dédup barrow | non (card + steps maison) | oui | partiel | Card + timeline primitive |
| Series1Dashboard.tsx | wiring | non (hérite racine) | oui | suit racine | — |
| Series1Nav.tsx | nav 4 entrées | **oui** | oui | non | conforme Catalyst |
| asset-analytics-gallery.tsx | polish | **oui** | oui | non | conforme Catalyst |
| 6× *.stories.tsx | couverture | n/a (stories) | oui | non | Storybook only |
