# Series 1 — Visual Alignment Plan (baseline, no code)

Date: 2026-07-23 · Prepared against `DS_DOCTRINE_LOCKED.md` (2026-07-22, the
sole authority) · Repo state: front `1466898c` · **This document changes no
runtime — it is the map the alignment passes will execute against, one
validated change at a time (doctrine §14 Phase 2 discipline).**

## 0. The one structural fact

The investor journey is split across **three surface systems**:

| System | Token base | Where it lives | Doctrine verdict |
|---|---|---|---|
| `series1-dashboard/*` | 100 % `--ct-*`, **0** `dark:`, 0 zinc | /dashboard | **CONFORME** — the reference implementation |
| `series1-shell/*` | zinc ramp + **37** `dark:` modifiers (+2 `.dark` CSS blocks) | /vaults, /portfolio, /proof-center, /profile | **NON CONFORME** (doctrine §3 : dark-only, zero `dark:`; §13 : no parallel mini-DS) |
| `catalyst/kyc-page.tsx` | zinc 15 / `dark:` 15 / ct 11 (mixte) | /vaults/[id] | **NON CONFORME** — a zinc twin of the shell |

The invest flow (`invest-flow-shell.tsx` + `step-progress.tsx`) and
`portfolio/[positionId]` are already on `--ct-*` — conformes.
`series1-tokens.css` itself records that the `--s1-*` layer was removed in
favour of the zinc ramp: the shell's divergence is documented history, not an
accident — which is exactly why it needs a decided plan, not a drive-by fix.

## 1. Carte des surfaces actuelles

| Page | Surface utilisée | Composant porteur | Écart DS (doctrine §) |
|---|---|---|---|
| /dashboard | `--ct-bg-deep` canvas + panels graphite ct | `Series1DashboardPage/Section`, `Series1Dashboard` | Aucun écart de système. Restent les 7 incohérences Phase 2 déjà listées (doctrine §14) + hairline-densité §5 « pas de tableur ». |
| /vaults | `bg-white/dark:bg-zinc-950/40` + ring zinc | `Series1Page` + `Series1Panel` + `Series1KpiBand` | §3 dark-only violé (light-first + `dark:`), §13 mini-DS parallèle, §4 recette panel ≠ `.ct-glass-panel`/Card. |
| /vaults/[id] | zinc via `KycPanel`/`KycHeroKpiBand` + `PanelHeader/PanelRow` **inline dans la page** | `catalyst/kyc-page` | Idem §3/§13 + duplication : `PanelHeader/PanelRow` maison re-créent `Series1PanelHeader/Row` (3ᵉ variante du même objet). |
| /portfolio | zinc shell | `Series1Page/Panel/KpiBand` | Idem /vaults. + §7 : motive répété par cellule KPI (`wiredMetric` de `dashboard/_view.ts`), défaut F3 que le dashboard a purgé. |
| /proof-center | zinc shell | `Series1Page/Panel`, `Series1ProvenanceTag` | Idem. + §7 états absents : badge « Not configured » ×10 identiques — l'absence ne se distingue pas visuellement. |
| /profile | zinc shell | `Series1Page/Panel` | Idem /vaults. Empty states textuels déjà bons (les mieux rédigés) — seul le système de surface diverge. |
| /vaults/[id]/invest (+confirmed) | `--ct-*` bento | `InvestFlowShell`, `StepProgress` | Conforme. Stepper §9 : cercles+labels+connecteurs présents, **icône/description par step manquantes** (5 éléments requis). |
| /portfolio/[positionId] | `--ct-*` | canon preview | Conforme (système). |

## 2. Carte des composants

Légende actions : **GARDER** (conforme, ne pas toucher) · **FUSIONNER**
(re-baser sur l'équivalent ct sans changer l'API consommée) · **REMPLACER**
(le consommateur migre vers la primitive canonique) · **SUPPRIMER** (mort).

| Composant actuel | Équivalent Catalyst/DS | Action |
|---|---|---|
| `series1-dashboard/*` (7 fichiers) | — (c'est la référence) | **GARDER** |
| `Series1Shell.tsx` / `Series1Nav.tsx` | — (déjà ct/neutre) | **GARDER** |
| `Series1Page.tsx` (Page/PageTitle/Section) | `Series1DashboardPage/Section` (mêmes rôles, déjà ct) | **FUSIONNER** — re-baser les classes sur `--ct-*` en conservant l'API (title/meta/description/actions) ; ne PAS migrer les 4 pages vers `Series1DashboardSection` d'un bloc (API différente, risque de refonte non demandée). |
| `Series1Panel.tsx` (Panel/PanelHeader/Row/RowList) | `Card` (recette graphite §4) + `dashboard-panel-header` + rows L4 doctrine | **FUSIONNER** — remplacer `bg-white ring-zinc… dark:` par la recette Card/graphite dans le composant lui-même ; les 4 pages consommatrices ne changent pas d'import. |
| `Series1KpiBand.tsx` | `Series1DashboardHero` (pattern hero KPI ct) + §7 gap-px | **FUSIONNER** — garder la structure gap-px (déjà conforme §7), basculer les fonds/rings zinc vers tokens ; états absents à désaturer (§7). |
| `Series1Timeline.tsx` | `step-timeline`/`Series1Timeline` ct-isé | **FUSIONNER** (4 `dark:` à convertir). |
| `Series1Wired.tsx` | `wired-chip`/`wired-value` (ct) portent déjà la même sémantique | **FUSIONNER** les classes ; à terme évaluer un **REMPLACER** par WiredChip/WiredValue — pas dans la première passe (Series1DataState du dashboard le ré-importe : tout le monde dépend de sa surface actuelle). |
| `Series1ChartPlaceholder.tsx` (composant chart) | `KycEmptyChart`/`empty-surface` | **SUPPRIMER** le composant chart (0 usage, orphelin post-purge — confirmé PROMPT 010) ; **GARDER-FUSIONNER** `Series1ProvenanceTag` (seul export consommé, proof-center). |
| `series1-tokens.css` (`.s1-row-list`, `.s1-chart-well`) | tokens `--ct-border-soft` + well inset | **FUSIONNER** puis **SUPPRIMER** le fichier une fois les 2 règles re-basées (les blocs `.dark` tombent avec). |
| `catalyst/kyc-page.tsx` (KycPageTitle/Section/Panel/HeroKpiBand…) | `Series1Page/Panel/KpiBand` post-fusion (un seul shell) | **REMPLACER** — une fois le shell ct-isé, /vaults/[id] migre du kyc-page vers le shell, puis kyc-page se retire des surfaces Series1 (il reste utilisé par l'onboarding KYC : vérifier ses autres consommateurs avant toute suppression — hors périmètre Series1). |
| `PanelHeader`/`PanelRow` inline (`vaults/[id]/page.tsx:57-76`) | `Series1PanelHeader`/`Series1Row` | **REMPLACER** (suppression de la duplication inline, aucune nouvelle primitive). |
| `placeholderStatus` (`dashboard/_view.ts:47`) | — | **SUPPRIMER** (0 consommateur, confirmé). |
| `wiredMetric` (`dashboard/_view.ts:60`) | pattern `Series1DataState` (motive groupé, EMPTY_VALUE) | **FUSIONNER** — appliquer F3 aux KPI bands /vaults et /portfolio (le motive sort des cellules). |
| `vaultModeLabel` ×3 (`_view.ts`, `Series1Dashboard`, `resolved-view`) | `vaultModeLabel` de `resolved-view` (source backend) | **FUSIONNER** en une seule autorité. |
| `catalyst/table.tsx` (ct 10 + dark: 10) | — | **FUSIONNER** (retirer les `dark:` résiduels) — priorité basse, pas une page Series1. |
| `card.tsx` / `skeleton.tsx` (1 `dark:` résiduel chacun) | — | **FUSIONNER** (nettoyage 1 ligne chacun). |
| `invest-flow-shell.tsx` / `step-progress.tsx` | — | **GARDER** ; compléter le stepper §9 (icône + description par step) dans une passe dédiée validée. |
| `POLICY_TARGET_BPS` ×2 (`dashboard/_view.ts:40`, `Series1Dashboard.tsx:76`) | une seule constante exportée | **FUSIONNER**. |

## 3. Carte des écrans

### /dashboard — GARDER (référence)
Système conforme ; ne pas re-livrer. Travail restant = Phase 2 doctrine (les
7 incohérences du 2026-07-22 : hiérarchie hero, absents non distincts,
troncature Pocket Allocation, alignements, densité hairlines, double
vocabulaire statut, hairline vert) + brancher `BtcDTO.production.monthly`
(chart réel, jamais fake — §8) + evidence stepper §9 **à construire**
(doctrine §12 le liste comme manquant). Chaque fix = un changement, un
screenshot, une validation Adrien.

### /vaults — FUSIONNER (le shell migre sous ses pieds)
Ne pas réécrire la page : re-baser `Series1Page/Panel/KpiBand` sur `--ct-*`
dans les composants (l'API ne bouge pas), puis appliquer F3 aux cellules KPI
(`wiredMetric`). La page garde sa structure (KPI band + stratégies + timeline).

### /vaults/[id] — REMPLACER (kyc-page → shell)
Après fusion du shell : migrer `KycPageTitle/Panel/HeroKpiBand` vers
`Series1PageTitle/Panel/KpiBand`, supprimer `PanelHeader/PanelRow` inline.
C'est le seul écran qui change d'imports.

### /portfolio — FUSIONNER
Même mécanique que /vaults (le shell migre). En plus : l'état NO_WALLET mérite
un bloc désigné unique (motive groupé) au lieu de « no_wallet » répété par
cellule — F3.

### /proof-center — FUSIONNER
Shell migre ; le badge « Not configured » ×10 se regroupe (un motive par
section, §7) ; les cartes du register gardent leur nouvelle donnée réelle
(events indexés, livrée PROMPT 010 — ne pas re-livrer).

### /profile — FUSIONNER
Shell migre ; contenu inchangé (empty states déjà les mieux rédigés). Le
`SignOutButton` en panel isolé se range dans la dernière section existante
(déséquilibre visuel, P3).

## 4. Ordre d'exécution proposé (chaque étape = validation visuelle Adrien)

1. **Fusion tokens du shell** — `Series1Panel` → recette Card graphite ;
   `Series1Page`, `Series1KpiBand`, `Series1Timeline`, `Series1Wired`,
   `Series1ProvenanceTag` → `--ct-*` ; `series1-tokens.css` re-basé puis
   supprimé. Zéro changement d'API : les 4 pages basculent visuellement d'un
   coup, sans toucher à leur code. **C'est LA passe à valider en premier —
   un screenshot par page avant/après.**
2. **F3 hors dashboard** — `wiredMetric` aligné sur `Series1DataState`
   (motive groupé), NO_WALLET en bloc unique, badges proof-center regroupés.
3. **/vaults/[id]** — kyc-page → shell, duplication inline supprimée.
4. **Morts** — `Series1ChartPlaceholder` (composant), `placeholderStatus`,
   dédoublonnage `POLICY_TARGET_BPS` et `vaultModeLabel`.
5. **Stepper §9** — icône + description sur `step-progress` ; evidence
   stepper du dashboard (nouveau module §12).
6. **Résiduels catalyst** — `dark:` isolés de card/skeleton/table.

Hors périmètre de ce plan (déjà tranché ailleurs) : Storybook/Chromatic
(Phases 3-4 doctrine, reportées), gates DS (Phase 5, après validation),
`--ct-asset-btc` (nommé §3 doctrine, à créer au moment du chart BTC réel),
`/portfolio/preview` sandbox (hors canon assumé).

## Verdict

**SERIES1 VISUAL ALIGNMENT PLAN READY — NO CODE CHANGES**
