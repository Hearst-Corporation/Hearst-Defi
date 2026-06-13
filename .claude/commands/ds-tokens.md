---
description: Audit et validation des tokens du design system — couleurs, surfaces, textes, bordures, status
---

# /ds-tokens — Design System Tokens Audit

## Objectif
Auditer exhaustivement l'utilisation des tokens CSS `--ct-*` dans `src/app/**` et `src/components/**`. Zéro valeur hardcodée tolérée.

## Commande

Exécute les vérifications suivantes dans l'ordre :

### 1. Hex hardcodés (interdit)
```bash
rg -n '#[0-9a-fA-F]{3,8}\b' src/app src/components | grep -v cockpit-tokens | grep -v node_modules
```
**Résultat attendu** : vide. Si non vide → lister chaque fichier/ligne avec la valeur trouvée et le token `--ct-*` qui devrait la remplacer.

### 2. Tokens de couleur autorisés
Vérifier que seuls ces tokens sont utilisés :
- **Fond** : `--ct-bg-deep`
- **Accent** : `--ct-accent`, `--ct-accent-deep`, `--ct-accent-strong`, `--ct-accent-soft`, `--ct-border-accent`
- **Surfaces** : `--ct-surface-0`, `--ct-surface-1`, `--ct-surface-2`, `--ct-surface-3`
- **Texte** : `--ct-text-strong`, `--ct-text-primary`, `--ct-text-body`, `--ct-text-muted`, `--ct-text-faint`
- **Bordures** : `--ct-border-soft`, `--ct-border`, `--ct-border-strong`
- **Status** : `--ct-status-success`, `--ct-status-warning`, `--ct-status-danger`, `--ct-status-info` (+ `-soft`, `-border`, `-glow`)

### 3. Alias Tailwind v4 (`@theme`)
Vérifier que les alias `bg-bg`, `bg-bg-card`, `text-text`, `border-border` etc. proviennent bien de `globals.css` et qu'aucun nouveau `--color-*` n'a été ajouté sans validation.

### 4. Constantes TS
Vérifier que `src/lib/cockpit-tokens.ts` n'est utilisé que pour PDF/Privy/registry (pas dans du CSS/Tailwind).

### 5. Rapport
Générer un rapport structuré :
```
📊 DS Tokens Audit Report
━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Pass / ❌ Fail — Hex hardcodés
✅ Pass / ❌ Fail — Tokens autorisés respectés
✅ Pass / ❌ Fail — Alias Tailwind valides
✅ Pass / ❌ Fail — cockpit-tokens.ts usage correct

Violations trouvées : [liste]
Recommandations : [actions]
```
