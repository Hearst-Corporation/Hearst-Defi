---
description: Posture de verrouillage infra — secrets-scan + pre-commit + deny rules settings.json + .mcp.json pinné
allowed-tools: Bash(bash scripts/secrets-scan.sh:*), Bash(cat .husky/pre-commit), Bash(cat .claude/settings.json), Bash(cat .mcp.json), Bash(ls:*), Bash(test:*), Bash(grep:*)
---

# /lock-infra — posture de verrouillage infra

Objectif : confirmer en un clic que les garde-fous infra sont en place : pas de
secret en fuite, le hook pre-commit actif, les règles `deny` Claude Code présentes,
et `.mcp.json` projet pinné (versionné). Aucun secret n'est affiché.

## Étapes

1. **Scan secrets** (réutilise l'axe Secrets ; absence non bloquante mais signalée) :
   ```bash
   test -f "scripts/secrets-scan.sh" && bash scripts/secrets-scan.sh || echo "⚠️ scripts/secrets-scan.sh absent — sous-check sauté."
   ```
2. **Vérifier le hook pre-commit** (doit invoquer le drift DS) :
   ```bash
   test -x ".husky/pre-commit" && grep -q "ds:token-drift" ".husky/pre-commit" && echo "✅ pre-commit actif (component-index + ds:token-drift)" || echo "❌ pre-commit manquant ou drift DS non câblé"
   ```
3. **Vérifier les règles deny Claude Code** dans `.claude/settings.json` :
   ```bash
   for r in 'git reset --hard' 'git push --force' 'git push -f' 'pnpm publish' 'npm publish'; do
     grep -q "$r" ".claude/settings.json" && echo "✅ deny: $r" || echo "❌ deny MANQUANT: $r"
   done
   ```
4. **Vérifier .mcp.json pinné** (créé par l'axe Infra ; encore absent aujourd'hui = WARN, pas FAIL) :
   ```bash
   test -f ".mcp.json" && echo "✅ .mcp.json présent (MCP projet versionné)" || echo "⚠️ .mcp.json absent — MCP projet non pinné (à livrer par l'axe Infra)"
   ```
5. **Posture.** Tableau `garde-fou | état ✅/⚠️/❌`. P0 = secret en fuite ou deny manquant. P1 = pre-commit cassé. P2 = .mcp.json absent.

## STOP

- Read-only : ne JAMAIS éditer settings.json, le hook, ou .mcp.json depuis cette commande — elle CONSTATE la posture.
- Si un `deny` critique manque ou un secret fuit : STOP, reporter en P0, ne pas auto-corriger.
