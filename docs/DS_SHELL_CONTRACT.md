# Design System Shell Contract

Ce contrat définit l'utilisation stricte des "shells" et des "surfaces" dans l'application Hearst Connect, afin d'éviter les doubles shells, les compositions mobiles sur desktop, et la surcharge de matériaux (glass sur glass).

## 1. Route Shell vs Component Shell

**Règle d'or : La route possède le shell, le composant s'y intègre.**

*   **Route Shell Canonique :** Les layouts racines de chaque domaine (`src/app/(product)/vaults/layout.tsx`, `src/app/admin/layout.tsx`, etc.) sont les **seuls** responsables de fournir le shell principal de la page (`product-doc-shell` ou `admin-doc-shell`).
*   **Flow Wrapper (Non-Shell) :** Les composants internes (ex: `InvestFlowShell`, `ProofCenterHub`) ne doivent **jamais** recréer un shell de page complet (pas de classe `*-shell` imbriquée). Ils doivent utiliser des compositions de type `stack` (`product-doc-stack`, `admin-doc-stack`) pour s'écouler naturellement dans le shell parent.

### Qui a le droit d'utiliser `product-doc-shell` / `admin-doc-shell` ?
Uniquement les fichiers `layout.tsx` ou les pages de niveau racine qui ne sont pas déjà enveloppées par un layout fournissant ce shell.

## 2. Surfaces et Matériaux (Surface Contract)

**Règle d'or : Une seule surface visuelle par bloc logique.**

*   **Page shell owns background :** Le fond de la page est défini globalement par `.ct-page-area` (`--ct-bg-deep`). Aucune page ne doit redéfinir son propre fond (pas de page bleutée vs noire).
*   **Primary Card Surface :** Le composant `<Card>` est la surface de module par défaut (graphite uniforme, `--ct-surface-1` via `--ct-graphite-subtle-bg`). Les composants métiers ou flows ne doivent *jamais* inventer un nouveau matériau de carte spécifique à leur page.
*   **Flat dense surface :** `material="flat"` sur les `Card` (via `--ct-surface-0`) sert aux blocs très denses pour rester proches du fond sans effet lourd.
*   **Nested evidence :** Pour afficher des preuves à l'intérieur d'une carte, utiliser `<NestedPanel>` (`--ct-surface-2`), subtilement séparé, pas une deuxième cage.
*   **Accent green is not a surface :** L'accent vert ne s'utilise jamais comme grande surface de fond, uniquement comme signal rare.
*   **Interdiction du Glass sur Glass :** Ne jamais imbriquer une `Card` dans une autre `Card` ou un `dashboard-cockpit-panel` sans utiliser le mode `bare` ou `nested`.

### Quand utiliser `dashboard-cockpit-panel` ?
Uniquement pour les grilles de type tableau de bord (ex: `/admin/dashboard`, `/portfolio`). Les composants qui s'y insèrent doivent être `bare` (sans leur propre `Card`) pour éviter la double surface.

### Quand interdire `ct-glass-panel` ?
*   Ne jamais l'appliquer manuellement sur des `div` arbitraires. Toujours utiliser `<Card>`.
*   Ne jamais l'utiliser pour des éléments interactifs mineurs ou des wrappers de layout invisibles.

## 3. Compositions Desktop vs Mobile

**Règle d'or : Desktop = respirant, Mobile = compact.**

*   Ne forcez jamais `density="compact"` par défaut sur les composants prévus pour le desktop (ex: listes de produits, formulaires).
*   Laissez le système de conteneurs (`@container`) ou les media queries gérer la densité sur mobile.

## 4. Anti-patterns Interdits

*   **Double Shell :** `<div className="product-doc-shell"><InvestFlowShell className="product-doc-shell--cap">...</div>`
*   **Double Surface :** `<Card><Card>...</Card></Card>` ou `<div className="dashboard-cockpit-panel"><Card>...</Card></div>`
*   **Glow Persistant :** L'utilisation de `ct-glow-accent` sur des éléments persistants (déjà neutralisé globalement, ne pas le réintroduire).
*   **Micro-Badges sur Desktop :** Utiliser des variantes `compact` de badges (ex: `ProvenanceBadge`) dans des contextes desktop spacieux.

## Exemples

*   **Proof Center :** Le `ProofCenterHub` utilise le prop `bare` lorsqu'il est rendu dans des cellules de cockpit pour éviter la double surface.
*   **Vaults :** `InvestFlowShell` utilise `product-doc-stack` et non `product-doc-shell--cap` pour s'intégrer dans le layout `/vaults`.
*   **Feedback :** Les listes doivent utiliser une composition desktop standard, et non un format widget/mobile forcé.