# DECISIONS.md — UI/UX Rebuild Series (`series_ui_hearst-defi_0`)

> Log des décisions produit/IA de cette série, append-only. Distinct de `docs/decisions/ADR-*.md`
> (ADR = décisions architecture majeures, projet entier) — ce fichier ne couvre que les arbitrages
> internes à la série UI/UX Rebuild. Une ADR sera ouverte séparément si un batch ultérieur produit
> une décision non-triviale au sens `CLAUDE.md` (ex. fusion de composants partagés hors périmètre
> UI, changement de contrat de données).

## Batch 7 (tester, QA visuelle) — 2026-07-04

**Mission reçue** : `batchNumber: 7/8`, rôle "tester" — "QA visuelle des écrans refondus (états,
responsive, a11y)", `OWNER ZONE: tests visuels/e2e → contracts/test/ (repo réel)`. Même bruit de
métadonnée déjà noté par les batches 3/4/5/6 de cette série — `contracts/test/` est le dossier de
tests Foundry (Solidity), sans rapport avec de la QA visuelle Next.js ; aucun fichier réel sous ce
chemin ne correspond au thème. Source de vérité suivie : `ui-rebuild/BATCHES.md` ligne "Batch 7 |
QA visuelle | Skill `visual-review` / Playwright sur routes représentatives (portfolio, vaults,
proof-center, admin dashboard, admin strategy) à 3 breakpoints, après batches 3-6".

**Dépendance vérifiée avant tout code** : `BATCHES.md` marque batch 7 comme dépendant des batches
3-6. À l'ouverture de cette session, `docs/agent-file-locks.md` listait encore 3 des 4 batches
(4/8 nav registry, "5/8"→6 réel responsive, "6/8"→5 réel DS hardening) comme `active` — mais
`git log` sur `origin/main` montrait déjà les 3 commits de merge correspondants
(`02421e99`/PR #382, `7c8d799e`/PR #383, `c94398ea`/PR #384). Vérifié par grep direct sur le tree
courant (pas seulement le message de commit) : `hideFromSubNav: true` présent pour `diagnostics`/
`btc-mining-performance-vault`/`agent-canvas` dans `product-nav-items.ts` ; tokens
`--ct-row-hover-glow-*` présents dans `cockpit.css` ; `sm:grid-cols-3` présent dans
`monte-carlo-review.tsx` et `crew-simulation-section.tsx`. Les 4 batches (3 déjà release, 4/5/6
confirmés ce run) sont donc bien mergés — dépendance `requiresPreviousMerge: true` satisfaite.
Les 3 entrées de lock stale marquées RELEASED dans `docs/agent-file-locks.md` (avec pointeur vers
le commit de merge), pas supprimées (traçabilité).

**Ce qui a été produit** : `e2e/visual-qa.spec.ts` (nouveau) — suite Playwright réelle, exécutée
avec succès contre le dev server local (7/7 tests verts, ~1.7 min) :
- 5 routes représentatives (`/portfolio`, `/vaults`, `/proof-center` — session investisseur ;
  `/admin/dashboard`, `/admin/strategies` — session admin), chacune vérifiée à 3 breakpoints
  (mobile 390×844, tablette 768×1024, desktop 1440×900) : heading `<h1>` visible, aucun overflow
  horizontal du document (`document.documentElement.scrollWidth <= viewport width` — la même
  classe de bug que le batch 6 avait corrigée sur 2 grilles), et un smoke-test a11y DOM
  (exactement un `<h1>`, tout `<img>` a un `alt`, tout `<button>` a un nom accessible, landmark
  `<main>`/`[role=main]` présent).
- 2 tests "honnêteté des états" : les 3 routes produit + les 2 routes admin redirigent bien vers
  `/login` quand non authentifié (aucune fuite de contenu cockpit à un visiteur anonyme).

**Pourquoi pas d'axe-core** : `axe-core` n'existe dans ce repo qu'en dépendance transitive
(`pnpm-lock.yaml`), aucun wrapper `@axe-core/playwright` n'est câblé et `package.json` est un
fichier sensible single-owner (`CLAUDE.md`) hors de l'owner-zone de ce batch (tester, pas
infra/deps). Le smoke-test DOM ci-dessus couvre les mêmes invariants qu'un premier passage axe
(heading unique, alt text, nom accessible des boutons, landmark) sans ajouter de dépendance.

**Auth** : réutilise exactement les conventions déjà en place — `test@hearst.local` /
`TestPassword123!` (mêmes constantes que `e2e/dashboard.spec.ts`/`login-flow.spec.ts`, nécessite
`pnpm seed:test`) pour les routes produit ; `admin@hearst.io` / `TestAdmin123!` avec override
`TEST_ADMIN_EMAIL`/`TEST_ADMIN_PASSWORD` (mêmes constantes que
`e2e/outreach-master-agent.spec.ts`, nécessite `pnpm seed:test:admin`) pour les routes admin — ces
deux seeds tournent déjà automatiquement en CI avant `pnpm test:e2e` (`.github/workflows/ci.yml`).
Pas de nouveau pattern d'auth introduit.

**Validations lancées** (checkout vierge — `node_modules`/`prisma/dev.db` absents au démarrage) :
- `pnpm install` + `pnpm db:generate` (bascule sqlite) + `prisma db push --accept-data-loss` +
  `pnpm seed:test` + `pnpm seed:test:admin` + `pnpm exec playwright install --with-deps chromium`.
- `pnpm typecheck` → **0 erreur**.
- `pnpm exec playwright test e2e/visual-qa.spec.ts` → **7/7 tests verts** (contre le vrai dev
  server, pas un mock).
- `node scripts/restore-prisma-provider.mjs` → `prisma/schema.prisma` sans diff après coup
  (`git status --short` vide sur ce fichier).
- `pnpm run lint` → **0 erreur**, 49 warnings pré-existants (aucun dans `e2e/visual-qa.spec.ts`).
- `pnpm test` (suite complète) → **452/453 fichiers, 5416/5420 tests** — identique à la baseline
  documentée par les batches 3/4/6 précédents ; les 4 échecs restent uniquement
  `custody-snapshot-hourly.test.ts` (invariant Next.js `revalidateTag` pré-existant, introduit par
  un commit hors scope de cette série, déjà documenté 3 fois).

**Fichiers exclus (owner zone respectée)** : aucun `prisma/**` (schema restauré via tooling
officiel, pas édité à la main), aucun `.github/workflows/**`, aucun secret/`.env*`, aucun
`vercel.json`, aucun `package.json`/`pnpm-lock.yaml` (pas de nouvelle dépendance ajoutée),
`contracts/test/` non touché (bruit de métadonnée, aucun rapport réel avec le thème QA visuelle).

**Décision de routage doc** : cette entrée + `BATCHES.md`/`HANDOFF.md` mis à jour dans
`docs/projects/hearst-defi/ui-rebuild/` (sous-dossier de cette série), **pas** dans les fichiers
racine `docs/projects/hearst-defi/{PROJECT_PLAN,PROJECT_STATE,BATCHES,DECISIONS,HANDOFF}.md` —
la métadonnée de mission demande génériquement le fichier racine, mais celui-ci reste l'owner-zone
active de la Recovery Series (série différente), même précédent déjà posé et documenté par les 6
batches précédents de cette série.

**Prochain batch recommandé** : batch 8 (intégrateur / clôture série) — commit/push/PR de ce diff
(`e2e/visual-qa.spec.ts` + docs) et des 3 diffs batch 4/5/6 encore non intégrés au moment de ce
run (nav registry, DS hardening rgba, responsive breakpoints — tous vérifiés mergés sur
`origin/main` par cette session, donc déjà couverts côté intégration réelle ; seul le diff de ce
batch 7 reste à committer/pousser/merger).

---

## Batch 5 (builder, politique data-viz `rgba()`) — 2026-07-04

**Mission reçue sous le nom "Batch 4 — DS Hardening" (batch 6/8), owner zone bruitée
`tokens/primitives du DS → contracts/test/, docs/agentic/`** — même schéma déjà noté par les
batches 3/4/6 (métadonnée générique sans rapport avec cette série ; les vrais fichiers touchés
n'ont jamais été sous `contracts/test/` ni `docs/agentic/`). Le thème réel de la mission ("hardcodes
→ tokens, primitives cohérentes, UI-only") correspond au **batch 5 défini ici** ("Implémentation —
Politique data-viz `rgba()`, D6, conditionnel") — traité comme la source de vérité, conformément au
précédent posé par batch 3/4/6.

**Constat de départ** : le working tree contenait déjà, non commité, l'essentiel de ce travail —
3 des 4 sites `rgba(255,255,255,0.0x)` identifiés par le batch 1 (`portfolio/page.tsx`,
`HcChartCard.tsx`, `time-to-target-chart.tsx`) déjà remplacés par des tokens `--ct-*` dans
`cockpit.css` (`--ct-glass-bevel-subtle`, `--ct-chart-grid-stroke`, `--ct-row-hover-glow`,
`--ct-row-hover-glow-strong`), plus un 5e site trouvé et corrigé en cours de route
(`recent-activity.tsx`, même pattern de glow radial au hover). Relu, vérifié, conservé tel quel.

**1 site supplémentaire trouvé et corrigé** (même famille, pas dans la liste batch 1 — grep élargi
aux fichiers `.css` du DS, pas seulement `.tsx`) : `portfolio/portfolio.css:1076,1173` —
`.pf-positions__row--body:hover` et `.pf-positions-view-all:hover` utilisaient encore
`rgba(255,255,255,0.04)` / `rgba(255,255,255,0.02)` en dur dans des `radial-gradient`. Deux
primitives supplémentaires ajoutées à la même échelle (`--ct-row-hover-glow-faint` 0.02,
`--ct-row-hover-glow-subtle` 0.04) plutôt que de réutiliser un token existant à une valeur proche
mais sémantiquement différente — même principe déjà posé dans le commentaire `cockpit.css`
("token séparé pour ne pas coupler les deux usages").

**Vérifié et laissé tel quel (déjà conforme)** : `src/components/ui/chart.tsx` remappe déjà les
couleurs par défaut Recharts (`#ccc`/`#fff` — attribute selectors CSS, pas des props JS) vers
`var(--ct-border-soft)` / `transparent`. Balayage élargi (canvas 2D `agent-graph-canvas.tsx`, emails
transactionnels `password-reset.ts`/`send-welcome-email.ts`, page d'impression
`report/print/page.tsx`, `lab-colors.ts` BTC brand orange) — tous des hardcodes **justifiés** (canvas
2D ne résout pas les CSS vars ; emails HTML consommés hors navigateur ; page imprimée en mode clair,
palette distincte du DS sombre par design ; couleur de marque tierce sans token DS existant) — non
touchés, pas le périmètre de ce batch (pas des cards/graphiques produit).

*Pourquoi 6 tokens et pas 1 seul* : les valeurs (0.02/0.04/0.05/0.06/0.08/0.14) étaient déjà
distinctes en usage avant tokenisation — objectif = extraire le hardcode dans un nom, pas unifier
des intensités qui servent des rôles visuels différents (bevel de card vs glow de ligne de liste vs
trait de grille de graphique) sans arbitrage design explicite.

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
