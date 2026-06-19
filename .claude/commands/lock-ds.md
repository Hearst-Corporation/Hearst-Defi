---
description: Vérifie l'invariant un-seul-vert (--ct-accent #A7FB90) — ds-lock-check + ds:token-drift, sans figer l'édition
allowed-tools: Bash(bash scripts/ds-lock-check.sh:*), Bash(pnpm ds:token-drift), Bash(node scripts/ds-token-drift.mjs), Bash(grep:*), Bash(ls:*), Bash(test:*)
---

# /lock-ds — invariant single-green (anti-drift)

Objectif : confirmer en un clic que le design system respecte l'invariant
**un seul vert** — accent canonique `--ct-accent = #A7FB90`, pas de namespace
`--ds-*`, pas de `#16a34a`. Le lock vise UNIQUEMENT le drift de tokens, PAS le gel
de l'édition : le DS reste librement éditable par repo (doctrine Adrien).

Cascade contrôlée : `cockpit-shell/tokens.css` → `src/app/cockpit.css` → `src/app/globals.css`.

## Étapes

1. **Lancer le drift gate** (déjà câblé en pre-commit + CI, source de vérité) :
   ```bash
   pnpm ds:token-drift
   ```
2. **Lancer le lock-check dédié** s'il existe (livré par l'axe DS ; sinon non bloquant) :
   ```bash
   if test -f "scripts/ds-lock-check.sh"; then bash scripts/ds-lock-check.sh;
   else echo "⚠️ ds-lock-check absent — seul ds:token-drift a tourné (suffisant pour l'invariant)."; fi
   ```
3. **Vérif rapide anti-régression** (garde-fou de surface, jamais une réécriture) :
   ```bash
   grep -RnE '#16a34a|--ds-' cockpit-shell/tokens.css src/app/cockpit.css src/app/globals.css && echo "❌ violation single-green détectée" || echo "✅ aucun #16a34a / --ds-* dans la cascade"
   ```
4. **Rapport.** `invariant | état ✅/❌`. FAIL = un vert non canonique ou un namespace --ds- réintroduit.

## STOP

- Si `ds:token-drift` échoue : STOP — reporter le token fautif, ne PAS réarmer un gate layout/classes lourd (volontairement retiré par Adrien).
- Read-only : cette commande VÉRIFIE l'invariant, elle ne ré-écrit aucun CSS.
