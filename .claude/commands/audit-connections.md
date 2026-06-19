---
description: Audit lecture-seule des connexions — MCP servers + endpoints services (OK/FAIL), zéro secret affiché
allowed-tools: Bash(bash scripts/audit-connections.sh:*), Bash(claude mcp list), Bash(claude mcp get:*), Bash(ls:*), Bash(cat scripts/audit-connections.sh)
---

# /audit-connections — état des connexions (read-only)

Objectif : vérifier en un clic que les serveurs MCP et les endpoints de services
(OpenAI, Supabase, Privy, Sumsub, Fireblocks, HubSpot, Resend, Sentry, Vercel,
GitHub, Inngest, Upstash, Langfuse, Axiom) répondent. AUCUN secret n'est imprimé :
le script lit `process.env` / `.env.local` et ne ressort que des statuts masqués.

## Étapes

1. **Vérifier la présence du script.** S'il manque, STOP et le signaler :
   ```bash
   test -f "scripts/audit-connections.sh" || { echo "❌ scripts/audit-connections.sh absent — l'axe Connexions ne l'a pas encore livré. STOP."; exit 0; }
   ```
2. **Lancer l'audit endpoints** (read-only, idempotent) :
   ```bash
   bash scripts/audit-connections.sh
   ```
3. **Lister les serveurs MCP** vus par Claude Code :
   ```bash
   claude mcp list
   ```
   Attendu (config globale ~/.claude.json) : `figma-dev-mode`, `playwright`, `supabase`, `cortex`.
   Note : `mcpServers` projet est vide tant que l'axe Infra n'a pas pinné `.mcp.json`.
4. **Synthèse.** Tableau `service | statut OK/FAIL | provenance (env présent ? endpoint joignable ?)`.
   Lister d'abord les FAIL. Ne jamais afficher de valeur de clé — uniquement présent/absent.

## STOP

- Read-only strict : ne JAMAIS écrire, ré-essayer un endpoint en boucle, ni imprimer une clé.
- Si `claude mcp list` n'est pas dispo dans l'environnement, le noter et continuer (non bloquant).
- Ne pas tenter de "réparer" une connexion FAIL ici — c'est un audit. Reporter, puis STOP.
