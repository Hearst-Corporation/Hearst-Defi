---
description: Audit des primitives UI — vérifier qu'aucune n'est dupliquée ou recréée inline
---

# /ds-primitives — Design System Primitives Audit

## Objectif
Vérifier que les 14 primitives UI de `src/components/ui/` sont utilisées et jamais dupliquées/recréées inline.

## Les 14 primitives autorisées

| Primitive | Fichier | Usage obligatoire |
|-----------|---------|-------------------|
| Card | `card.tsx` | Wrapper `.ct-glass-panel` (ADR-013 canon) |
| Metric | `metric.tsx` | KPI value + label + delta |
| Badge | `badge.tsx` | Pill générique |
| Button | `button.tsx` | Primary / secondary / ghost |
| Progress | `progress.tsx` | Barre linéaire |
| Skeleton | `skeleton.tsx` | Squelette de chargement |
| ProvenanceBadge | `provenance-badge.tsx` | **Obligatoire sur chaque métrique** |
| ApyRange | `apy-range.tsx` | **Obligatoire pour APY** (jamais ponctuel) |
| Ptai | `ptai.tsx` | **Obligatoire pour simulations/rebal** |
| Toaster | `toaster.tsx` | Sonner Cockpit-themed |
| ClientToaster | `client-toaster.tsx` | Toaster côté client |
| ConfirmDialog | `confirm-dialog.tsx` | Modale de confirmation |
| Modal | `modal.tsx` | Panneau overlay générique (≠ ConfirmDialog) |
| PresetPicker | `preset-picker.tsx` | Custom listbox accessible (keyboard nav) |

## Commande

### 1. Vérifier les imports
```bash
rg -n 'from.*ui/(card|metric|badge|button|progress|skeleton|provenance-badge|apy-range|ptai|toaster|client-toaster|confirm-dialog|modal|preset-picker)' src/app src/components --type tsx
```

### 2. Détecter les duplications
Rechercher des patterns qui devraient utiliser une primitive :
- `provenance` sans import de `ProvenanceBadge`
- `apy`/`APY` sans import de `ApyRange`
- `projection.*trigger.*action.*impact` sans import de `Ptai`
- Card-like sans import de `Card`
- Button-like sans import de `Button`

```bash
rg -n 'provenance|Provenance' src/app src/components --type tsx | grep -v 'provenance-badge'
rg -n 'apy|APY' src/app src/components --type tsx | grep -v 'apy-range'
rg -n 'projection|trigger|action|impact' src/app src/components --type tsx | grep -v 'ptai'
```

### 3. Vérifier les non-négociables
- **ProvenanceBadge** sur chaque métrique
- **ApyRange** jamais de APY ponctuel
- **Ptai** pour simulations/rebalancing

### 4. Rapport
```
🧱 DS Primitives Audit Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅/❌ 14 primitives — présentes et utilisées
✅/❌ ProvenanceBadge — sur chaque métrique
✅/❌ ApyRange — jamais APY ponctuel
✅/❌ Ptai — simulations/rebal
✅/❌ Pas de duplication inline

Primitives manquantes : [liste]
Duplications détectées : [liste]
Recommandations : [actions]
```
