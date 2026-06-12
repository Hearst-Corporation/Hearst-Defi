---
description: Audit des classes utilitaires .ct-* — allowlist auto depuis cockpit.css, scan inclut src/lib/ui
---

# /ds-classes — Design System Utility Classes Audit

## Objectif

Vérifier que chaque `ct-*` utilisé comme **classe CSS** est défini dans les sources canoniques.
Détecter les surfaces **DEPRECATED** (ADR-013) et la dette de syntaxe token.

**Ce audit ne couvre pas** :
- les **variables** `--ct-*` dans `var(--ct-*)` ou `(--ct-*)` → voir `/ds-tokens`
- les classes **doc-flow** (`admin-doc-*`, `product-doc-*`, `pf-*`) → voir `/ds-layout`
- les rôles typo (`.h1`, `.body-sm`, `.stat-label`) → voir `/ds-typo` (ESLint enforce)

## Source de vérité allowlist

Générée automatiquement depuis :

| Fichier | Rôle |
|---------|------|
| `src/app/cockpit.css` | ~200 utilitaires `.ct-*` |
| `src/app/globals.css` | `@utility ct-text-on-accent`, layout root |
| `src/app/(product)/portfolio/portfolio.css` | extensions scoped `.pf-container .ct-*` |

```bash
pnpm ds:classes
```

Équivalent manuel :

```bash
bash scripts/ds-classes-audit.sh
```

## Canon ADR-013 — surfaces

| Tier | Classe | Usage |
|------|--------|-------|
| **Défaut** | `.ct-glass-panel` via `Card` | Toutes surfaces module (product + admin) |
| **Utilitaire encre** | `.ct-text-on-accent` | Texte sur fill accent/status (`@utility` globals.css) |
| **DEPRECATED** | `.glass-panel`, `.glass-panel-subtle`, `.ct-system-panel` | Migration Lot 2–4 — ne pas ajouter |
| **SUPPRIMÉ** | `admin-doc-flat-list*`, `admin-vault-list-card*` | Lot 1 fait — ne pas réintroduire |

## Classes autorisées (référence par groupe)

> Liste complète = sortie de `pnpm ds:classes` allowlist. Ci-dessous les groupes les plus utilisés.

### Texte
`ct-text-primary`, `ct-text-body`, `ct-text-muted`, `ct-text-faint`, `ct-text-strong`,
`ct-text-accent`, `ct-text-accent-strong`, `ct-text-deep`, `ct-text-on-accent`, `ct-text-micro-size`,
`ct-link-accent`

### Surface & glass
`ct-surface-0`…`ct-surface-3`, `ct-hover-surface`, `ct-glass-panel`, `ct-card`, `ct-kpi-card`,
`ct-bg-deep`, `ct-bg-accent`, `ct-bg-accent-strong-hover`, `ct-overlay-surface0`, `ct-overlay-accent5`,
`ct-panel-inset`, `ct-section-preview`

### Bordure & ombre
`ct-border-soft`, `ct-border-base`, `ct-border-strong`, `ct-divide-soft`, `ct-divide-base`,
`ct-bc-base`, `ct-bc-soft`, `ct-bc-soft-50`, `ct-bc-strong`, `ct-bc-strong-hover`,
`ct-bc-accent`, `ct-bc-success`, `ct-bc-warning`, `ct-bc-danger`,
`ct-shadow-soft`, `ct-shadow-elevated`, `ct-shadow-depth`

### Status
`ct-status-success|warning|danger|info` (+ `-bg`, `-dot-*`, `-glow-*`)

### Interaction
`ct-focus-ring`, `ct-press`, `ct-transition-base`, `ct-transition-opacity-slow`, `ct-glow-accent`

### Tables & empty
`ct-table-surface`, `ct-table-cell`, `ct-table-header`, `ct-empty-state`,
`ct-empty-surface` (+ `--chart`, `--inline`, `--widget`, `--round`)

### Panel / nested
`ct-panel-status`, `ct-panel-status-accent`, `ct-panel-status-section`,
`ct-nested-panel`, `ct-nested-callout`, `ct-metric-nested`, `ct-proof-row`, `ct-proof-grid`

### Layout shell
`ct-root`, `ct-rail-left`, `ct-rail-right`, `ct-page-area`, `ct-panels-row`,
`ct-section`, `ct-rail-intra`, `ct-rail-item`, `ct-rail-item-active`, `ct-pill` (+ `.accent`)

### Formulaires
`ct-input`, `ct-input-bare`, `ct-input-otp`, `ct-select`, `ct-textarea`, `ct-form-label`,
`ct-checkbox` (+ sous-éléments `__*`)

### Helpers TS (`src/lib/ui/` — inclus dans le scan)

| Export | Fichier | Classes utilisées |
|--------|---------|-------------------|
| `adminFormField` | `form-classes.ts` | `ct-surface-1`, `ct-text-strong`, `ct-text-muted` + `border-[var(--ct-border)]` |
| `adminFormFieldCompact` | `form-classes.ts` | idem |
| `sectionDividerClass` | `surface-classes.ts` | `border-(--ct-border-soft)` — dette syntaxe |
| `adminLinkClass` | `surface-classes.ts` | `hover:ct-text-strong` |

## Syntaxe token (convention 2026-06-12)

| Forme | Statut | Où |
|-------|--------|-----|
| `border-[var(--ct-border)]` | **Canon admin / forms** | `form-classes.ts`, customers, audit… |
| `border-(--ct-border-soft)` | Legacy Tailwind v4 | scenario, portfolio, `surface-classes.ts` |
| Classe `.ct-bc-soft` etc. | **Préféré** quand utilitaire existe | Button secondary, distributions |

Ne pas traiter `(--ct-*)` comme « invalide » — c'est une **dette de convention**, pas une erreur runtime.

## Commandes complémentaires

### Classes ct-* hors allowlist (détail fichier:ligne)
```bash
DEFINED=$(rg -o '\.ct-[a-z][a-z0-9_-]*|@utility ct-[a-z0-9_-]*' \
  src/app/cockpit.css src/app/globals.css \
  src/app/\(product\)/portfolio/portfolio.css \
  | sed 's/.*://;s/^\.//;s/@utility //' | sort -u)

rg -n '\bct-[a-z][a-z0-9_-]+\b' src/app src/components src/lib/ui --glob '*.{tsx,ts}' \
  | while IFS= read -r line; do
      cls="${line##*:}"
      echo "$cls" | grep -qxF "$DEFINED" || echo "$line"
    done
```

### Surfaces DEPRECATED encore présentes
```bash
rg -n 'glass-panel|glass-panel-subtle|ct-system-panel|admin-doc-flat-list|admin-vault-list-card' \
  src/app src/components --glob '*.{tsx,ts}'
```

### Faux positifs connus (ne pas flaguer comme classe manquante)

Noms extraits de `var(--ct-*)` / `(--ct-*)` — **variables CSS**, pas classes :
`ct-accent`, `ct-border`, `ct-dur-*`, `ct-space-*`, `ct-z-*`, `ct-ease`,
`ct-*-border` (status borders), `ct-leading-relaxed`, `ct-product-connect`

### Classes BEM composant (définies dans cockpit.css)

`ct-panel-status__message`, `ct-panel-status__detail`, `ct-product-section__header`,
`ct-chat-settings-label`, `ct-chat-settings-row`, `ct-chat-settings-hint`,
`ct-status-dot-info`, `ct-tracking-wider`

## Rapport attendu

```
🎨 DS Utility Classes Audit Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅/❌ Allowlist sync (pnpm ds:classes exit 0)
✅/❌ Pas de DEPRECATED ajoutés récemment
✅/❌ Helpers src/lib/ui/ cohérents

Undefined ct-*     : [liste ou vide]
DEPRECATED hits    : [liste + count]
Token syntax admin : (--ct-*) vs [var(--ct-*)] counts
Recommandations    : [actions]
```

## Règle d'or

> Allowlist = **définitions CSS**, pas une liste figée dans ce fichier.
> Après ajout d'un utilitaire dans `cockpit.css`, relancer `pnpm ds:classes`.
> Nouveau utilitaire = validation Adrien (README § Process pour ajouter un token).
