# PROJECT_PLAN.md — UI/UX Rebuild Series (hearst-defi)

> Série : `series_ui_hearst-defi_0` — "UI/UX Rebuild Series — Hearst-Defi". Batch 1/8, rôle **intake**,
> établi le 2026-07-04. Read-only (aucun fichier source touché).

## Pourquoi ce dossier est séparé de `docs/projects/hearst-defi/*`

Le owner-zone générique de la série (`docs/projects/<slug>/`) est **déjà occupé** par une autre série
active et non terminée : la **Recovery Series** (batches 1-9, batches 3-9 encore `⏳ En attente` selon
`../BATCHES.md`). `../HANDOFF.md`, `../PROJECT_PLAN.md` et `../PROJECT_STATE.md` sont explicitement dans
le scope d'un agent actif référencé dans `../../../agent-file-locks.md` (`nexus/loop_mr3jnywz-mr5ma2tp`,
"Recovery Series batch 6/9"). Écraser ou fusionner ces fichiers casserait le fil chronologique d'une
série en cours et le travail d'un agent actif — violation directe de la règle "no edit files owned by
another active agent" / "STOP si une PR ouverte chevauche ton owner-zone".

**Décision batch 1 (intake) : les artefacts de la série UI/UX Rebuild vivent dans ce sous-dossier**
`docs/projects/hearst-defi/ui-rebuild/` plutôt que d'écraser les fichiers de niveau racine. Aucun
fichier de la Recovery Series n'a été lu en écriture ni modifié par ce batch. Si un futur arbitrage
humain préfère fusionner les deux séries dans les mêmes fichiers une fois la Recovery Series terminée,
ce dossier peut être absorbé à ce moment-là.

## Contexte & Objectif

Le produit (Hearst Yield Vault — cockpit investisseur 3 colonnes + console admin ~20 sections) est
fonctionnellement construit (voir `docs/SYSTEM_MAP.md`, `docs/UI_CONTEXT.md`, `docs/DESIGN_SYSTEM.md`)
mais a évolué par itérations ponctuelles (calibrations CSS directes autorisées par CLAUDE.md, "Phase
chantier UI"). Cette série a pour objectif de **cartographier l'état réel de l'UI puis de le faire
converger** — cohérence visuelle, discipline des breakpoints, canonisation des patterns dupliqués —
sur 8 batches séquentiels (`executionMode: sequential-orchestrated`, aucun batch en parallèle).

## Batch 1 — Intake — Current State ✅ FAIT (ce batch, 2026-07-04)

**Rôle** : read-only. Cartographie les écrans (produit + admin), les incohérences visuelles connues, et
les breakpoints responsive réellement utilisés. Zéro ligne de code touchée.

**Méthode** : deux agents d'exploration read-only en parallèle (routes produit/admin ; scan
breakpoints + discipline tokens + patterns "glass") + lecture des docs UI existants
(`docs/UI_CONTEXT.md`, `docs/CSS_INDEX.md`, `docs/DESIGN_SYSTEM.md`, `docs/OWNERSHIP_MATRIX.md`) qui
contenaient déjà une grande partie de la cartographie CSS/shell — réutilisés comme source de vérité
plutôt que re-dérivés.

**Livrable** : `PROJECT_STATE.md` (ce dossier) — inventaire des 78 routes, verdict sur les 4 axes
d'incohérence audités (couleurs/tokens, breakpoints, glass panel, layout shell), liste des routes
orphelines.

**Conclusion clé** : le produit est globalement **discipliné** (un seul panneau `.ct-glass-panel`, pas
de hex en dur détecté dans le code produit, pas de `dark:` hors la lib Catalyst tierce, shell unique
`AppChrome`/`ConnectShell`). Les points d'attention réels sont plus fins que "gros refonte" :
concentration de `lg:` (57% des breakpoints), quelques `rgba()` inline en data-viz, routes orphelines
côté admin. Voir `PROJECT_STATE.md` pour le détail et les recommandations batch 2.

## Batch 2 — Planner — Information Architecture ✅ FAIT (2026-07-04)

**Rôle** : planner, read-only. Définit l'IA cible (navigation, hiérarchie) à partir de la source de
nav unique (`src/components/nav/product-nav-items.ts`) et affine les 3 points d'attention du batch 1
par vérification directe du code (au lieu de les reporter tels quels). Zéro ligne de code touchée.

**Livrable** : `IA_TARGET.md` (ce dossier) — IA actuelle vérifiée (nav 2 vs 3 niveaux, pas de
breadcrumb, pas de duplication de source), verdict affiné sur les 3 points hérités (canonisation
headers = plus étroite qu'annoncé, routes orphelines = moitié déjà résolues, `rgba()` = hors
périmètre IA), 7 décisions (D1-D7, détail dans `DECISIONS.md`).

**Découpage batch 3-8** : voir `BATCHES.md` (ce dossier) — implémentation canonisation panel
headers (3), registre nav complet (4), politique data-viz conditionnelle (5), audit breakpoints
(6), QA visuelle (7), clôture série (8).

## Batches 3-8 — définis par ce batch (2), non démarrés

Voir `BATCHES.md` pour le détail complet. Séquentiel strict (`executionMode:
sequential-orchestrated`) — un seul batch actif à la fois, pas de parallélisme entre eux.

## Non-négociables rappelés (héritage CLAUDE.md, applicables à toute la série)

APY en range, provenance badges, PTAI, pas de chat écriture autonome, mots interdits, engine pur,
mainnet gaté Spearbit, multi-vault, disclaimer "not guaranteed", pas d'import cross-projet. Spécifique
UI : un seul vert `--ct-accent` #A7FB90, dark-mode only, pas de `tailwind.config.js`, `cn()` pour les
classes conditionnelles, Server Components par défaut.
