# DS DOCTRINE LOCKED — Hearst Connect

**Status**: LOCKED — cible stable, contre laquelle toute nouvelle passe DS est jugée.
**Date**: 2026-07-22
**Owner**: Adrien
**Scope**: `connect — Hearst Defi` uniquement. Ne couvre pas `hearst-docs-vault`,
`figma-investor-deck`, ni un futur monorepo.

---

## 1. Verdict

- Ce document **remplace** les audits DS fragmentés précédents (`ds-tokens`,
  `ds-layout`, `ds-typo`, `ds-classes`, `ds-motion`, `ds-radius`, `ds-shadows`,
  `ds-primitives`, `ds-conformance`, `ds-dark`, `ds-charts`, `ds-spacing`,
  `ds-full`) comme **source de vérité de la doctrine**.
- Les anciens audits restent des **outils de détection** valides (ils peuvent
  continuer à tourner) — mais leur rôle change : ils vérifient désormais la
  conformité **à ce document**, ils ne définissent plus la règle eux-mêmes.
  En cas de contradiction entre un audit et ce document, **ce document gagne**.
- `docs/DESIGN_SYSTEM.md` et l'ADR-013 ne sont **pas remplacés** — ce document
  les **consolide et déduplique** en une doctrine unique lisible en une passe.
  En cas de divergence future, ce fichier prime sur `DESIGN_SYSTEM.md` pour les
  points qu'il couvre explicitement ; `DESIGN_SYSTEM.md` reste autoritaire sur
  le détail non repris ici (ex: cascade CSS exacte, breakpoints, taxonomie
  invest-flow §12).
- Historique conservé mais **non canonique** : tous les fichiers
  `project_ds_*` dans la mémoire auto (finalization state, forensic 036,
  devendored, token_gate, surface_tokens, cockpit_shell_css_layer_override)
  passent au statut **archive** — ils expliquent *comment on est arrivé ici*,
  ils ne décrivent plus l'état cible.

---

## 2. Sources utilisées

- **`TradeAgent.html`** — RÉSOLU (2026-07-23) : le fichier vivait dans
  `~/Downloads` (hors du périmètre du `find` initial limité à
  `~/Dev/Hearst Corporation`). Vendoré dans
  [`docs/design-system/tradeagent-design-system.html`](tradeagent-design-system.html)
  (version du 2026-07-23, la plus récente des deux présentes dans
  Downloads). Cette grammaire de référence est désormais reproductible
  localement, comme ce document l'exigeait.
- **Series1 Hybrid Command Center** (`Series1Dashboard.tsx` et modules
  associés) — direction visuelle de référence pour le dashboard investisseur.
- **Tokens existants** — `src/app/cockpit.css` (source canonique runtime,
  non-layered, gagne sur tout) + `cockpit-shell/tokens.css` (dé-vendoré,
  éditable, ne redéclare que ce que `cockpit.css` ne couvre pas).
- **Catalyst** (`src/components/catalyst/`) — base de composants pour les
  primitives (`CockpitButton`, `Card`, `BentoBadge`, `Field`, `Table`,
  `SegmentedControl`).
- **`docs/DESIGN_SYSTEM.md`** + **ADR-013** — déjà la doctrine la plus à jour
  du repo ; ce document en extrait et fige les décisions actives, sans les
  réinventer.

---

## 3. Couleur

| Règle | Détail |
|---|---|
| Accent principal | `--ct-accent` = `#A7FB90` (vert Hearst). **Seul vert de l'UI.** |
| Asset accent Bitcoin | Orange, réservé exclusivement aux visualisations BTC (watermark, courbe accumulation BTC). Pas de token dédié encore déclaré dans `cockpit.css` — **à créer** (`--ct-asset-btc`) avant tout usage ; ne pas hex-coder inline en attendant. |
| USDC | `--ct-status-info` (bleu, `#60a5fa`) sert déjà de bucket neutre USDC/oracle dans le canon existant. Pas de nouvel accent à inventer — réutiliser. |
| Bordeaux | Interdit. Aucun token bordeaux n'existe dans `cockpit.css` ; n'en introduire aucun. |
| Green Tailwind dispersé | Interdit. Pas de `text-green-*`, `bg-emerald-*`, `#4ade80` ou équivalent Tailwind. Un seul vert = `--ct-accent`. |
| Raw hex en TSX/TS | Interdit, sauf les deux exceptions déjà documentées et actives : `src/lib/pdf/pdf-palette.ts` (impression PDF) et `src/lib/brand-constants.ts` (`CONNECT_ACCENT_HEX`, Privy/email — ne peuvent pas lire les CSS vars runtime). Aucune autre exception sans décision explicite ajoutée ici. |
| Status | `--ct-status-success = var(--ct-accent)` (positif = accent) · `--ct-status-warning = #fbbf24` · `--ct-status-danger = #f87171` · `--ct-status-info = #60a5fa`. |
| Dark mode | Unique au MVP. Aucun modifier `dark:` nulle part. |

---

## 4. Surfaces

| Tier | Classe / primitive | Usage |
|---|---|---|
| **Canvas** | `--ct-bg-deep` (`#060708`) | Fond global, rails, cellules de grille. |
| **Raised (L1/L3)** | `.ct-glass-panel` / `Card` | Recette **unique** de conteneur — opaque graphite (`--ct-graphite-subtle-bg`), `backdrop-filter: none`, pas de drop shadow externe. Le nom « glass » est legacy (ADR-013) : ce n'est **pas** du verre dépoli. |
| **Nested (L2)** | `NestedPanel` / `DataRow` / `ProofRow` | Détails à l'intérieur d'une card déjà active. Jamais utilisé comme premier conteneur visible. |
| **Sunken / inset** | `.ct-nested-callout`, rows L4 | Fond transparent, séparateur `--ct-border-soft` uniquement — pas de box. |
| **Hero** | Un seul panel hero par route, jamais une card générique | Porte la thèse de la page (voir §5 L1). |

**Interdictions** :
- **Cage-in-cage** : pas de card dans une card avec la même recette graphite. Un niveau nested change de traitement (bordure/fond), pas de simple répétition du même panel.
- **Plaques identiques partout** : toutes les cards ne se ressemblent pas par défaut — padding tier et interactivité (hover overlay) sont les seuls axes de variation autorisés (`DESIGN_SYSTEM.md` §13.3), pas une nouvelle recette par page.
- `.ct-system-panel`, `.glass-panel`, `.glass-panel-subtle` — **DEPRECATED**, interdits en nouveau code (ADR-013).

Exceptions documentées au panel graphite par défaut (chacune annotée `/* ADR-013 exception */` dans le code) :
dashboard command-board dense (strip `--ct-bg-deep` + séparateurs seuls) · `.scenario-preset-bar` · `Ptai variant="flat"` en mode compare · `EmptySurface` seul.

---

## 5. Layout

- **Ordre** : PageTitle (h1 unique par route) → navigation locale → contenu.
- **Cockpit pleine largeur** — le shell 3 colonnes (rail gauche 104px fixe /
  centre `flex:1 min-width:0` / chat 48–420px selon mode) fournit déjà la
  bordure visible. Le centre absorbe la largeur, pas de `max-width` arbitraire
  imposé par-dessus sauf shells document-style explicitement définis
  (`/vaults` step 1, confirmation step 4 — `--cap`/`--narrow`, voir
  `DESIGN_SYSTEM.md` §12.2).
- **Pas de dashboard poster** — pas d'écran-affiche avec 15 boxes de taille
  égale. Peu de grands blocs composés, chacun avec une raison d'exister
  distincte, plutôt qu'une grille dense de petites tuiles homogènes.
- **Pas de tableur** — une page produit n'est pas un tableau de cellules
  bordées à densité Excel. Le regroupement se fait par l'espacement et le
  poids typographique, pas par un hairline sur chaque ligne label/valeur.
- **Un seul objet L1 par route** (`DESIGN_SYSTEM.md` §13.1) : le h1 (ou h1 +
  KPI fusionné dans le même panel) ne doit jamais être concurrencé visuellement
  par un module L3.
- **Scroll** : header de page statique, jamais sticky (sauf toolbar interne à
  un panel). Container-query-first ; tout enfant flex/grid porte `min-width:0`.
  Pas d'overflow horizontal.

---

## 6. Typographie

- **Échelle unique**, `rem` fixes (racine 16px fixe), plus aucun `clamp` fluide
  sur le centre. Le rail chat garde ses tailles `px` fixes propres (densité
  rail, hors échelle centre — par design, pas une incohérence).
- **Chiffres tabulaires obligatoires** : `.mono`/`.tabular` (`tabular-nums` +
  `ss01`). Jamais `font-mono` Tailwind brut.
- **Hiérarchie à 4 niveaux** (`DESIGN_SYSTEM.md` §13.1–13.2), non-négociable :

| Niveau | Objet | Balise | Couleur |
|---|---|---|---|
| L1 | Thèse de page | `<h1>` / `.h1` — 24px fixe, un seul par route | `--ct-text-strong` (blanc) |
| L2 | Section | `<h2>` / `.h2` | `--ct-text-strong` (blanc — **jamais vert**) |
| L3 | Module / card | `<h3>` / `.h3` = `CardTitle` | `--ct-accent` (vert — signature portfolio) |
| L4 | Row / metric / detail | `.stat-label` / `.eyebrow`, jamais une balise de titre | `--ct-text-muted` |

- **Deux modes typographiques distincts**, ne jamais mélanger leurs classes :
  Mode A *cockpit-dense* (`.pf-container`, densité Bloomberg-terminal) vs Mode
  B *doc-flow* (`.product-doc`/`.admin-doc`, hiérarchie respirée). Le H1 24px
  fixe est le seul invariant partagé.
- **Pas de tailles improvisées** — toute taille hors de `--ct-text-*` est un
  bug, sauf micro-nudges Tailwind sub-rem déjà listés en exception (§12.4
  `DESIGN_SYSTEM.md` : `mt-auto`, `mt-0.5`, `mx-0.5`).

---

## 7. KPI bands

- **Gap-px entre cellules**, pas de bordure individuelle sur chaque cellule —
  le séparateur vient de l'espacement/gap, pas d'un hairline par ligne
  (correction directe du dashboard actuel, §incohérence #5 du 2026-07-22).
- **1 à 2 valeurs fortes maximum** par bande. Le reste est calme
  (`--ct-text-muted`, poids réduit).
- **États absents ≠ données** : `Not reported` / `—` doivent être visuellement
  distincts d'une vraie valeur mesurée — traitement désaturé ou secondaire,
  jamais la même taille/poids qu'un chiffre réel. C'est un principe de
  hiérarchie visuelle, orthogonal à l'honnêteté produit (§10) : les deux
  disent la vérité, mais l'absence doit aussi *se voir* comme une absence.
- KPI large **uniquement** si le bloc KPI **est** l'objet L1 de la page
  (§13.4 `DESIGN_SYSTEM.md`). Sinon, capé `--ct-text-xl`, jamais le tier hero.
- Jamais la même métrique rendue à la fois en hero stat et en card — un seul
  rendu par fait.

---

## 8. Charts

- SVG propres via le layer `src/components/ui/chart.tsx` (`/admin/chart-gallery`)
  — pas de dépendance chart externe non validée, pas de deuxième couche chart
  dupliquée.
- Convention dasharray canonique : `strokeDasharray = ${arc} ${C - arc}` —
  jamais `${arc} ${C}` (bug arcs fantômes, corrigé 2026-05-19). SVG carré
  obligatoire (width = height).
- **Pas de fake curve** : une courbe qui n'a pas de série réelle affiche un
  **empty state premium** (message + esquisse d'axe), jamais une ligne plate
  ou interpolée inventée pour « faire joli ».
- **Axis ghost** : axes visibles même à vide, en traitement discret
  (`--ct-border-soft`), pour donner le cadre sans mentir sur la donnée.
- **Maturity marker** : un point de repère explicite (échéance, cible) rendu
  distinctement de la donnée mesurée.
- **BTC watermark discret** autorisé sur les visualisations liées au Bitcoin
  uniquement — jamais comme décoration générique sur un chart non-BTC.
- Courbe + area fill consomment les tokens sémantiques (`--ct-chart-curve-color`,
  `--ct-chart-area-top/bottom`), jamais `--ct-accent` en direct dans un nouveau
  chart.

---

## 9. Steppers

- **Stepper premium obligatoire** pour tout flux proof/evidence (attestation,
  KYC, construction produit) — jamais une ligne basique avec petits ronds
  connectés par un trait fin.
- Chaque step porte : **icône**, **label**, **status**, **description**,
  **connector**. Les cinq éléments sont requis — un stepper qui n'affiche que
  des ronds numérotés n'est pas conforme.
- Base existante réutilisable : `construction-stepper.tsx`
  (`admin/product-workspace/`) et `kyc-stepper.tsx` (`admin/customer/`) — ne
  pas recréer un troisième stepper custom sans vérifier que l'un des deux ne
  convient pas déjà.

---

## 10. Data truth

- **Jamais de fake zero.** Une valeur non mesurée n'est jamais rendue `0` —
  c'est le collapse NOT_CONFIGURED-vers-zéro explicitement interdit.
- **`null` = absent** (la donnée n'existe légitimement pas — ex: aucun
  paiement n'a jamais eu lieu). Différent de `unreachable` = **panne** (le
  backend n'a pas pu être contacté). Différent de `not_supported` = la donnée
  n'est **structurellement pas exposée** par ce contrat/cette version. Les
  trois sont des états distincts avec des libellés distincts — jamais fusionnés
  en un seul « — ».
- **Not configured ≠ panne.** Une fonctionnalité pas encore activée par design
  n'affiche pas le même état visuel qu'une lecture backend qui a échoué.
- **Legacy mode explicite** — un contrat/mode preprod ou fork doit s'annoncer
  comme tel dans l'UI (cf. « Preprod fork — not a record » déjà en place sur
  le dashboard), jamais silencieusement mélangé à une donnée de production.
- **Jamais de timestamp fabriqué.** `0`/epoch Unix ne représente jamais « pas
  de date » — un champ date absent reste `null`, sinon il se lit comme
  « 1 Jan 1970 », une fausse donnée.

---

## 11. Vocabulaire produit

**Interdits réels (Non-négociable #5, `src/lib/agents/forbidden-words.ts` —
seule liste canonique, moteur de scan partagé)** :

`guarantee` · `promise` · `certain` · `will deliver` · `risk-free` · `no risk`
· `assured` (+ équivalents FR étendus pour le chat : `garanti`, `sans risque`,
`rendement sûr`, `capital protégé`, etc. — liste complète dans le fichier
source, ne pas la redupliquer ici).

**Correction par rapport à la demande initiale** : `yield`, `APY`,
`distribution`, `coupon`, `borrow`, `leverage` **ne sont pas interdits** — ce
sont des termes produit légitimes déjà utilisés dans le canon actif
(`ApyRange` primitive, règle « jamais un APY point unique, toujours low–high
% »). Les interdire casserait une primitive existante sans raison. Ce qui est
réellement interdit n'est pas le mot mais la **promesse ponctuelle non
disclaimée** : un `APY` doit toujours être une fourchette avec disclaimer
« not guaranteed », jamais un chiffre unique présenté comme garanti.

Si l'intention était d'interdire ces mots dans un contexte spécifique (ex: pas
de vocabulaire de rendement fixe sur le dashboard mining, qui n'est pas un
produit de rendement), le préciser dans une révision — ce n'est pas encore
tranché et n'est donc **pas** ajouté ici comme règle générale non demandée.

---

## 12. Modules Series1 obligatoires

Composants déjà en place dans `src/components/series1-dashboard/` — la
doctrine fige leur présence, pas leur implémentation pixel :

- Product identity (`Series1DashboardHero.tsx`)
- BTC inventory / Accumulated Bitcoin (`Series1BitcoinAccumulation.tsx`)
- Capital deployed
- Allocation B1/B2/B3 (`Series1CapitalArchitecture.tsx`)
- Mining register (`Series1MiningRegister.tsx`)
- Contract / proof state
- Data rail (état par bloc — ok/unavailable/error, `Series1DataState.tsx`)
- Reserve trajectory
- Evidence stepper (§9 — **à construire**, pas encore présent sur ce
  dashboard : le screenshot du 2026-07-22 ne montre aucun stepper premium)
- Provenance strip (`ProvenanceBadge` sur chaque métrique, non-négociable #2)
- Maturity delivery

---

## 13. Interdictions runtime

- **Pas de mini DS parallèle.** Un seul token namespace `--ct-*`. `@ds/core` a
  été retiré et ne doit pas revenir (ADR-013 §2).
- **Pas de CSS brut dispersé** — aucune valeur de couleur/spacing/radius/shadow
  codée en dur hors des tokens `--ct-*` et de leurs classes utilitaires.
- **Pas de duplication de tokens** — pas de deuxième déclaration d'un token
  déjà présent dans `cockpit.css` (voir la liste des 5 overrides intentionnels
  documentés dans `DESIGN_SYSTEM.md` §12, à ne pas « corriger » sans décision).
- **Pas de dépendance chart externe** sans validation explicite — le layer
  `src/components/ui/chart.tsx` est la seule voie par défaut.
- **Pas de config Storybook dans le mauvais repo** — si Storybook est introduit
  (Phase 3, §14), sa config vit dans ce repo, scope produit, pas dans un futur
  monorepo tant que celui-ci n'existe pas.
- **Pas de gate bloquant** tant que la baseline visuelle n'est pas validée
  (Phase 5 seulement, §14). Aucun `--fix` automatique, aucun CI rouge sur ce
  document avant que Phase 2 soit close.

---

## 14. Rollout

| Phase | Contenu | Statut |
|---|---|---|
| **1** | Doctrine figée (ce document) | **DONE** — ce commit |
| **2** | Dashboard Series1 aligné manuellement, un fix à la fois, validé visuellement par Adrien | À faire — voir les 7 incohérences relevées le 2026-07-22 (hiérarchie hero, états absents non distincts, troncature Pocket Allocation, alignement valeurs incohérent, densité hairlines, double vocabulaire bullet/carré statut, hairline vert isolé) |
| **3** | Storybook en mode review (visualisation + doc, pas de CI bloquante) | Reporté |
| **4** | Chromatic en mode review (non-blocking) | Reporté, après Phase 3 validée |
| **5** | Gates ciblées, uniquement sur composants stabilisés | Reporté, après Phase 4 |
| **6** | Décision Turborepo / monorepo | **Sujet séparé**, hors périmètre de cette mission |

---

## Sujets explicitement reportés (pas dans ce document)

- Rego / Conftest / policy-as-code hors code — reporté à après Phase 2.
- Pixel-perfect / "1px = build lock" — rejeté comme prématuré (figerait
  l'incohérence actuelle comme baseline officielle).
- Turborepo / structure monorepo — décision séparée, non traitée ici.
- Token `--ct-asset-btc` (accent orange BTC) — nommé au §3 comme manquant,
  **pas créé** dans cette passe (aucun runtime touché).
- Contenu exact de `TradeAgent.html` — source introuvable, ne peut pas être
  intégrée tant qu'elle n'est pas fournie.
