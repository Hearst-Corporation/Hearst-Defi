# GPU1 deployment runbook — connect-api

Le service `gpu1-backend` déployé sur GPU1 sous `~/connect-api`, supervisé par
**systemd system-level** (`connect-api.service`).

## Service (systemd, GPU1)

```
/etc/systemd/system/connect-api.service
  User=comput3
  WorkingDirectory=/home/comput3/connect-api
  EnvironmentFile=/home/comput3/connect-api/.env   (chmod 600, secrets hors Git)
  ExecStart=<node> <path>/node_modules/.bin/tsx src/index.ts
  Restart=on-failure  RestartSec=3
  MemoryMax=512M  LimitNOFILE=8192
  WantedBy=multi-user.target   (démarre au boot)
```

Vérifié : `systemctl is-active` = active, `is-enabled` = enabled ; restart volontaire
→ active ; `kill -9` → auto-restart <6 s ; `/health` récupéré.

### Commandes

```bash
sudo systemctl {status|restart|stop|start} connect-api.service
sudo journalctl -u connect-api.service -f          # ou ~/connect-api/service.log
curl http://127.0.0.1:3900/health                  # {"status":"ok"}
curl http://127.0.0.1:3900/ready                    # {"ready":true,"db":"ok",...}
```

### Bind

Le service bind sur **`127.0.0.1:3900`** (env `HOST`, défaut IPv4 loopback) — jamais
sur toutes les interfaces. Il n'est joignable QUE via le reverse proxy / tunnel.
(Un bind `*`/`::` écoute IPv6 en WSL2 et casse l'origin IPv4 de cloudflared.)

## Déploiement / mise à jour du code

```bash
# depuis le repo local
rsync -az --exclude node_modules --exclude .env --exclude service.log \
  gpu1-backend/src/ gpu1:~/connect-api/src/
ssh gpu1 'sudo systemctl restart connect-api.service'
```

Régénérer le client Prisma après un changement de schema :
```bash
ssh gpu1 'cd ~/connect-api && DATABASE_URL=$(grep ^DATABASE_URL= .env|cut -d= -f2-) \
  PRISMA_PROVIDER=postgresql npx prisma generate --schema prisma/schema.prisma'
```

## Exposition publique — connect-api.hearst.app

- Route ajoutée **chirurgicalement** dans `/etc/cloudflared/config.yml` **avant**
  l'entrée wildcard `*.hearst.app` (sinon captée par le fallback) :
  ```yaml
  - hostname: connect-api.hearst.app
    service: http://localhost:3900
  ```
- Backup avant édition : `/etc/cloudflared/config.yml.bak-p221-<ts>`.
- DNS : `cloudflared tunnel route dns 7b73bae6-… connect-api.hearst.app` → CNAME créé.
- Reload : `sudo systemctl restart cloudflared` (l'unit ne supporte pas `reload`).
- **Non-régression vérifiée** : `hearst.app` 200, `sci` 307, `aigent` 307 après restart.

### ⚠️ BLOCAGE EXTERNE CONFIRMÉ — edge 502 sur tout nouveau hostname (diagnostic P222)

`https://connect-api.hearst.app/{health,ready,runtime}` renvoie **502**. Diagnostic
de bout en bout mené au P222 — cause isolée, **externe et inaccessible** :

**Ce qui MARCHE (vérifié) :**
- service répond en local : `curl 127.0.0.1:3900/health` = 200 ;
- config `/etc/cloudflared/config.yml` = celle du process (`--config` confirmé) ;
- après un **restart complet** de cloudflared, `connect-api.hearst.app` **apparaît
  dans la config en mémoire** (`Updated to new configuration`) — donc chargée ;
- DNS proxied OK : `connect-api.hearst.app` résout vers des IP Cloudflare (172.67/104.26) ;
- `cloudflared tunnel route dns` = `already configured to route to your tunnel` ;
- tunnel `hearst-prod` (7b73bae6) actif avec connexions (cdg/dxb/nrt).

**Ce qui NE MARCHE PAS (cause) :**
- une requête publique vers connect-api **ne génère AUCUN log cloudflared** → l'edge
  Cloudflare ne route pas la requête vers CE cloudflared ;
- **un hostname de repli** (`connect-api-gpu1.hearst.app`), même service, même tunnel,
  donne **aussi 502** → le problème n'est PAS le nom, il est **général à tout nouveau
  public-hostname** ajouté via config locale sur ce tunnel ;
- les hostnames existants (`sci`, `power`, `strategy`) marchent car provisionnés
  autrement (à la création du tunnel / via dashboard Zero Trust).

**Conclusion :** il manque l'enregistrement **"public hostname" côté Cloudflare
Zero Trust** (le `route dns` crée le CNAME mais pas l'entrée public-hostname du
tunnel). Corrigeable UNIQUEMENT via le **dashboard Cloudflare Zero Trust** ou l'**API
Tunnel** — or le token disponible est **scopé R2** (`1001 Not authorized` sur l'API
tunnel). **Bloqué sans credential Cloudflare adéquat.**

**À finir (hors de ma portée actuelle) :** dashboard Cloudflare → Zero Trust →
Tunnels → hearst-prod → Public Hostnames → ajouter `connect-api.hearst.app` →
`http://localhost:3900`. OU fournir un token API scopé `Cloudflare Tunnel:Edit`.

> ⚠️ **Incident P222** : une édition YAML du config a cassé cloudflared (`activating`,
> hostnames existants en 530). **Restauré depuis `.bak-p221-*`** → tous les hostnames
> re-OK. Leçon : toujours `cloudflared tunnel ingress validate` **avant** restart, et
> restaurer au moindre `is-active != active`. Le config live a été remis à l'état
> pré-P222 (sans connect-api, qui ne fonctionnait pas de toute façon).

## Rollback complet

```bash
ssh gpu1 'sudo cp /etc/cloudflared/config.yml.bak-p221-<ts> /etc/cloudflared/config.yml \
  && sudo systemctl restart cloudflared \
  && sudo systemctl disable --now connect-api.service'
```
