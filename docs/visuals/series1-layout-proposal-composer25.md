# Series 1 — Layout Proposal (Composer 2.5)

> **Statut** : proposition HTML uniquement — aucune modification React avant validation Adrien.  
> **Prototype** : `docs/visuals/series1-layout-proposal-composer25.html`  
> **DS source** : TradeAgent design system §05 (Page layout, shells, kpi-band, surface hierarchy)

---

## Plan de redesign — réponses aux 10 questions

### 1. Quelles boxes supprimer ou fusionner ?

| Actuel | Action |
|--------|--------|
| `Series1DashboardHero` + grille context 6 cellules | **Fusionner** en hero narratif unique : 1 chiffre héro + bande KPI intégrée (4–5 métriques max), pas de grille 2×3 séparée |
| `Series1BitcoinAccumulation` (card) + `Series1CapitalArchitecture` (card) | **Fusionner** en zone visuelle centrale unique (chart + allocation en composition, pas 2 cards côte à côte) |
| `Series1CapitalFlow` + `Series1MiningRegister` ×2 (3 cards) | **Fusionner** en rail opérationnel continu ou timeline — 1 surface, pas 3 panels ringés |
| `Series1Panel` sur vault / portfolio / proof / profile | **Réduire** : remplacer panels isolés par `kpi-band` + list-surface / timeline sans ring externe |
| `Series1DashboardSection` avec border-top | **Supprimer** le filet de section ; titre flottant sur fond canvas |

### 2. Quelles sections deviennent des zones visuelles continues ?

- **Hero + context KPI** → une seule bande `surface-hero` pleine largeur (DS §05 Shell B)
- **Réserve BTC + courbe** → panneau visuel central avec halo discret, chart SVG pleine largeur
- **Allocation B1/B2/B3** → intégrée dans le panneau central (anneau + barres), pas card séparée
- **Mining / proof / reserve** → rail horizontal connecté par lignes SVG (flow diagram)
- **Wallet / status** → strip bas de page, fond sunken unique, pas card

### 3. Où placer les grands éléments graphiques ?

| Élément | Placement |
|---------|-----------|
| Courbe accumulation BTC | Centre-dominant, 60–70 % largeur zone principale |
| Anneau allocation | Superposé ou accolé à droite du chart (même surface) |
| Flow capital (USDC → pockets → reserve → maturity) | Bande horizontale sous le hero (Prop B) ou intégré au panneau central (Prop A) |
| Timeline preuves / registre | Bas de page, pleine largeur, points connectés |
| Halo vert Hearst | Derrière le hero et le panneau réserve uniquement — signal, pas décor partout |

### 4. Comment réduire les cards ?

- Règle **1 surface = 1 intention** : max 3 surfaces visibles par page dashboard
- Remplacer `ring-1` + `rounded-xl` + `bg-zinc-950/40` par :
  - `surface-hero` (hero)
  - `surface-sunken` (zones récessées, wells chart)
  - séparateurs `gap-px` / hairline (DS kpi-band)
- Données tabulaires → `list-surface` ou rows inline sans container card
- Supprimer cage-in-cage : plus de card > inset > card

### 5. Comment garder les infos sans faire tableur ?

- **Hiérarchie typographique** : 1 hero num, 4–5 KPI secondaires en bande, le reste en labels + valeurs inline
- **Provenance** : badge discret sous la métrique, pas colonne dédiée
- **Registre mining** : timeline horizontale avec nodes (date, événement, valeur) — pas tableau
- **Hints** : sous la valeur en `t-caption`, pas cellule séparée
- Garder la densité informationnelle via **composition**, pas via multiplication de rectangles

### 6. Hiérarchie cible

```
1. Hero narratif     — eyebrow + BTC accumulated + caption honnête + provenance
2. Réserve BTC       — grand visual panel (courbe + halo)
3. Allocation        — B1 40% / B2 27% / B3 33% intégré au visual
4. Mining / proof    — rail opérationnel (hashrate, reports, electricity)
5. Wallet / status   — strip compact (contract mode, term, mining state)
6. Documents / KYC   — lien discret ou teaser strip (dashboard) ; page dédiée profile
```

### 7. Comment éviter l'effet cage-in-cage ?

- Une seule profondeur de surface par zone (hero OU sunken, jamais les deux empilés avec rings)
- Séparer par **espacement** (`--space-8`) et **gradients de fond**, pas par borders multiples
- Chart dans un well `surface-sunken` directement sur canvas — pas card > inset > chart
- Sections titrées sans wrapper card : titre + contenu fluide

### 8. Vert Hearst uniquement comme signal

- Vert `#A7FB90` réservé à : chiffre héro, dot actif, ligne accent hero, segment B2 réserve, CTA primaire
- Zinc pour tout le reste : labels, bordures, séries secondaires, texte muted
- Pas de fond vert large ; halos à 4–8 % opacity max
- Statuts : amber pour attente, zinc pour neutre — jamais bordeaux

### 9. Noir deep sans 20 rectangles identiques

- Canvas `#09090b` unique
- Variation par **luminance** : hero légèrement plus clair, sunken plus sombre, pas de nouveau rectangle
- Mesh / dot grid discret sur le panneau visuel principal seulement
- KPI band : cellules séparées par `gap-px` (DS), pas cards individuelles

### 10. Adaptation aux autres pages

| Page | Déclinaison |
|------|-------------|
| `/vaults` | Hero produit + flow diagram horizontal (Prop B logic) + kpi-band contractuelle ; supprimer grille 2×2 panels |
| `/portfolio` | Hero position (shares / capital) + strip wallet + timeline maturity ; 1 visual, pas 3 panels |
| `/proof-center` | Timeline événements pleine largeur (Prop C logic) ; contract strip en haut, pas cards par event |
| `/profile` | Page plus calme : identity hero minimal + list-surface documents ; pas de cards KYC isolées |

---

## Propositions HTML

Voir le fichier HTML pour les maquettes interactives desktop 1440 + notes mobile.

| Prop | Nom | Zones | Remplace |
|------|-----|-------|----------|
| **A** | Integrated Cockpit | 3 | Hero, chart card, allocation card, 3 register cards |
| **B** | Reserve Story | 4 (narratif) | Toute la page dashboard en parcours horizontal |
| **C** | Command Center | 5 (dense) | Hero band + panel gauche + rail droit + timeline bas |

---

## Recommandation

**Layout recommandé : A — Integrated Cockpit**

**Pourquoi** : alignement direct avec le DS §05 (Shell client, kpi-band, contenu pleine largeur), corrige le problème « 15 boxes » sans sacrifier la lisibilité investisseur, et mappe proprement sur les composants existants (`Series1Dashboard*`) avec le moindre risque de régression données.

**Ce qu'on garde** : logique `Wired<T>`, provenance, copy produit, tokens `--ct-accent`, primitives HIS (`HcCompositionRing`), structure route `/dashboard`.

**Ce qu'on supprime** : `Series1DashboardCard` wrappers redondants, grille 3 cards registre, borders section `Series1DashboardSection`, rings `Series1Panel` sur surfaces denses.

**Ce qu'on fusionne** : hero + context → hero band ; chart + allocation → visual panel ; flow + mining + reserve → operational rail.

**Fichiers touchés (après validation)** :
- `src/components/series1-dashboard/Series1Dashboard.tsx`
- `src/components/series1-dashboard/Series1DashboardHero.tsx`
- `src/components/series1-dashboard/Series1DashboardSection.tsx`
- `src/components/series1-dashboard/Series1BitcoinAccumulation.tsx`
- `src/components/series1-dashboard/Series1CapitalArchitecture.tsx`
- `src/components/series1-dashboard/Series1MiningRegister.tsx`
- `src/lib/ui/surface-classes.ts`
- `src/components/series1-shell/Series1Panel.tsx` (allègement rings)
- Pages vault / portfolio / proof-center / profile (déclinaison shell)

**Risques** : régression responsive sur la grille hero ; perte de scanabilité si le rail opérationnel devient trop dense ; effort de migration des tests snapshot.

**Plan d'implémentation (2 passes max)** :
1. **Passe 1** — Dashboard : nouveau shell composition (hero fusionné, visual panel, operational rail) ; tokens surface ; pas de changement data layer.
2. **Passe 2** — Vault, portfolio, proof-center, profile : appliquer le même vocabulaire (kpi-band, timeline, list-surface) ; retirer rings panels.
