# Portfolio layout reference — dimensions pour l'équipe design

> **Statut : PROTECTED** — lecture **obligatoire** avant tout travail UI/layout shell, portfolio,
> ou calibration de surfaces (symétrie, grilles, paddings). **Interdit de supprimer ou renommer**
> ce fichier (gate pre-commit : `scripts/protected-docs-check.mjs`). Mises à jour **in place**
> autorisées quand les tokens CSS live changent — recalculer les tableaux, ne pas fork en v2.
>
> **Source live** : `src/app/cockpit.css` (`:root` + breakpoints ~L5522–5546),  
> `src/app/(product)/portfolio/portfolio.css` (grilles `pf-*`, `@container pf`).  
> **Page** : `/portfolio` · **État shell de référence** : chat **default** (ouvert, pas collapsed/expanded).  
> Snapshot : 2026-06-26.

Ce document remplace les chiffres périmés (88px rail, 352/420px chat fixes, masquage chat à 1199px).

---

## 1. Modèle mental

```
viewport
├── Rail gauche (.ct-rail-left)     — px FIXES* (varie par breakpoint)
├── Centre (.ct-center-panel)       — flex:1 FLUIDE (seule colonne élastique)
│   └── .ct-page-area               — padding fixe (gouttières)
│       └── .pf-container           — width 100% · @container pf
│           └── grilles pf-*        — ratios fr ASYMÉTRIQUES
└── Chat (.ct-rail-right)           — clamp(vw) FLUIDE (3 états utilisateur)

* Nav produit (.ct-rail-intra) = fixed overlay, même largeur que le rail shell.
```

**Règle d'or pour Figma** : calibrer sur la **largeur `.pf-container`**, pas sur le viewport brut.

---

## 2. Tokens shell (desktop large, >1440px)

| Token | Valeur live | Notes |
|-------|-------------|-------|
| `--ct-rail-left` | `6.5rem` = **104px** | Verrouillé `!important` sur `.ct-rail-left` |
| `--ct-rail-right` (default) | `clamp(16rem, 20vw, 23rem)` | **256–368px** selon viewport |
| `--ct-rail-right-expanded` | `clamp(19rem, 25vw, 30rem)` | **304–480px** selon viewport |
| `.ct-rail-right.collapsed` | **48px** | Seul preset fixe côté chat |
| `--ct-space-7` | `1.75rem` = **28px** | Padding horizontal `.ct-page-area` |
| Doc-flow bottom (`.product-doc`) | `--ct-space-6` = **24px** | Une seule réserve bas centre (footer shell = sibling `.ct-root`) |

**Formule largeur contenu portfolio :**

```
W_pf = viewport
     − rail_left
     − rail_right (0 si ≤1024px)
     − 2 × padding_inline (28px desktop · 16px ≤767px)
```

**Formule clamp CSS** (chat default) :

```
rail_right = max(256px, min(20vw, 368px))   /* tier default >1440 */
```

---

## 3. Breakpoints shell — rail gauche & chat

| Viewport | Rail gauche | Chat default | Chat expanded | Chat visible |
|----------|-------------|--------------|---------------|--------------|
| **>1440px** | 104px | `clamp(256, 20vw, 368)` | `clamp(304, 25vw, 480)` | oui |
| **1201–1440px** | **80px** | `clamp(240, 25vw, 384)` | `clamp(288, 28vw, 480)` | oui |
| **1024–1200px** | **72px** | `clamp(224, 22vw, 320)` | `clamp(256, 25vw, 352)` | oui |
| **≤1023px** | 104px* | — (masqué) | — | **non** |
| **≤900px** | **masqué** (nav → bottom bar 56px) | — | — | non |

Entre 901px et 1023px le rail repasse à **104px** (hors tier 1024–1200). Sous 900px le rail shell est `display: none` — le token 64px (≤767px) ne s'applique pas tant que le masquage 900px est actif.

\* Entre 901px et 1023px le rail repasse à 104px (hors tier 1024–1200).

**Masquage chat** : `@media (max-width: 63.999rem)` → **≤1024px**, pas 1199px.

---

## 4. Tableau viewport → largeurs (chat default ouvert)

Padding centre = **56px** (28×2) sauf ≤767px (**32px**). Rail shell = **0px** de largeur layout ≤900px (nav en bottom bar).

| Viewport | Rail L | Chat R | Centre | **W_pf** | Hero layout | Deck layout |
|----------|--------|--------|--------|----------|-------------|-------------|
| **1920** | 104 | 368 | 1448 | **1392** | 2 col (1.6 \| status) | 2 col (60/40) |
| **1680** | 104 | 336 | 1240 | **1184** | 2 col | 2 col |
| **1440** | 80 | 360 | 1000 | **944** | 2 col | 2 col |
| **1366** | 80 | 342 | 944 | **888** | 2 col | 2 col |
| **1280** | 72 | 282 | 926 | **870** | **1 col** (stack) | 2 col |
| **1200** | 72 | 264 | 864 | **808** | **1 col** | 2 col |
| **1024** | 72 | 225 | 727 | **671** | **1 col** | **1 col** |
| **1023** | 104 | 0 | 919 | **863** | 2 col | 2 col |
| **768** | 0 | 0 | 768 | **712** | **1 col** | **1 col** |
| **390** | 0 | 0 | 390 | **358** | **1 col** | **1 col** |

Seuils container portfolio :
- Hero **2 colonnes** si `W_pf ≥ 848px` (`53rem`) — abaissé depuis `58rem` pour éviter le chevauchement rem flottant / `max-width` à ~930px (laptop 1440 + chat ouvert)
- Hero **1 colonne** si `W_pf < 848px`
- Deck **2 colonnes** si `W_pf ≥ 960px` (`60rem`)
- Deck **1 colonne** si `W_pf < 960px`

---

## 5. Splits internes (quand 2 colonnes actives)

### 5.1 Hero — `.pf-hero-grid`

**Condition** : `@container pf (min-width: 53rem)` → `W_pf ≥ 848px`

```css
grid-template-columns: 1.6fr minmax(16rem, 22rem);
gap: var(--ct-space-5); /* 20px */
```

| W_pf | Colonne chart (≈) | Colonne status (≈) | Ratio |
|------|-------------------|--------------------|-------|
| 1392 | **1020px** | **352px** (max 22rem) | ~74 / 26 |
| 944 | **572px** | **352px** | ~62 / 38 |
| 888 | **516px** | **352px** | ~59 / 41 |

La colonne status est **cappée à 352px** (`22rem`) ; le chart absorbe le reste. Ce n'est **pas** un 50/50.

**Sous 928px** : hero empilé (chart au-dessus, status en dessous), pleine largeur `W_pf`.

### 5.2 Deck — `.pf-fused-surface--deck`

**Condition** : `@container pf (min-width: 60rem)` → `W_pf ≥ 960px`

```css
grid-template-columns: minmax(0, 1.2fr) minmax(16rem, 0.8fr);
min-height: 24rem;
```

| W_pf | Distributions (≈) | Activité (≈) | Ratio |
|------|-------------------|--------------|-------|
| 1392 | **835px** | **557px** | **60 / 40** |
| 944 | **566px** | **378px** | 60 / 40 |
| 808 | **485px** | **323px** | 60 / 40 |

**Sous 960px** : deck empilé (distributions puis activité).

### 5.3 Yield & Positions

Pleine largeur `W_pf` — une colonne, pas de split horizontal.

---

## 6. Paddings empilés (alignement surface → bord visible)

Pour aligner un élément au **bord intérieur d'un panneau graphite** :

| Couche | Token / classe | Horizontal |
|--------|----------------|------------|
| Shell centre | `.ct-page-area` | **28px** (`--ct-space-7`) |
| Panneau | `.pf-cockpit-panel`, `.pf-embedded-pane` | **20px** (`--ct-space-5`) |
| Chart hero | `.pf-value-chart` | **16px** (`--ct-space-4`) |

**Offset typique bord viewport → contenu chart** (desktop) :

```
104 + 368 + 28 + 20 + 16 ≈ 536px depuis la gauche (viewport 1920, chat default)
```

**Offset bord `.pf-container` → contenu panneau** : **20px** (padding panel).

---

## 7. Hauteurs de référence (rows portfolio)

| Row | Classe | min-height | Notes |
|-----|--------|------------|-------|
| Chart | `.pf-cockpit-row--chart` | **18rem** (288px) | Hero grid densifiée |
| Yield | `.pf-cockpit-row--yield` | **auto** | Hauteur naturelle |
| Deck | `.pf-cockpit-row--deck` | **12rem** (192px) | |
| Positions | `.pf-cockpit-row--positions` | **auto** | Hauteur naturelle |

Gap entre rows : `--ct-space-5` = **20px**.

Contrat scroll : page en **scroll naturel** (`page.tsx` et `loading.tsx` sans `pf-container--fit`).

---

## 8. États chat — impact sur W_pf (viewport 1440)

| État chat | Largeur chat | W_pf | Δ vs default |
|-----------|--------------|------|--------------|
| **default** | 360px | **944px** | — |
| **expanded** | 403px (`clamp(288,403,480)`) | **901px** | −43px |
| **collapsed** | 48px | **1256px** | +312px |

Ouvrir le chat en mode expanded **sans agrandir la fenêtre** reflow hero/deck via `@container pf`.

---

## 9. Checklist calibration Figma / QA

1. Choisir viewport **1440×900** (laptop ref) ou **1920×1080** (desktop ref).
2. Chat en **default** ; fenêtre **>1024px** si le chat doit apparaître.
3. Lire `W_pf` dans DevTools → `[data-portfolio-hub="true"]` → Computed width.
4. Hero : viser **~62/38** (pas 50/50) quand 2 colonnes.
5. Deck : viser **60/40** (pas 50/50).
6. Aligner sur **`--ct-space-*`**, pas des px arrondis arbitraires.
7. Hard refresh après changement CSS (Turbopack cache).

---

## 10. Pièges connus

| Piège | Détail |
|-------|--------|
| Doc périmée | `ds-layout.md`, anciennes sections `DESIGN_SYSTEM.md` : 88px, 352/420 fixes |
| Double container | `.product-doc` + `.pf-container` — deux `@container`, seul `pf` pilote hero/deck |
| Fond invisible | `.pf-container` transparent — pas de cadre page visible |
| Bottom bar | `.ct-bottom-bar` centré sur **viewport entier**, pas sur la colonne centre |
| Fade bas | Overlay `fixed` calé `left/right` sur tokens rail — ne suit pas chat collapsed |
| localStorage | `cockpit:rail-right-mode` — préférence utilisateur persistante |

---

## 11. Fichiers source

| Fichier | Rôle |
|---------|------|
| `src/app/cockpit.css` | Rails, `.ct-page-area`, breakpoints shell |
| `src/app/(product)/portfolio/portfolio.css` | Grilles `pf-*`, `@container pf` |
| `src/app/(product)/portfolio/page.tsx` | Structure DOM portfolio |
| `docs/UI_CONTEXT.md` § Shell 3 colonnes | Vocabulaire sections 1/2/3 |
| `docs/DESIGN_SYSTEM.md` §7 | Modèle asymétrique (vérifier tokens live) |

Canvas interactif (mêmes chiffres) : `canvases/portfolio-layout-reference.canvas.tsx` (Cursor IDE).
