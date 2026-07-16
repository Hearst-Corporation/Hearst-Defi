# GPU1 runtime — état existant (inspecté 2026-07-16, PROMPT 219)

Inspection SSH réelle de `gpu1` (LAN 192.168.1.200, WSL2 Ubuntu 24.04, user
`comput3`) avant de créer quoi que ce soit — on réutilise la stack canonique, on
ne monte pas une architecture concurrente.

## Stack généraliste

| Élément | Version / état |
|---|---|
| OS | Ubuntu 24.04.2 LTS (WSL2, x86_64) |
| Node | v22.23.1 (`/usr/bin/node`) |
| pnpm | présent (`/usr/bin/pnpm`) |
| Docker | 29.2.1 |
| Reverse proxy | nginx (actif) + **Caddy par app** (containers `*-caddy`) |
| Tunnel | `cloudflared` (systemd, tunnel `7b73bae6…`, `*.hearst.app`) |
| CI | **GitHub Actions runner `Hearst-Corporation-Hearst-Defi.gpu1-defi` actif** (déploiement Connect→GPU1 déjà câblé) |

## Pattern per-app canonique (à réutiliser tel quel)

Chaque produit sur GPU1 = un **container applicatif + un Caddy dédié + PostgREST +
Storage**, exposé par cloudflared sur `<slug>.hearst.app` / `<slug>-db.hearst.app`.
Exemples vivants observés (`docker ps`) :

- `aigent-app` (`127.0.0.1:8099→3000`) + `aigent-caddy` + `aigent-postgrest` + `aigent-db`
- `hearst-intelligence-*` (gotrue + caddy `:8093` + storage + postgrest)
- `btc-case-platform-*` (app `:3210` + db `:8090` + **pooler pg `:6432`**) — domaine proche
- `hearst-power-management` (`:6011→3000`) + storage
- `real-estate-agent-*`, `studio-*`, `nexus-*` — même moule

Gateway : `hearst.app/connect/`, `/api/`, `/v1/`, `/agent/` routent déjà vers
`localhost:3848` (un routeur applicatif existant). `*.hearst.app` fallback → `:3000`.

## Services systemd notables

`hedge-engine`, `hedge-risk-engine`, `hedge-strategy-builder` (pipeline Hedge
24/7), `hearst-gpu-pulse` (NVML→cockpit), `cloudflared`, `tailscaled`, le runner
GitHub `gpu1-defi`. **Ne jamais interrompre** ces services prod (règle d'or INFRA.md).

## LLM local (réutilisable pour les AI Experts, plus tard)

`openclaw-vllm-*` : coding `:8000`, fast `:8001`, embeddings `:8002`, reasoning
`:8003`, mistral `:8004` + `openclaw-redis :6379`. Les AI Experts pourront
consommer ces endpoints **via GPU1**, jamais depuis le frontend.

## Décision d'intégration pour `gpu1-backend`

- **Déploiement** : container Docker + Caddy + route cloudflared, buildé/poussé par
  le runner `gpu1-defi` déjà présent. Slug proposé : `connect-api.hearst.app`
  (à créer côté cloudflared config quand le service sera déployé — pas dans cette passe).
- **DB** : réutilise le pooler Supabase prod (`DATABASE_URL` identique à Connect).
  Le pooler pg local `:6432` de `btc-case-platform` n'est PAS réutilisé — la base
  canonique reste Supabase, on n'en duplique aucune.
- **Port applicatif** : `3900` (libre — la plage 3000/3100/3110/3210/3848 est prise).
- **Secrets** : environnement GPU1 (jamais Git), pattern `.env` per-app comme les
  autres containers.

> Ce fichier documente l'existant au moment T. Toute évolution infra GPU1 →
> le mettre à jour + vérifier `Local Server/INFRA.md`.
