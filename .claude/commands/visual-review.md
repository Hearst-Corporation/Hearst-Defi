---
description: Revue visuelle multi-agents du Cockpit — screenshots × viewports × chat-state, critiques DS, vérif adverse, fixes en worktree, rapport HTML
---

# /visual-review — Revue visuelle multi-agents (Cockpit)

## Objectif
Lancer une revue visuelle EXHAUSTIVE des écrans Hearst Connect en parallèle :
balayage Playwright (routes × viewports × chat ouvert/fermé), critiques DS-aware par
axe (layout, overflow, tokens, typo, a11y), vérification adverse anti-faux-positif,
fixes isolés en worktrees, puis rapport priorisé P0/P1/P2 avec captures avant/après.

C'est l'équivalent natif d'un « canvas multi-agents » : il réutilise le moteur
`Workflow` + les sub-agents (`ui-dev`, `general-purpose`) + Playwright MCP. Aucun
outil tiers, contexte repo complet, DS verrouillé respecté (--ct-*, vert #A7FB90).

## Pré-requis
- Serveur dev up : `pnpm dev` (port 4105). Le workflow screenshote `http://localhost:4105`.
- Playwright MCP connecté (déjà le cas dans cette session).
- ⚠️ C'est un **Workflow** (15+ agents) → opt-in explicite requis. Dis « lance le
  workflow visual-review » ou inclus « ultracode », sinon l'agent ne le déclenche pas.

## Lancement
Le workflow vit dans `.claude/workflows/visual-review.js`. Pour l'exécuter :

```
Workflow({ name: 'visual-review' })
```

Paramétrable via `args` (sinon défauts = tous les écrans cockpit, 6 viewports) :

```
Workflow({ name: 'visual-review', args: {
  base: 'http://localhost:4105',
  routes: ['/portfolio', '/vaults']
}})
```

## Ce que ça produit
1. **Sweep** — 1 agent/route, mesures DOM + captures par viewport × chat-state.
2. **Critique** — 1 agent DS-aware/axe (layout/overflow/tokens/typo/a11y).
3. **Verify** — 3 votes adverses/finding (kill les faux positifs ; respecte
   `docs/PORTFOLIO_ZERO_CONTRACT.md`).
4. **Fix** — `ui-dev` applique le correctif minimal de chaque finding confirmé
   dans un **worktree isolé** (pas de commit, review du diff consolidé à la fin).
5. **Report** — rapport markdown priorisé P0/P1/P2 par route.

## Garde-fous (hérités du DS + CLAUDE.md)
- Tokens `--ct-*` uniquement, un seul vert `#A7FB90`, dark mode only.
- DOM zero-state du portfolio FIGÉ — jamais modifié.
- Pas de cross-project import. Fixes chirurgicaux. Pas d'auto-commit par les agents.
