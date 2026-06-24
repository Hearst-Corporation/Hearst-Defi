---
description: Audit multi-agents — inventorie d'abord TOUTES les surfaces UI réelles (Phase 0), puis vérifie que chaque surface est "câblée" au design system (tokens-only, primitives approuvées, surfaces/nesting, honnêteté produit). Canon = /admin/design-system + docs/DS_CONFORMANCE_PROMPT.md. Read-only par défaut, --fix opt-in par scope explicite.
---

# /ds-conformance — Conformité Design System (toutes les surfaces)

## Objectif
Garantir qu'**aucune surface UI réelle n'échappe à l'audit DS** : pages, layouts,
loading/error/empty states, modules, modales, drawers, popovers, toasts, command
palettes, et primitives. Le workflow commence par un **inventaire exhaustif** (Phase 0),
en déduit la carte de scopes, puis audite chaque scope contre le design system : zéro
hardcode couleur, un seul vert `--ct-accent`, dark-only, primitives `src/components/ui/*`
réutilisées (pas réinventées), surfaces glass/flat + max 2 niveaux (pas de cage-in-cage /
glow), honnêteté produit (provenance, APY en range, "not guaranteed", pas de faux
Live/Verified). Sortie : un **rapport d'inventaire** + un **rapport de conformité** priorisé
P0/P1/P2 avec score par surface, sous `docs/audit/`.

## Le bon modèle mental (à ne pas confondre)
- **`/admin/design-system`** = **miroir / catalogue vivant** : on y *lit* le canon et on
  *valide* contre lui. Ce n'est PAS la source technique ; on ne copie pas son HTML.
- **Source technique réelle** = **tokens** (`cockpit.css` cascade) + **primitives**
  (`src/components/ui/*`). La page catalogue + toutes les pages reflètent.
- **`/portfolio` = seed canon** (surface la plus tokenisée, décision 2026-06-21). Audité
  **read-only**, **jamais corrigé** ; la convergence va *vers* lui. Zero-state gelé
  (`docs/PORTFOLIO_ZERO_CONTRACT.md`).
- Détail du modèle de travail : **`docs/DS_WORKING_MODEL.md`**.

## Ce que `/ds-conformance` fait maintenant (pipeline en 5 temps)
1. **Inventory (Phase 0)** — un agent énumère toutes les surfaces (routes/modules/
   overlays/states/primitives), classe audit-target vs exclusion, liste les **coverage
   gaps** (surfaces UI non mappées à un scope), et écrit
   `docs/audit/ds-surface-inventory-<date>.md`. Les scopes recommandés issus des gaps
   sont **ajoutés** automatiquement à la carte d'audit.
2. **Coverage map** — la carte de scopes (défauts + gaps détectés) qui sera auditée.
3. **Audit read-only** — 1 agent / scope (parallèle). Chacun lit
   `docs/DS_CONFORMANCE_PROMPT.md`, note les 9 dimensions, **et déclare sa couverture**
   (quelles routes / modules / overlays / states il a réellement inspectés + ce qu'il
   n'a pas pu couvrir).
4. **Adversarial verification** — chaque finding P0/P1 est re-vérifié par un agent
   sceptique (réfute les faux positifs / exceptions intentionnelles) avant d'être rapporté.
   Les findings réfutés sont retirés et les scores recalculés.
5. **Report** — synthèse : `docs/audit/ds-conformance-<date>.md` (scoreboard + couverture
   + P0/P1/P2 + gaps + next actions), lié au rapport d'inventaire.

## Prompt de référence (source unique)
Le checklist, le barème, la définition d'inventaire et la liste des exceptions vivent dans
**`docs/DS_CONFORMANCE_PROMPT.md`** — les agents le lisent en premier. C'est LE prompt de
référence ; le mettre à jour = mettre à jour la règle pour tout le monde.

## Lancement
Le workflow vit dans `.claude/workflows/ds-conformance.js`. C'est un **Workflow**
(inventaire + 15+ agents + vérification) → opt-in explicite requis (dis « lance le
workflow ds-conformance » ou inclus « ultracode »).

```
Workflow({ name: 'ds-conformance' })
```

### Arguments (`args`)
| Arg | Défaut | Effet |
|---|---|---|
| `readOnly` | `true` | Audit lecture-seule (aucune modif). |
| `fix` | `false` | Applique des correctifs token-only. **Exige un `scope` explicite** (cf. garde-fous). |
| `inventoryOnly` | `false` | S'arrête après la Phase 0 (inventaire seul, aucun audit, aucun fix). |
| `scope` | — | Limite l'audit (et un éventuel fix) à un seul scope (`"<route-or-glob>"`). |
| `scopes` | défauts | Carte de scopes custom `[{ key, globs, reference? }]`. |
| `includeOverlays` | `true` | Inventorie modales/drawers/popovers/toasts. |
| `includeStates` | `true` | Inventorie empty/loading/skeleton/error. |
| `includePrimitives` | `true` | Inventorie `src/components/ui/*`. |
| `failOnUncovered` | `false` | `pass` devient faux s'il reste des surfaces non couvertes. |

```
# inventaire exhaustif seul (recommandé en premier — read-only, zéro audit)
Workflow({ name: 'ds-conformance', args: { inventoryOnly: true } })

# auditer un seul scope (lecture-seule)
Workflow({ name: 'ds-conformance', args: { scope: 'src/app/admin/outreach' } })

# correctifs token-only ISOLÉS sur UN scope explicite (jamais global, jamais portfolio)
Workflow({ name: 'ds-conformance', args: { fix: true, scope: 'src/app/admin/outreach' } })
```

## Ce que ça produit (artefacts)
1. **`docs/audit/ds-surface-inventory-<date>.md`** — summary chiffré, inventaire routes /
   modules / overlays / states / primitives / exclusions, **coverage gaps**, et la carte de
   scopes recommandée.
2. **`docs/audit/ds-conformance-<date>.md`** — scoreboard + couverture par scope (routes /
   modules / overlays / states couverts, et non-couverts) + P0/P1/P2 + next actions.

## Périmètre
- **Statique** (tokens / primitives / honnêteté / surfaces / inventaire). Le responsive
  live (scroll horizontal × viewports × chat) reste couvert par **`/visual-review`** — ne
  pas le refaire ici.
- Pass = moyenne ≥ 90 **et** zéro P0 (et zéro non-couvert si `failOnUncovered`).

## Garde-fous (hérités du DS + CLAUDE.md)
- **Read-only par défaut.** Aucun `git add/commit/push/reset` par les agents ni le workflow.
- Tokens `--ct-*` uniquement, un seul vert `#A7FB90`, dark-only, pas de cross-project import.
- **Pas de duplication de primitive**, pas de conversion aveugle de `.pf-*`, pas de
  suppression de pattern local valide, pas de confusion catalogue ↔ source technique.

### Politique `--fix` (STOP conditions, appliquées AVANT tout agent)
```
Global --fix interdit par défaut.
Fix autorisé uniquement par scope explicite, après revue humaine.
```
- `fix: true` **sans** `scope` (ni `scopes` restreint) → **STOP**, erreur, rien modifié.
- `fix: true` ciblant **Portfolio** → **STOP** : portfolio n'est jamais auto-fixé (zero-state gelé).
- `fix: true` ciblant **`/admin/design-system` Section F** → **STOP** : démos anti-pattern
  intentionnelles, jamais auto-fixées.
- Sinon : fix **chirurgical**, **worktree-isolé**, token-only / swap de primitive, pas de
  nouveau token/couleur/glow/`dark:`, pas de changement de comportement, pas d'auto-commit
  (on review le diff consolidé).

### Exceptions "Do NOT flag" (respectées par l'audit ET la vérification)
Démo Section F de `/admin/design-system`, ombres internes aux primitives, `cockpit-tokens.ts`
(raw hex PDF/Privy), lumière ambiante dashboard, composants buildés-non-câblés, et tout le
vocabulaire `.pf-*` / portfolio-local (canon seed). Liste complète : `docs/DS_CONFORMANCE_PROMPT.md`.
