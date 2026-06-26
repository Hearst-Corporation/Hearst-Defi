# UI_CONTEXT — travailler sur l'UI sans relire tout le repo

Lire ce fichier + `docs/CSS_INDEX.md` + **`docs/PORTFOLIO_LAYOUT_REFERENCE.md`** (**obligatoire**
pour shell/rails/centre/chat, page portfolio, et toute calibration de surfaces). Charger ensuite
**uniquement** la page + le composant + la section CSS ciblés.

> **`docs/PORTFOLIO_LAYOUT_REFERENCE.md` est protégé** — ne jamais supprimer ; gate pre-commit
> `scripts/protected-docs-check.mjs`. Chiffres viewport → `W_pf` → splits hero/deck = source de
> vérité pour l'équipe design (remplace les px fixes périmés dans les résumés ci-dessous).

## Layout shell (vocabulaire)
- **Section 1** = rail gauche (icônes nav verticale, `.ct-rail-left`).
- **Section 2** = centre (contenu page).
- **Section 3** = chat droit (rail Cockpit — chrome shell, distinct des panneaux graphite).
- **Section menu** = barre flottante en bas (Portfolio / Vaults).
CSS du shell, rails, fond spatial, nav, login → `cockpit.css` (voir `docs/CSS_INDEX.md` — rails ~L3736, breakpoints ~L4615).

## Shell 3 colonnes — chrome fixe, centre fluide

Modèle asymétrique documenté dans `docs/DESIGN_SYSTEM.md` §7. **Dimensions live (tableaux)** :
`docs/PORTFOLIO_LAYOUT_REFERENCE.md`. Résumé vocabulaire :

```
┌──────────┬──────────────────────────────┬──────────────┐
│ rail L   │   centre (.ct-page-area)     │  chat rail R │
│ 104px    │   flex:1 · min-width:0       │ 352/420/48px │
│ largeur  │   typo clamp (lg→display)    │ 3 width modes│
│ fixe     │   seul scroll = main         │  flex-shrink │
└──────────┴──────────────────────────────┴──────────────┘
  ≤900px : rail L masqué + bottom bar 56px     ≤1199px : chat masqué
```

- `--ct-rail-left` **104px** — verrouillé, ne grandit pas avec le viewport.
- `--ct-rail-right` **352px** default · **420px** expanded · **48px** collapsed — `flex-shrink: 0` ; bouton largeur dans le header chat (cycle default ↔ expanded) ; toggle ›/‹ pour repli ; préférence `localStorage` `cockpit:rail-right-mode`.
- `.ct-center-panel { min-width: 0 !important }` — override package 520px ; absorbe la largeur.
- Pas de scaling proportionnel des rails : aux breakpoints, panneaux **masqués** ou remplacés (bottom bar), pas rétrécis en %.

## cockpit.css vs doc-flow.css vs portfolio.css
- **cockpit.css** = chrome global : shell, rails, nav, dashboard admin (command board), surfaces
  canoniques (graphite), tokens compléments, login split.
- **doc-flow.css** = pages "document" (admin + produit) : memo, vault wizard/invest flow, proof
  center, scenario, titres de page partagés. Scopes `.admin-doc` et `.product-doc`.
- **portfolio.css** = page `/portfolio` uniquement (KPI, donut gauge, yield ledger, hero grid, trust panel).

## Admin Proof Center vs Proofs library
Deux surfaces complémentaires sous **Proof & System** — ne pas fusionner sans spec produit.
**`/admin/proof-center`** (hub + `/full`) = lecture opérateur alignée LP : attestations on-chain,
timeline, grille off-chain en lecture, contrats, timelocks — pas de CRUD publication.
**`/admin/proofs`** = bibliothèque CRUD pour publier / éditer les preuves off-chain (paper, IPFS).
Liens croisés : proofs → « Voir dans Proof Center » ; full → « Gérer les publications ».

## Layouts
- **Admin** : layout sticky-header propre sous `src/app/admin/` ; pages denses (padding serré).
- **Produit** : `(product)/` + `ConnectShell` (rails + chat). Header produit : `src/components/connect/product-page-header.tsx`.
- Dashboard admin : lumière/nappes vertes derrière le verre VOULUES (figure/fond réglé en
  assombrissant le verre, pas en retirant la lumière). Ne pas re-proposer le fond noir.

## Tokens & design
- Tokens `--ct-*` dans `cockpit-shell/tokens.css` + compléments en tête de `cockpit.css`.
- **Un seul vert : `--ct-accent` `#A7FB90`** (maroon mort). `--ct-status-success` → `var(--ct-accent)`.
- Dark mode only — pas de modifier `dark:`. Pas de hex en dur, pas de px magique → tokens d'espace.
- Primitives : `src/components/ui/` (`Card`, `Metric`, `Badge`, `ProvenanceBadge`, `Button`, `Progress`).
  Réutiliser avant de recréer. Headers existants : `admin-page-header`, `product-page-header`,
  `legal-page-header`, `dashboard-panel-header`, `widget-panel-header` (canonisation = P1).
- Glass `.ct-glass-panel` seulement sur surfaces à un seul niveau ; **panneaux denses = plats**
  (anti cage-in-cage). Ne pas glasser un conteneur avec des sous-boxes.

## Règles code
- Server Components par défaut ; `"use client"` seulement si interactivité (107 fichiers déjà client).
- `cn()` (`@/lib/cn`) pour les classes conditionnelles. Pas de `any`, pas de `useEffect` pour fetch.
- Features UI volontairement non câblées (GlobalSearch ⌘K, ShortcutsOverlay, NotificationsBell,
  SavedViewsPicker, ChartTimeSelector, TimeseriesSection) : à brancher plus tard, **pas du code mort**.

## Validation UI
`pnpm test <glob du composant>` (ex. `pnpm test portfolio`). Pas de `pnpm build` par réflexe.
Audits DS = advisory : `pnpm ds:layout`, `ds:classes`, `ds:token-drift` (non bloquants).

## STOP
Ne pas toucher `next.config.ts`, le shell auth / `src/proxy.ts`, la CSP, ni la logique data/engine.
Le gate DS a été volontairement retiré — édition libre du DS, mais ne pas ré-armer de garde-fou.
