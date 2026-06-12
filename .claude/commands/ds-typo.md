---
description: Audit typographie — fonts, tailles, poids, tracking, line-height, chiffres tabulaires
---

# /ds-typo — Design System Typography Audit

## Objectif
Vérifier que la typographie respecte strictement le design system. Satoshi uniquement. Aucune font externe.

## Commande

### 1. Font family
Vérifier que seules ces fontes sont utilisées :
- `--font-sans` (Satoshi)
- `--font-mono` (Satoshi avec features mono)

```bash
rg -n 'font-family|font-sans|font-mono|font-\\[' src/app src/components --type tsx
```

Interdit : `Inter`, `Roboto`, `system-ui` seul, toute autre fonte.

### 2. Tailles autorisées
Vérifier que seules ces tailles sont utilisées :
- `--ct-text-micro: 0.5625rem` (9px) — miroir `@theme --text-micro`
- `--ct-text-xs` à `--ct-text-5xl` (échelle Tailwind)
- `--ct-text-display`

Aucune taille arbitraire comme `text-[13px]`, `text-[15px]`.
`text-xs`…`text-4xl` Tailwind dans `className` = **interdit** (ESLint error) — utiliser `.body-*`, `.h1`–`.h4`, `.stat-value`, `.stat-label` ; exception : `src/components/ui/button.tsx`.
Labels KPI uppercase → `.stat-label` (éviter `ct-text-micro-size font-bold uppercase`).
`font-bold` redondant sur `<Button variant="primary">` ou `<Badge>` — retirer (déjà dans la primitive).
`ct-pill` seul suffit (pas `body-xs font-semibold uppercase` en plus).
Typo doc-flow : `src/app/doc-flow-typography.css` — ne pas dupliquer dans `product-doc.css` / `admin-doc.css`.
CSS mort retiré : `.dash-label`, `.dash-value`, `.dash-header` dans `product-bento.css` ; utiliser `.stat-label` / `.stat-value` / `.pf-panel-title`.

### 3. Poids autorisés
- `--ct-font-light: 300`
- `--ct-font-normal: 400`
- `--ct-font-medium: 500`
- `--ct-font-semibold: 600`
- `--ct-font-bold: 700`
- `--ct-font-extrabold: 800`

### 4. Chiffres tabulaires
Vérifier que toute valeur numérique alignée utilise `font-variant-numeric: tabular-nums` (classe `.tabular` ou utilitaire Tailwind équivalent) :
```bash
rg -n 'tabular-nums|tabular' src/app src/components --type tsx
```

### 5. Rôles typographiques
Vérifier l'utilisation des classes de rôle :
- `.h1`, `.h2`, `.h3`, `.h4`
- `.eyebrow` (uppercase + letter-spacing 0.08em + `--ct-text-muted`)
- `.stat-value`, `.stat-label`
- `.body-lg`, `.body-md`, `.body-sm`, `.body-xs`
- `.ct-section-title`

### 6. Tracking
Vérifier les valeurs de tracking :
- Titres : `-0.02em`
- Labels KPI (`.stat-label`, `.eyebrow`) : `--ct-tracking-wide` (`0.04em`) ; emphase large : `--ct-tracking-wider` (`0.08em`)

### 7. Rapport
```
🔤 DS Typography Audit Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅/❌ Font family — Satoshi only
✅/❌ Tailles — échelle autorisée
✅/❌ Poids — valeurs valides
✅/❌ Tabular nums — valeurs numériques
✅/❌ Rôles typographiques — classes utilisées
✅/❌ Tracking — titres + labels

Violations typo : [liste]
Recommandations : [actions]
```
