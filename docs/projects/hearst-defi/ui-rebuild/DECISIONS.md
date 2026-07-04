# DECISIONS.md — UI/UX Rebuild Series (`series_ui_hearst-defi_0`)

> Log des décisions produit/IA de cette série, append-only. Distinct de `docs/decisions/ADR-*.md`
> (ADR = décisions architecture majeures, projet entier) — ce fichier ne couvre que les arbitrages
> internes à la série UI/UX Rebuild. Une ADR sera ouverte séparément si un batch ultérieur produit
> une décision non-triviale au sens `CLAUDE.md` (ex. fusion de composants partagés hors périmètre
> UI, changement de contrat de données).

## Batch 6 (builder, audit discipline breakpoints) — 2026-07-04

**Mission reçue sous le nom "Batch 3 — Responsive" (batch 5/8), owner zone bruitée
`contracts/test/, docs/agentic/`** — même schéma déjà noté par batch 3/4 (métadonnée
générique sans rapport avec cette série). Aucun batch de ce nom exact n'existe dans
`BATCHES.md` de ce sous-dossier ; le thème réel de la mission ("rendre responsive les
tables/grilles/modals des écrans déjà refondus") correspond au **batch 6 défini ici**
("Audit — Discipline breakpoints", non démarré) — traité comme la source de vérité.

**Constat de départ** : le working tree contenait déjà, non commité, un fix responsive
complet et correct sur `src/app/admin/dashboard/dashboard.css` +
`src/components/admin/dashboard/kpi-strip.tsx` (`.dashboard-kpi-strip` : une ligne flex de
6 cellules non wrappée à l'intérieur d'un panel `overflow-hidden` coupait silencieusement
les 2 derniers KPI hors écran sous 1024px). Relu, vérifié, conservé tel quel.

**2 bugs réels supplémentaires trouvés et corrigés (même famille — grille CSS non
responsive dans un conteneur `overflow-hidden`)** :
- `src/components/admin/monte-carlo-review.tsx:174` — la ligne p5/p50/p95 (`grid
  grid-cols-3 overflow-hidden`) n'avait aucune variante responsive ; sur mobile étroit,
  les items de grille CSS ne rétrécissent pas sous leur largeur de contenu par défaut
  (`min-width: auto` implicite), donc la grille peut dépasser son conteneur et se faire
  couper par `overflow-hidden` — même mécanisme que le bug flex déjà corrigé sur le KPI
  strip, transposé à `display: grid`. Fix : `grid-cols-1 sm:grid-cols-3` (empile en
  colonne unique sous 640px, 3 colonnes au-delà — même seuil `40rem` que la 2e media
  query du fix KPI strip).
- `src/components/admin/agentic/crew-simulation-section.tsx:117` — même pattern pour la
  ligne Risk/Mode/Gates : les cellules contiennent des `Tag` (pilules `inline-flex` avec
  padding + bordure, ex. "write blocked" ~90-100px) qui ne s'enroulent pas en dessous de
  leur largeur de contenu ; sur mobile étroit dans une carte déjà empilée en 1 colonne
  (`grid-cols-1 lg:grid-cols-2` au niveau parent), 3 cellules dans ~113px chacune peuvent
  faire déborder la grille hors du conteneur `overflow-hidden`. Même fix : `grid-cols-1
  sm:grid-cols-3`.

*Pourquoi ce fix précis (et pas un simple `overflow-x-auto` ou une réduction de
padding)* : le pattern déjà validé par le fix KPI strip (empiler en dessous d'un seuil
plutôt que scroller horizontalement une rangée de 3 KPI) est le plus cohérent visuellement
pour ce type de contenu court (label + valeur/tag), et réutilise le même seuil `sm`
(640px) déjà établi dans cette série pour "mobile étroit" — pas de nouveau token/seuil
inventé.

**Autres surfaces auditées, aucun bug trouvé** : les échelles collatérales
(`collateral-sell-ladder.tsx`/`collateral-buyback-ladder.tsx`, `min-w-[52rem]`/
`min-w-[48rem]`) sont déjà correctement enveloppées par le composant `Table`
(`overflow-x-auto`) — scroll horizontal fonctionnel, pas un bug. Le composant `Modal`
utilise déjà `w-full` avec un `max-w-3xl` de secours — se redimensionne correctement sur
mobile, pas un bug.

## Batch 4 (builder, implémentation D5) — 2026-07-04

**D5 exécuté — 3 entrées ajoutées à `product-nav-items.ts`.** Toutes `hideFromSubNav: true`
(zéro changement visuel, jamais rendues par `AdminSubNav` qui filtre via `visibleSubNavTabs`
avant tout rendu — l'icône n'est même pas affichée pour ces entrées, cohérent avec le
précédent `projection-preview` qui utilise déjà une icône `Eye` absente du `ICON_MAP` du rail).
Placement par section (logique de contenu, aucun impact car masqué) :
- `agent-canvas` → section `dashboard`, à côté de `agentic`/`agents` (même famille agentic).
- `btc-mining-performance-vault` → section `strategy`, à côté de `product-workspace`/`strategies`
  (page de documentation produit read-only, même famille que les autres pages "Strategy").
- `diagnostics` → section `proof-system`, à côté de `monitoring`/`security` (Live Diagnostic
  Center = probes de santé, même famille "système").
*Pourquoi ces sections précisément* : aucune des trois n'a de section "évidente" imposée par le
code (aucune ne référence une section admin) ; le choix suit le contenu réel de chaque page
(vérifié par lecture directe, pas par supposition) plutôt qu'un défaut arbitraire — cohérent
avec le risque noté par batch 2 (D5) : l'objectif est l'exhaustivité de la source de vérité,
pas une réorganisation de nav visible.

## Batch 3 (builder, implémentation D4) — 2026-07-04

**D4 résolu — pas de fusion, un renommage.** Lecture complète des deux fichiers (batch 2 ne les
avait vérifiés qu'au niveau call-sites) : `dashboard-panel-header.tsx` (Catalyst, 100 lignes)
rend un vrai en-tête de section (titre, eyebrow, status chip, `ProvenanceBadge`) ; `cockpit-panel-header.tsx`
(38 lignes) n'exportait qu'`AdminLeafLink`, un petit lien "View full →" consommé *par* le slot
`trailing` de `DashboardPanelHeader` ailleurs (proof-center, admin/dashboard, portfolio) — les deux
ne sont pas des composants concurrents, le second est un accessoire du premier. Le chevauchement
apparent (batch 1/2) venait uniquement du nom du fichier (`cockpit-panel-header.tsx` suggérait un
header alors qu'il n'en contient aucun). Fix : renommé en `admin-leaf-link.tsx` (nom = export), 5
call-sites mis à jour (`assets-board.tsx`, `market-prices-panel.tsx`, `platform-overview-band.tsx`,
`proof-center-hub.tsx`, `admin/proofs/page.tsx`, `admin/proof-center/full/page.tsx`), commentaire de
`dashboard-panel-header.tsx` clarifié (la façade legacy `ui/dashboard-panel-header` a déjà été
retirée, plus une note sur un état futur). Aucun changement de comportement/visuel.
*Pourquoi pas de fusion* : fusionner un composant "header" et un composant "lien" sous un même
fichier créerait un vrai couplage artificiel (le lien est utilisé par d'autres composants que le
header Catalyst) — le renommage règle l'ambiguïté sans introduire de dépendance nouvelle.

## Batch 2 (planner, IA) — 2026-07-04

**D1 — Nav actuelle confirmée comme cible.** Asymétrie 2 niveaux (produit) / 3 niveaux (admin) est
voulue, pas une incohérence. Aucune action.
*Pourquoi* : le cockpit investisseur n'a que 4 destinations stables sans vues sœurs qui
justifieraient un sub-nav ; forcer une structure à 3 niveaux ajouterait de la complexité sans gain.

**D2 — Pas de breadcrumb générique.** Décision de ne pas introduire de composant breadcrumb.
*Pourquoi* : la profondeur réelle max est 3 niveaux (admin seulement), déjà communiquée par
rail + sub-nav + kicker de page-header ; un breadcrumb dupliquerait `product-nav-items.ts` pour un
gain marginal.

**D3 — Page headers déjà canoniques.** `admin-page-header.tsx` et `product-page-header.tsx` sont
déjà de fins wrappers sur une base commune (`page-header-base.tsx`). La note "5 headers à
canoniser" de `docs/UI_CONTEXT.md` (P1) est **partiellement obsolète** au niveau page — à corriger
dans ce doc lors d'un futur batch qui touche ce fichier (hors périmètre docs-only de ce batch,
`docs/UI_CONTEXT.md` n'est pas dans l'owner-zone `docs/projects/hearst-defi/ui-rebuild/`).
*Pourquoi* : vérifié par lecture directe du code (14 lignes chacun, délèguent à la même base) —
pas une supposition héritée du batch 1.

**D4 — Canonisation reportée au niveau section/carte, pas page.** Le vrai chevauchement potentiel
est entre `dashboard-panel-header` (Catalyst vendorisé) et `cockpit-panel-header` (maison), tous
deux utilisés dans `proof-center` avec des call-sites qui se recouvrent. Reporté à batch 3
(implémentation).
*Pourquoi* : deux composants avec un nom et un rôle proches (panel header de section), utilisés
dans les mêmes zones fonctionnelles (proof-center) — risque de dérive si non arbitré, mais requiert
une lecture des deux APIs avant fusion (travail d'implémentation, pas de planning).

**D5 — Registre de nav : 3 routes réellement non déclarées.** Le batch 1 avait listé 6 routes
"orphelines" ; vérification contre `product-nav-items.ts` montre que 3 (`onboarding-test`,
`scenario-lab`, `projection-preview`) sont déjà déclarées avec `hideFromSubNav: true` — pas un
problème. Les 3 restantes (`diagnostics`, `btc-mining-performance-vault`, `agent-canvas/[canvasId]`)
n'ont aucune entrée. Reporté à batch 4 (implémentation, scope = 1 fichier, zéro changement visuel).
*Pourquoi* : `product-nav-items.ts` se présente comme la source unique et exhaustive de la nav —
laisser 3 routes admin hors de cette liste casse cette promesse d'exhaustivité, même si elles
restent volontairement masquées de l'UI visible.

**D6 — `rgba()` inline data-viz : optionnel, pas bloquant.** Confirmé faible risque (batch 1).
Reporté à un batch 5 conditionnel, à armer seulement si l'owner juge le polish de conformité token
utile ; sinon skip explicite sans que ce soit un manquement de la série.
*Pourquoi* : ce sont des calques d'opacité de graphique (Recharts), pas des couleurs de marque —
pas un vrai risque de dérive visuelle, contrairement à un hex en dur sur un composant produit.

**D7 — Proof Center vs Proofs : statu quo confirmé.** Aucune fusion. Déjà tranché par
`docs/UI_CONTEXT.md`, reconfirmé ici sans nouvelle information contradictoire.

## Batch 1 (intake) — 2026-07-04

Voir `PROJECT_PLAN.md` §"Pourquoi ce dossier est séparé" pour la décision fondatrice de ce
sous-dossier (owner-zone racine occupée par la Recovery Series, cf. `docs/agent-file-locks.md`).
Aucune autre décision produit/IA prise à ce batch (rôle read-only pur).
