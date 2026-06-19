---
description: Ombrelle sécu+DevOps — enchaîne connexions, secrets, infra, DS, clean dry-run et sort une posture consolidée P0/P1/P2
allowed-tools: Bash(bash scripts/audit-connections.sh:*), Bash(bash scripts/secrets-scan.sh:*), Bash(bash scripts/clean-workspace.sh:*), Bash(claude mcp list), Bash(pnpm ds:token-drift), Bash(bash scripts/ds-lock-check.sh:*), Bash(cat .husky/pre-commit), Bash(cat .claude/settings.json), Bash(cat .mcp.json), Bash(grep:*), Bash(ls:*), Bash(test:*), Bash(du:*)
---

# /secdevops — posture sécu+DevOps consolidée (ombrelle 1 clic)

Objectif : exécuter en séquence les 5 contrôles (connexions → secrets → infra → DS →
clean DRY-RUN) et imprimer UN seul tableau de posture P0/P1/P2. Read-only de bout en
bout : aucune suppression, aucun secret affiché, aucun commit.

## Étapes

1. **Connexions** (read-only) — endpoints services + MCP :
   ```bash
   test -f scripts/audit-connections.sh && bash scripts/audit-connections.sh || echo "⚠️ audit-connections.sh absent"
   claude mcp list 2>/dev/null || echo "⚠️ claude mcp list indispo"
   ```
2. **Secrets** — fuites sur suivis + stagés (hits masqués) :
   ```bash
   test -f scripts/secrets-scan.sh && bash scripts/secrets-scan.sh || echo "⚠️ secrets-scan.sh absent"
   ```
3. **Infra** — pre-commit + deny rules + .mcp.json :
   ```bash
   grep -q "ds:token-drift" .husky/pre-commit && echo "✅ pre-commit" || echo "❌ pre-commit"
   for r in 'git reset --hard' 'git push --force' 'pnpm publish' 'npm publish'; do grep -q "$r" .claude/settings.json && echo "✅ deny: $r" || echo "❌ deny: $r"; done
   test -f .mcp.json && echo "✅ .mcp.json" || echo "⚠️ .mcp.json absent"
   ```
4. **DS** — invariant single-green :
   ```bash
   pnpm ds:token-drift && echo "✅ token-drift OK" || echo "❌ token-drift FAIL"
   grep -RnE '#16a34a|--ds-' cockpit-shell/tokens.css src/app/cockpit.css src/app/globals.css && echo "❌ single-green violé" || echo "✅ single-green OK"
   ```
5. **Clean (DRY-RUN seulement)** — jamais `--apply` ici :
   ```bash
   test -f scripts/clean-workspace.sh && bash scripts/clean-workspace.sh || echo "⚠️ clean-workspace.sh absent"
   ```
6. **Posture consolidée.** Tableau unique `axe | constat | sévérité`. Classement :
   - **P0** : secret live en fuite (fichier suivi), règle `deny` critique manquante, endpoint service prod FAIL.
   - **P1** : pre-commit cassé, `ds:token-drift` FAIL / single-green violé, MCP attendu absent.
   - **P2** : `.mcp.json` non pinné, clutter à nettoyer, sous-script d'axe encore absent.
   Lister les P0 EN PREMIER. Finir par 1 ligne de verdict global (GO / À CORRIGER).

## STOP

- Strictement read-only : `--apply` du clean est INTERDIT depuis l'ombrelle (passer par /clean-workspace avec confirmation).
- Aucun secret en clair, aucun commit/push, aucune correction auto.
- Si une étape P0 sort rouge : STOP au verdict, reporter, ne pas enchaîner de remédiation automatique.
