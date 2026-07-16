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

### ⚠️ BLOCAGE OUVERT — edge 502

`https://connect-api.hearst.app/{health,ready,runtime}` renvoie **502** alors que :
- le service répond en local (`curl 127.0.0.1:3900/health` = 200) ;
- l'ingress cloudflared live contient bien `connect-api.hearst.app` (confirmé dans
  les logs `Updated to new configuration`) ;
- la syntaxe est **identique** à `sci.hearst.app → 127.0.0.1:3110` qui, lui, répond (307).

Le 502 est spécifique à ce **hostname neuf**. Hypothèse la plus probable :
provisioning/propagation edge Cloudflare (routing tunnel/cert edge pas encore
actif pour ce hostname) — non résolu ici sans accès dashboard Cloudflare. Le token
API disponible est scopé R2 (pas Tunnel). **À finir** : vérifier côté dashboard
Cloudflare que le hostname est proxied (orange) et rattaché au bon tunnel, ou
attendre la propagation. Rollback dispo : restaurer le `.bak-p221-*`.

## Rollback complet

```bash
ssh gpu1 'sudo cp /etc/cloudflared/config.yml.bak-p221-<ts> /etc/cloudflared/config.yml \
  && sudo systemctl restart cloudflared \
  && sudo systemctl disable --now connect-api.service'
```
