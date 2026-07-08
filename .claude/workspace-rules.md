# Workspace rules — carte d'entrée agent (Hearst Connect)

> **Ce fichier ne redéfinit rien.** Il est le point d'entrée court (< 2 min) pour un agent
> qui atterrit dans ce repo sans contexte. Les règles autoritaires vivent dans les fichiers
> pointés ci-dessous — ce sont EUX qui priment, pas ce résumé.
> **Ordre de préséance en cas de conflit :** `CLAUDE.md` racine → `.cursor/rules/*.mdc` →
> `AGENTS.md` → per-domain `docs/*_CONTEXT.md` → ce fichier.

## 1. Nature du repo (1 phrase)

Plateforme DeFi institutionnelle mono-vault (**Hearst Yield Vault**) — Next.js 16 + TS strict +
Tailwind v4 + Prisma/Postgres, cockpit investisseur + console admin, 4 agents batch GPT-4.1 +
un chat cockpit HITL, contrats ERC-4626 Base Sepolia. Produit **construit**, pas un squelette.

## 2. Où sont les vraies règles (ne pas les recopier, les LIRE)

| Sujet | Source autoritaire |
|-------|--------------------|
| Non-négociables produit (APY range, provenance, PTAI, mots interdits, engine pur) | `CLAUDE.md` racine → « Non-negotiables » |
| Où commencer selon la tâche · routing | `AGENTS.md` |
| Git : staging chirurgical, 3 niveaux A/B/C, STOP | `.cursor/rules/commit-discipline.mdc` |
| Worktree / isolation multi-agents | `.cursor/rules/worktree-isolation.mdc` + `docs/AGENT_WORKFLOW.md` |
| Quelle validation lancer pour ma tâche | `docs/VALIDATION_MATRIX.md` |
| Zones à ne pas toucher | `docs/DO_NOT_TOUCH.md` |
| Qui possède quel fichier | `docs/OWNERSHIP_MATRIX.md` |
| Modèle mental / carte système | `docs/SYSTEM_MAP.md` |
| Design system (tokens `--ct-*`, cascade CSS) | `docs/DESIGN_SYSTEM.md` + `docs/CSS_INDEX.md` |
| Contexte par domaine | `docs/*_CONTEXT.md` (UI, BACKEND, AGENTS, EMAIL, DEFI, AUTH_USERS, PROOF_COMPLIANCE) |

Sub-agents spécialisés : `.claude/agents/{engine,agent,sc,ui}-dev.md` (scope + interdits par rôle).

## 3. Réflexes non négociables (rappel — détail dans les sources ci-dessus)

- **Lire avant d'écrire.** Charger le `docs/*_CONTEXT.md` du domaine, pas tout le README.
- **Staging chirurgical uniquement.** Jamais `git add -A` / `-u` / `.` / `git commit -a`.
- **Un commit = un lot = un scope = un owner.** Vérifier `git diff --cached --name-only` avant.
- **Pas de commit/push sans demande explicite.** Push `main` = deploy prod Vercel (`connect.hearst.app`) →
  **jamais push/merge `main` sans confirmation utilisateur** (cf. `docs/DEPLOYMENT.md`).
- **Fichiers single-owner sensibles → STOP + confirmer** (liste dans `CLAUDE.md` : `prisma/schema.prisma`,
  `package.json`, `pnpm-lock.yaml`, `next.config.*`, `src/app/globals.css`, `.mcp.json`, etc.).
- **`.mcp.json` Supabase reste `--read-only`** sauf accord explicite. Ne jamais retirer `--read-only`.
- **Secrets** : jamais afficher/copier/committer/déplacer. Aucun `.env` réel n'est tracké (seuls
  `.env.example` / `.env.production.example` le sont) — ne pas commiter `.env` / `.env.local` / `*.local`.
- **Permission/gate refusée → STOP.** Pas de retry, pas de `--no-verify` de contournement.
- **Toujours** vérifier `git diff`, rapporter les fichiers modifiés et les validations exécutées.

## 4. Validations réelles (scripts existants — ne rien inventer)

```bash
pnpm typecheck   # tsc --noEmit — LE gate réel
pnpm test        # vitest run (~2400 tests)
pnpm build       # build prod
pnpm lint        # eslint src — advisory (n'est pas le gate)
pnpm test:e2e    # Playwright — non bloquant
```

Détail tâche → commande minimale : `docs/VALIDATION_MATRIX.md`.
Gates qualité : `pnpm quality` (jscpd + knip, baselines) — voir `package.json`.

## 5. STOP (arrête-toi et demande)

- Arbre git dans un état non compris (dirty inconnu, conflits) → STOP, rapporter, ne pas revert.
- Fichier single-owner sensible dans ton lot → STOP, confirmer.
- Une règle demande de contourner un garde-fou (auth, `--read-only`, CSP, secrets) → STOP.
- Le prompt reçu contredit une source autoritaire ci-dessus → signaler l'écart, ne pas écraser en silence.
