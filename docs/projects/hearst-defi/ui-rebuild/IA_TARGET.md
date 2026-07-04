# IA_TARGET.md — Target Information Architecture (UI/UX Rebuild Series, batch 2/8)

> Rôle **planner**, 2026-07-04. Read-only (aucun fichier source touché). Fonde ce document sur
> l'inventaire du batch 1 (`PROJECT_STATE.md`) + lecture directe de la source de nav unique
> `src/components/nav/product-nav-items.ts` + `docs/SYSTEM_MAP.md` §"Deux systèmes de nav".

## 1. IA actuelle — modèle vérifié

**Source unique de nav, déjà canonique** : `src/components/nav/product-nav-items.ts` exporte
`PRODUCT_NAV` (4 items) et `ADMIN_SECTIONS` (5 sections × tabs). Aucune duplication de données —
`InvestorRailIntra`, `AdminRailIntra` et `AdminSubNav` consomment tous ce fichier, rien n'est
redéclaré ailleurs. `docs/SYSTEM_MAP.md` documente déjà ce fait ("Source unique des items de nav").

**"Deux systèmes de nav" (SYSTEM_MAP.md) ≠ duplication** — à clarifier car le libellé prête à
confusion : il s'agit de deux couches différentes, pas de deux sources concurrentes du même
contenu :
- **Rail shell** (`cockpit-shell` `CockpitShell`) = chrome vendored (package), niveau shell global.
- **Rail intra-app** (`product-rail-intra.tsx`) = contenu métier (Portfolio/Vaults/Proofs/Profile,
  sections admin), lit `product-nav-items.ts`.

Le rail shell ne supporte pas de prop nav intra-app (API v0.1.0 du package) — d'où la composition
au-dessus du spacer, documentée dans le header du fichier. Pas une dette, une contrainte d'API
externe déjà contournée proprement.

### Hiérarchie actuelle (2 profondeurs différentes, asymétrie voulue)

| Surface | Profondeur | Modèle |
|---|---|---|
| **Cockpit investisseur** | 2 niveaux | Rail item (Portfolio/Vaults/Proofs/Profile) → page. Pas de sub-nav horizontal — les routes plus profondes (`/portfolio/[positionId]`, `/vaults/[id]/invest`) sont des drill-down page-à-page (détail/flux), pas des vues sœurs. |
| **Console admin** | 3 niveaux | Section (rail, 5) → Tab (sub-nav horizontal, 27 au total) → contenu page. `AdminSubNav` filtre les tabs `hideFromSubNav: true` (outils opérateur atteignables par URL mais pas dans la nav visible). |

**Verdict : cette asymétrie est correcte, pas une incohérence.** L'investisseur a 4 destinations
stables ; l'opérateur a ~20 sections avec sous-outils — forcer un sub-nav sur le cockpit
investisseur ajouterait de la structure sans besoin réel (aucune page produit n'a de vues sœurs
justifiant un tab strip).

### Pas de breadcrumb — confirmé volontaire, pas un trou

Aucun composant breadcrumb dans le repo. La position est communiquée par : rail (surbrillance
section active via `matchesNavPath`) + sub-nav (tab actif) + kicker du page-header
(`"— CONTEXTE"`, voir `product-page-header.tsx`/`admin-page-header.tsx`). Pour l'admin (3 niveaux),
c'est suffisant. Pour les routes produit profondes (`/vaults/[id]/invest/confirmed`,
`/portfolio/[positionId]`), la remontée se fait par lien de retour explicite dans la page elle-même,
pas par un breadcrumb générique — cohérent avec le choix "pas de sub-nav produit" ci-dessus.
**Décision IA : ne pas introduire de breadcrumb générique.** Un breadcrumb ajouterait un système de
plus à maintenir en synchronisation avec `product-nav-items.ts`, pour un gain de lisibilité marginal
vu la faible profondeur réelle (max 3 niveaux, admin seulement).

## 2. Points d'attention hérités du batch 1 — verdict IA par point

### (a) Canonisation des headers de page — **plus étroit que documenté**

`docs/UI_CONTEXT.md` liste "5 headers à canoniser" (`admin-page-header`, `product-page-header`,
`legal-page-header`, `dashboard-panel-header`, `widget-panel-header`). Vérification directe du code
(ce batch) :

- `admin-page-header.tsx` (14 lignes) et `product-page-header.tsx` (14 lignes) sont **déjà** de
  fins wrappers autour d'une seule base commune, `page-header-base.tsx` (155 lignes, API
  `titleLead`/`titleAccent`/`contextLabel`). **Déjà canonique au niveau page** — rien à fusionner ici.
- `legal-page-header.tsx` (6 lignes) reste séparé : pages publiques (`/legal/*`), hors shell
  Cockpit — contexte différent (pas de rail/sub-nav), séparation justifiée.
- `widget-panel-header` n'existe plus sous ce nom. Deux composants de niveau **section/carte**
  (pas page) coexistent et se chevauchent potentiellement : `src/components/catalyst/dashboard-panel-header.tsx`
  (100 lignes, lib Catalyst vendorisée, utilisé dans proof-center + design-system) et
  `src/components/admin/dashboard/cockpit-panel-header.tsx` (38 lignes, "maison", utilisé dans
  admin/dashboard **et** portfolio produit — `pf-cockpit-panel.tsx`, `distrib-calendar.tsx`,
  `proof-pulse.tsx`).

**Cible IA** : la vraie question de canonisation n'est **pas** au niveau page (déjà fait), mais au
niveau **section/carte** — deux composants "panel header" avec des call-sites qui se recouvrent
(proof-center utilise les deux). Décision reportée à un batch dédié (implémentation, pas ce
batch) : auditer si `cockpit-panel-header` peut absorber les usages de `dashboard-panel-header`
hors design-system, ou si la distinction (Catalyst vendorisé vs maison) doit rester.

### (b) Routes admin orphelines — 3 vraiment non enregistrées, 3 déjà gérées

Le batch 1 listait 6 routes "orphelines". Vérification contre `product-nav-items.ts` (ce batch) :

- **Déjà dans la source de nav, juste masquées de la bande visible** (`hideFromSubNav: true`) :
  `onboarding-test` (tab `dashboard`), `scenario-lab` et `projection-preview` (tab `strategy`).
  Ces 3 sont documentées, intentionnelles, retrouvables dans le code — **pas un trou d'IA**.
- **Vraiment absentes de toute déclaration de nav** : `/admin/diagnostics`,
  `/admin/products/btc-mining-performance-vault`, `/admin/agent-canvas/[canvasId]`.

**Cible IA** : pour que `product-nav-items.ts` reste la source unique et exhaustive de TOUTES les
routes admin atteignables (y compris masquées), ces 3 routes devraient recevoir une entrée
`hideFromSubNav: true` au même titre que les 3 autres — cohérence de la source de vérité, pas de
changement visuel. Reporté à un batch d'implémentation (risque faible, périmètre = 1 fichier).

### (c) `rgba()` inline en data-viz — hors périmètre IA

Confirmé faible risque (4 fichiers, calques d'opacité de graphiques, pas des couleurs de marque).
**Cible IA : aucune** — ce n'est pas un sujet de navigation/hiérarchie. Reste une tâche de polish
visuel pour un batch dédié si une politique zéro-inline est voulue (voir batch 5 ci-dessous).

### (d) Proof Center vs Proofs — déjà tranché

Confirmé intentionnel et documenté (`docs/UI_CONTEXT.md` §"Admin Proof Center vs Proofs library").
**Cible IA : aucune action** — garder les deux entrées séparées dans `ADMIN_SECTIONS.proof-system`
(actuellement `proofs` est le tab par défaut, `/admin/proof-center` reste atteignable hors sub-nav
visible). Pas de fusion sans spec produit (règle déjà posée par batch 1, confirmée ici).

## 3. Décisions IA de ce batch (résumé actionnable)

| # | Décision | Statut |
|---|---|---|
| D1 | Garder la nav actuelle (asymétrie produit 2 niveaux / admin 3 niveaux) — pas de sub-nav produit | Cible confirmée, aucun changement requis |
| D2 | Ne pas introduire de breadcrumb générique | Cible confirmée, aucun changement requis |
| D3 | Page headers déjà canoniques (page-header-base) — pas de fusion à ce niveau | Cible confirmée, aucun changement requis |
| D4 | Auditer/canoniser les 2 "panel header" de niveau section (`dashboard-panel-header` vs `cockpit-panel-header`) | Reporté → batch 3 |
| D5 | Enregistrer les 3 routes admin non déclarées (`diagnostics`, `btc-mining-performance-vault`, `agent-canvas`) dans `product-nav-items.ts` avec `hideFromSubNav: true` | Reporté → batch 4 |
| D6 | `rgba()` inline data-viz — politique zéro-inline optionnelle | Reporté → batch 5 (si arbitrage owner favorable, sinon skip) |
| D7 | Proof Center vs Proofs — statu quo | Confirmé, aucune action |

Voir `BATCHES.md` (ce dossier) pour le découpage complet batch 3-8 issu de ces décisions.
