---
description: Audit multi-agents — vérifie que chaque page est "câblée" au design system (tokens-only, primitives approuvées, surfaces/nesting, honnêteté produit). Canon = /admin/design-system + docs/DS_CONFORMANCE_PROMPT.md. Read-only par défaut, --fix opt-in en worktree.
---

# /ds-conformance — Conformité Design System (toutes les pages)

## Objectif
Lancer des agents en parallèle (un par section de routes) qui vérifient que **chaque
page respecte le design system** : zéro hardcode couleur, un seul vert `--ct-accent`,
dark-only, primitives `src/components/ui/*` réutilisées (pas réinventées), surfaces
glass/flat + max 2 niveaux (pas de cage-in-cage / glow), honnêteté produit (provenance,
APY en range, "not guaranteed", pas de faux Live/Verified). Sortie : rapport priorisé
P0/P1/P2 avec score par page, sous `docs/audit/`.

## Le bon modèle mental (à ne pas confondre)
- **`/admin/design-system`** = **miroir / référence** : on y *lit* le canon et on *valide*
  contre lui. On ne change PAS le DS en éditant cette page.
- **On édite le DS** au niveau **tokens** (`cockpit.css` cascade) + **primitives**
  (`src/components/ui/*`). La page de référence + toutes les pages reflètent.
- **`/portfolio` = seed canon** (surface réelle la plus tokenisée, décision 2026-06-21).
  Audité **read-only**, **jamais corrigé** ; la convergence va *vers* lui. Zero-state gelé
  (`docs/PORTFOLIO_ZERO_CONTRACT.md`).

## Prompt de référence (source unique)
Le checklist, le barème et la liste des exceptions vivent dans
**`docs/DS_CONFORMANCE_PROMPT.md`** — les agents le lisent en premier. C'est LE prompt
de référence ; le mettre à jour = mettre à jour la règle pour tout le monde.

## Lancement
Le workflow vit dans `.claude/workflows/ds-conformance.js`. C'est un **Workflow**
(13+ agents) → opt-in explicite requis (dis « lance le workflow ds-conformance » ou
inclus « ultracode »).

```
Workflow({ name: 'ds-conformance' })
```

Paramétrable via `args` (sinon défauts = les 13 sections de routes, portfolio en référence) :

```
# auditer seulement quelques scopes
Workflow({ name: 'ds-conformance', args: {
  scopes: [
    { key: '/admin/dashboard', globs: 'src/app/admin/dashboard/** src/components/admin/dashboard/**' }
  ]
}})

# audit + correctifs token-only isolés en worktree (jamais le portfolio)
Workflow({ name: 'ds-conformance', args: { fix: true } })
```

## Ce que ça produit
1. **Audit** — 1 agent / section de routes (parallèle). Chacun lit
   `docs/DS_CONFORMANCE_PROMPT.md`, globbe son scope, note les 9 dimensions (D1 tokens,
   D2 un-seul-vert, D3 dark-only, D4 primitives, D5 surfaces/nesting, D6 typo, D7
   spacing/radius, D8 honnêteté, D9 shell/états) → findings structurés + score /100.
2. **Synthèse** — 1 agent agrège (moyenne des scopes *gradés*, portfolio exclu),
   écrit `docs/audit/ds-conformance-<date>.md` (scoreboard + P0/P1/P2 + next actions).
3. **Fix** (si `args.fix`) — 1 fixer / scope, **worktree isolé**, correctifs token-only /
   swap de primitive, **jamais** le portfolio / zero-state / la démo Section F. typecheck
   + eslint après. Pas d'auto-commit — on review le diff consolidé.

## Périmètre
- **Statique** (tokens / primitives / honnêteté / surfaces). Le responsive live
  (scroll horizontal × viewports × chat) est couvert par **`/visual-review`** — ne pas
  le refaire ici.
- Pass = moyenne ≥ 90 **et** zéro P0.

## Garde-fous (hérités du DS + CLAUDE.md)
- Read-only par défaut. Aucun `git add/commit/push/reset` par les agents.
- Tokens `--ct-*` uniquement, un seul vert `#A7FB90`, dark-only, pas de cross-project import.
- **Portfolio = référence**, jamais touché. Exceptions "Do NOT flag" respectées
  (démo Section F de la page DS, ombres internes aux primitives, `cockpit-tokens.ts`,
  lumière ambiante dashboard, composants buildés-non-câblés).
- `--fix` = chirurgical, pas de nouveau token/couleur/glow/`dark:`, pas de changement
  de comportement.
