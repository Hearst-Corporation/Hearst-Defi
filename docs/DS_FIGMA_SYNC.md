# Verrou Design System — tokens + sync Figma (AXIS 3)

Verrou **drift-only**. Le DS reste **librement éditable** (doctrine Adrien : pas de
source centrale, pas de gate lourd). Ce verrou empêche UNIQUEMENT la dérive des
invariants « un seul vert », pas l'édition.

Construit SUR le green-drift gate déjà finalisé (`scripts/ds-token-drift.mjs`,
commit `acf2ec9`, déjà en pre-commit + CI). On ne ré-arme RIEN de retiré.

## 1. Verrou d'invariants — `scripts/ds-lock-check.sh`

Garde rapide, read-only. Asserts :

1. `ds-token-drift.mjs` passe (brand + taxonomie).
2. `--ct-accent: #A7FB90` défini **exactement une fois** (dans `cockpit-shell/tokens.css`).
3. Zéro hex vert parasite (`#16a34a` & famille Tailwind) hors token, **commentaires CSS strippés**.
   - `#16a34a` du commentaire `pdf-palette` = ignoré (commentaire).
   - `--ct-text-on-accent: #06140A` = foreground noir sur accent, **exempté** (ce n'est pas un vert).
4. Zéro namespace `--ds-*` (runtime = `--ct-*` uniquement).
5. Ordre de cascade intact dans `src/app/layout.tsx` :
   `tokens-layer.css` (qui `@import` `cockpit-shell/tokens.css` en `layer(cockpit)`) → `globals.css` → `cockpit.css` (importé **en dernier**, unlayered = gagne).

```bash
# Lancer le verrou (exit non-zéro sur dérive)
bash scripts/ds-lock-check.sh
# ou via pnpm
pnpm ds:lock
```

## 2. Sync Figma → tokens.css — `scripts/ds-figma-sync.mjs` (REPORT-ONLY)

Diffe les **variables Figma** (source-of-truth design) contre `cockpit-shell/tokens.css`.
**Ne réécrit jamais** le DS — il SIGNALE les tokens qui ont dérivé. Adrien aligne à la main.

Deux sources, dans cet ordre :

### A. MCP `figma-dev-mode` (local, interactif depuis Claude Code)

Le MCP `figma-dev-mode` est un serveur **dev-mode LOCAL** (`http://127.0.0.1:3845/mcp`).
Il nécessite **Figma Desktop ouvert** sur le fichier DS (sinon `Failed to connect`).

Depuis Claude Code, vérifier puis appeler les outils MCP Figma :

```bash
claude mcp get figma-dev-mode      # doit afficher Status: Connected (Figma desktop ouvert)
```

Dans une session Claude Code (Figma desktop ouvert, frame/variables sélectionnés) :
- `/mcp` pour lister les serveurs,
- puis appeler l'outil Figma `get_variable_defs` (renvoie les variables du sélection/fichier).

En ligne de commande, forcer la voie MCP :

```bash
node scripts/ds-figma-sync.mjs --source=mcp
```

> Le MCP dev-mode est souvent injoignable en CLI pure (pas de desktop) — le script
> bascule alors automatiquement sur le fallback REST ci-dessous.

### B. Figma REST API (headless / CI)

Sans Figma Desktop (CI, terminal headless), le script utilise l'API REST :
`GET /v1/files/{FILE_KEY}/variables/local`, auth par header `X-Figma-Token`.

Variables d'environnement (à mettre dans `.env.local`, **jamais commitées**) :

| Var | Rôle | Où l'obtenir |
|---|---|---|
| `FIGMA_TOKEN` | Personal Access Token, scope `file_variables:read` | figma.com → Settings → Security → Personal access tokens |
| `FIGMA_FILE_KEY` | Clé du fichier Figma DS | dans l'URL : `figma.com/design/<FILE_KEY>/...` |
| `FIGMA_MCP_URL` | (optionnel) override de l'URL MCP locale | défaut `http://127.0.0.1:3845/mcp` |

```bash
# Diff headless (rapport humain)
FIGMA_TOKEN="$FIGMA_TOKEN" FIGMA_FILE_KEY="$FIGMA_FILE_KEY" \
  node scripts/ds-figma-sync.mjs

# Sortie machine (CI)
node scripts/ds-figma-sync.mjs --json

# Mode strict : exit 1 si au moins un token a dérivé (warning CI non-bloquant)
node scripts/ds-figma-sync.mjs --strict
```

> **Sécurité** : `FIGMA_TOKEN` est lu depuis `process.env` uniquement, jamais
> imprimé ni loggé. En cas d'erreur HTTP, seul le code statut est affiché.

### Convention de mapping nom

Variable Figma `Accent/Default` → token `--ct-accent` ; `Surface/0` → `--ct-surface-0`.
Slashes/espaces → tirets, lowercase, préfixe `--ct-`. Une variable déjà nommée
`--ct-…` est gardée telle quelle. Couleurs Figma `{r,g,b,a}` 0..1 → hex lowercase.

## 3. CI

`scripts/ds-lock-check.sh` tourne sur chaque PR (job `ds-lock`, voir
`.github/workflows/ci.yml`). Le sync Figma n'est **pas bloquant** : il peut tourner
en step `continue-on-error` informatif si `FIGMA_TOKEN` + `FIGMA_FILE_KEY` sont en
secrets GitHub (sinon il s'auto-skip proprement, exit 0).
