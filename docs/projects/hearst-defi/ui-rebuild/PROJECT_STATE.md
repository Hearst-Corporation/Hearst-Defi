# PROJECT_STATE.md — Intake — Current State (UI/UX Rebuild Series, batch 1/8)

> Snapshot 2026-07-04. Read-only. Sources : lecture directe du repo (routes, greps) + docs existants
> `docs/UI_CONTEXT.md`, `docs/CSS_INDEX.md`, `docs/DESIGN_SYSTEM.md`, `docs/OWNERSHIP_MATRIX.md`
> (déjà à jour et détaillés — réutilisés plutôt que re-dérivés).

## 1. Inventaire des écrans

**78 fichiers `page.tsx`** au total. ~98% Server Components (une seule page utilisant un client
component dédié : `TotpEnrolmentClient` sous `/admin/security`) ; l'interactivité vit dans des
composants enfants ("îlots client") importés depuis `src/components/*`, pas dans les `page.tsx`.

### Cockpit investisseur — `src/app/(product)/*` (18 routes, gate `requireInvestor()`)

| Route | Fichiers | Contenu |
|---|---|---|
| `/portfolio` | page, layout, loading | Dashboard principal — données réelles (`loadPortfolio`) |
| `/portfolio/[positionId]` | page, layout, loading | Détail d'une position |
| `/portfolio/positions` | page, loading | Grille des positions |
| `/portfolio/activity` | page, loading | Journal d'activité (transactions) |
| `/portfolio/distributions` | page, loading | Historique des distributions |
| `/portfolio/tax` | page, loading | Reporting fiscal |
| `/portfolio/yield` | page, loading | Analytics de rendement |
| `/vaults` | page, layout, loading | Sélection de vault (InvestFlowShell) |
| `/vaults/[id]` | page, layout, loading | Détail vault (spec, perf, risque) |
| `/vaults/[id]/invest` | page, loading | Flux d'investissement (étape 1) |
| `/vaults/[id]/invest/confirmed` | page, loading | Confirmation post-exécution |
| `/proof-center` | page, layout, loading | Hub Proof Center (bento borné) |
| `/proof-center/full` | page, loading | Vue étendue (event log, contrats, timelocks) |
| `/profile` | page, layout, loading | Profil compte — KYC, accréditation, wallet |
| `/onboarding` (+ `/accreditation`, `/identity`, `/wallet`) | page(s), layout, loading | Flux onboarding 3 étapes |

### Console admin — `src/app/admin/*` (48 routes, 5 sections nav)

- **Dashboard** : `/dashboard` (défaut), `/customers` (+ `[id]`), `/agentic`, `/agents` (+ `/new`, `[id]`), `/feedback`, `/onboarding-test`
- **Strategy** : `/product-workspace` (défaut, + `/report/print`), `/strategies` (+ `[slug]`), `/marketplace`, `/source`, `/projection` (+ `/preview`), `/scenario-lab`, `/chart-gallery`
- **Vaults** : `/vaults` (défaut, + `/new`, `[id]`, `[id]/edit`), `/distributions`, `/signals`
- **Proof & System** : `/proofs` (défaut), `/proof-center` (+ `/full`), `/monitoring`, `/security`, `/governance` (+ `/propose`, `/proposal/[id]`, `/allowlist`)
- **Operations** : `/roadmap` (défaut), `/spec` (+ `[slug]`), `/investor-memo`, `/audit`, `/design-system`, `/diagnostics`, `/products/btc-mining-performance-vault`
- Spéciaux : `/admin` → redirect `/admin/dashboard` ; `/agent-canvas/[canvasId]`

### Auth & public — `src/app/*`

`/` (→ LoginSplit), `/login`, `/forgot-password`, `/reset-password`, `/totp-challenge`, `/apply` (+
`/confirmed`), `/legal` (+ `/terms`, `/privacy`, `/disclaimer`), `/agent-canvas/[canvasId]` (partagé).

### Routes orphelines (accessibles mais absentes de la nav)

`/admin/diagnostics`, `/admin/products/btc-mining-performance-vault`, `/admin/agent-canvas/[canvasId]`,
`/admin/scenario-lab`, `/admin/projection/preview`, `/admin/onboarding-test`. Ces routes sont
**volontairement non câblées** pour plusieurs (cf. `docs/UI_CONTEXT.md` : "Features UI volontairement
non câblées ... pas du code mort") — à vérifier au cas par cas avant tout nettoyage, ce n'est pas
nécessairement une incohérence à corriger.

## 2. Breakpoints responsive

- **393 préfixes Tailwind responsive** au total sur `src/**/*.tsx` : `lg:` 225 (57%), `sm:` 85 (22%),
  `md:` 70 (18%), `xl:` 5 (<2%), `2xl:` 1. Répartis sur 120+ fichiers (`lg:`) / 67 fichiers (`sm:`) —
  pas concentré sur quelques composants, usage mature et répandu plutôt que localisé.
- **Pas d'échelle de breakpoints custom** dans le `@theme` de `globals.css` — le bloc `@theme` ne fait
  que l'aliasing des tokens `--ct-*` vers les slots couleur Tailwind, échelle de breakpoints = défaut
  Tailwind.
- **Breakpoints du shell** (documentés et déjà canoniques, `cockpit.css`) :
  - `≤1199px` → rail chat droit masqué (`cockpit.css` ~L4771)
  - `≤900px` → rail gauche masqué, remplacé par bottom bar 56px (~L5394)
  - `≤767px` → padding centre réduit (~L4775)
  - Pas de scaling proportionnel des rails : à ces seuils, panneaux masqués/remplacés, jamais rétrécis en %.

**Verdict** : discipline correcte, `xl:`/`2xl:` quasi inutilisés suggère que le produit ne cible pas
spécifiquement les très grands écrans au-delà du shell 3 colonnes — cohérent avec le modèle de shell
fixe documenté (`docs/UI_CONTEXT.md` §"Shell 3 colonnes").

## 3. Incohérences relevées (4 axes audités)

1. **Couleurs / tokens `--ct-*`** — globalement conforme. Pas de hex en dur détecté dans le code
   produit (confirmé aussi par le test `bento-ds-contract.test.tsx`). Quelques `rgba(255,255,255,0.0x)`
   inline en data-viz (opacité de calque, pas une couleur de marque) :
   `src/app/(product)/portfolio/page.tsx` (gradients ambiants inline), `src/components/dataviz/his/HcChartCard.tsx`,
   `src/components/vaults/time-to-target-chart.tsx` (`GRID_STROKE`), `src/components/ui/chart.tsx`
   (remap des couleurs par défaut Recharts). Faible risque, périmètre restreint aux graphiques.
   `dark:` présent uniquement dans `src/components/catalyst/*` (lib tierce Headless UI/Catalyst
   vendorisée, pas du code produit neuf) — ne viole pas la règle "dark mode only, pas de `dark:`".
2. **Pattern "glass panel"** — **une seule classe canonique** `.ct-glass-panel`, pas de pattern
   concurrent (`backdrop-blur-*` ad hoc) trouvé en production. `hub-mode-styles.tsx` désactive le
   glass en mode hub de façon intentionnelle (pas une divergence accidentelle).
3. **Shell / layout** — un seul shell canonique `AppChrome` → `ConnectShell` (wrap `CockpitShell` du
   package `@hearst/cockpit-shell`), appliqué depuis `src/app/layout.tsx`. Les pages produit
   n'implémentent pas leur propre conteneur — spacing dérivé des tokens `--ct-space-*` via Tailwind,
   pas de px magiques relevés au niveau page.
4. **Doublons "Proof Center"** — `/admin/proof-center` (+ `/full`) coexiste avec `/admin/proofs`,
   déjà documenté comme intentionnel et non-fusionnable sans spec produit (`docs/UI_CONTEXT.md`
   §"Admin Proof Center vs Proofs library") — pas un bug, mais un point de confusion nav potentiel à
   garder en tête pour un futur batch IA (information architecture).

**Conclusion générale** : pas de "grosse dette visuelle" détectée à ce stade — le produit respecte
déjà la discipline documentée dans `docs/DESIGN_SYSTEM.md`/`docs/UI_CONTEXT.md`. Les points concrets
pour un prochain batch : (a) doublons potentiels de headers de page (`admin-page-header`,
`product-page-header`, `legal-page-header`, `dashboard-panel-header`, `widget-panel-header` — déjà
notés "canonisation = P1" dans `docs/UI_CONTEXT.md` L64, pas résolus), (b) clarifier le statut des
routes orphelines admin, (c) les quelques `rgba()` inline en data-viz si une politique zéro-inline est
voulue.

## 4. Ce qui N'A PAS été fait dans ce batch

Aucune modification de code. Aucun screenshot / test visuel (hors scope "intake read-only"). Pas
d'audit d'accessibilité (contraste, focus, aria) — non demandé par le rôle `intake` de ce batch, à
considérer pour un batch dédié si la série le prévoit.
