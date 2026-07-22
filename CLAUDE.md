<!-- BEGIN:deploy-policy -->
PROD_AUTODEPLOY: true

**Tout `push`/`merge` sur `main` déploie IMMÉDIATEMENT en production Vercel**
(`connect.hearst.app`) — l'intégration Git Vercel n'est PAS bloquée par `ci.yml`
(voir `docs/DEPLOYMENT.md`). `main` est un déclencheur de déploiement, pas une branche
d'intégration gatée. **STOP avant tout push/merge sur `main` sans confirmation explicite
d'Adrien** — ce push EST le déploiement production. La protection de branche exigeant
`ci.yml` est un chantier séparé, pas encore câblé.
<!-- END:deploy-policy -->

# CLAUDE.md — Hearst Connect (`connect — Hearst Defi`)

> Adapter local du socle global `~/.claude/CLAUDE.md` + `dev-agent-rules.md`.
> Workflow git/multi-agent : le socle global s'applique (un seul intégrateur, staging
> chirurgical, worktree seulement sur collision réelle) + les spécificités ci-dessous.

## RÈGLE DESIGN #0 — liberté visuelle totale · seul impératif : composants Catalyst

L'UI se construit avec les **composants Catalyst** (`src/components/catalyst/*` + primitives).
C'est le seul garde-fou design. **Tout le reste est LIBRE** : tokens, classes, hardcode,
refonte de section, layout, palette, typo, espacements — pas de mono-accent imposé, pas
d'échelle figée, pas de frontière dashboard/marketing. **Ceci ANNULE, pour ce repo, la
section design du CLAUDE.md global.** Seul garde-fou restant (et c'est du PRODUIT) :
**honnêteté des états** — portfolio sans position active → layout vide honnête, jamais de
faux badge `Live`/`Verified` ni de chart fictif.

## Ce que c'est

Single-vault institutional DeFi platform. **Hearst Mining Note** (sur
`PermissionedDynaVault v2.1`, Base Sepolia testnet). Instrument d'accumulation BTC adossé
au mining réel, **3 pockets on-chain 40/27/33** (B1 Mining Power / B2 BTC Pouch / B3
Reserve USDC). BTC **accumulé sur 24 mois, livré à maturité** — pas de distribution
périodique, pas d'APY fixe. Retour estimé **en fourchette, en BTC accumulé, non garanti**
(méthodologie **v3.0**, ADR-019). Cayman SPV, ticket min $250k, soft lock-up 60 jours.
*(L'ancien framing « yield vault / APY 8-15% » est retiré — v3.0 l'a remplacé.)*

## Source of truth (lire avant tout feature work)

- **Agent routing** : `AGENTS.md` (keystone) → `docs/*_CONTEXT.md`, `docs/DO_NOT_TOUCH.md`,
  `docs/OWNERSHIP_MATRIX.md`, `docs/COMMON_TASKS.md`, `docs/SYSTEM_MAP.md`. Règles Cursor scopées `.cursor/rules/`.
- **Product spec** : `/docs/spec/*.mdx` · **Méthodologie** : `/docs/methodology/v3.0.md`
  (active ; v1.0/v2.0 = références historiques immuables, v2.1-draft jamais ratifiée).
- **Décisions** : `/docs/decisions/ADR-*.md` (append-only) · **Roadmap** : `/docs/roadmap.json` + `/admin/roadmap`.
- **Design system** : DS Cockpit dé-vendoré dans `cockpit-shell/` (cascade
  `cockpit-shell/tokens.css` → `src/app/cockpit.css` → `src/app/globals.css`), éditable
  librement (RÈGLE #0). Docs : `docs/DESIGN_SYSTEM.md` + `docs/CSS_INDEX.md`.
- **Plan source** : `~/.claude/plans/tu-es-claude-opus-functional-eich.md` — si le plan et
  le code divergent, le plan gagne (sauf plan faux : corriger le plan d'abord).

## Non-negotiables (CI en applique la plupart)

1. **Retour estimé toujours en fourchette**, jamais un point (`"9.4-12.8%"`, pas `"11%"`) —
   sous v3.0 la fourchette décrit du **BTC accumulé**, pas une distribution.
2. **Chaque métrique porte un badge de provenance** : Live / Oracle / Attested / Estimated / Manual / Stale.
3. **Format PTAI obligatoire** pour simulations et rebalancing : Projection → Trigger → Action → Impact.
4. **Aucun chat IA à outils d'écriture auto-exécutés.** Les 4 batch agents produisent du JSON
   structuré. UN chat cockpit (moteur unique LP/admin/review — ADR-017), navigation read-only
   whitelist, outils write TOUJOURS human-in-the-loop (draft + confirmation deux étapes).
   **Aucune action financière/custodiale depuis le chat, jamais** (ADR-012 + ADR-017).
   Kill-switch `CHAT_MASTER_AGENT`. Exception envoi outreach (ADR-016) : Tier B/C seulement
   si `OUTREACH_AUTONOMY=SEND`+, **Tier A jamais auto-envoyé**, cap journalier, audité.
5. **Mots interdits dans les sorties agents** : "guarantee", "promise", "certain", "will deliver", "risk-free".
6. **Engine pure-function** : pas de DB/fetch/I/O dans `src/lib/engine/*` (modélise la note
   v3.0 : mining economics, take-profit, vending curve, curtailment, projection BTC).
7. **Monte Carlo autorisé (V2, ADR-006)** à côté du rule-based (défaut). Seed PRNG injecté
   (pas de `Math.random()`/`Date.now()` non gouvernés). Le produit actif (v3.0) n'exige pas MC.
8. **Smart contracts** : cible `PermissionedDynaVault v2.1` (interface : `docs/VAULT_SPEC_V2.1.md`),
   **écrit mais NON déployé** (adresses TBD) ; l'app tourne en mode `legacy` sur l'ERC-4626
   `HearstYieldVault` jusqu'à `NEXT_PUBLIC_DYNAVAULT_ADDRESS`. **Mainnet gaté sur audit
   Spearbit complété + remédiation** (ADR-006).
9. **Vault id = clé de premier rang** (`engine/vaults.ts`) : aucun vault ne réutilise les
   chiffres d'un autre en silence. Le produit actif est UNE mining note (v3.0).
10. Toute projection montre ses **assumptions** + disclaimer **"not guaranteed"**.
11. **HARD RULE — zéro import cross-projet.** Interdit de copier/importer quoi que ce soit
    depuis `/Users/adrienbeyondcrypto/Dev/Projects/hearst-connect` (ou tout repo frère) :
    référence read-only, chaque ligne livrée ici est **recodée from scratch**.

## Stack

- Next.js 16 (App Router, Server Components par défaut) · TypeScript strict · Tailwind v4
  (thème dans `globals.css` `@theme`, pas de config JS).
- Prisma + Postgres (Supabase en prod, SQLite en dev local `DATABASE_URL=file:./prisma/dev.db`) ·
  Inngest (jobs/crons) · Foundry (contrats, Base Sepolia).
- LLM : **OpenAI GPT-4.1** (`src/lib/llm/openai.ts`, ADR-011). Pas d'Anthropic SDK, plus
  aucun export `kimi`/`KIMI_*` (retirés — ne pas les chercher).
- Package manager : **pnpm** (workspace `pnpm-workspace.yaml`) · **port dev : 4105** (`next dev -p 4105`).
- Alias : `@/*` → `./src/*` ; `@hearst/cockpit-shell` → `./cockpit-shell/src` (tsconfig + vitest).

## Commandes (formes réelles — les wrappers prisma-provider sont load-bearing)

```bash
pnpm dev          # next dev -p 4105 (Turbopack root épinglé)
pnpm build        # prisma-provider.mjs && prisma generate && NODE_ENV=production next build
pnpm typecheck    # tsc --noEmit — LA gate réelle (lint = `eslint src || true`, advisory)
pnpm test         # vitest run PUIS scripts/restore-prisma-provider.mjs (restaure le provider)
pnpm test:e2e     # Playwright
pnpm db:generate | db:push | db:migrate | db:studio
```

Vitest 4 et Playwright sont câblés — ne pas re-configurer.

## Multi-agent — spécificités de ce repo (socle global pour le reste)

- **Locks** : inspecter `docs/agent-file-locks.md` avant d'éditer ; réserver ses fichiers ;
  chemin locké par un agent actif → ne pas toucher, signaler.
- **Fichiers single-owner** (un seul agent à la fois) : `prisma/schema.prisma`, `package.json`,
  `pnpm-lock.yaml`, `next.config.*`, `tailwind.config.*`, `src/app/api/cockpit-chat/route.ts`,
  `src/lib/llm/tools/registry.ts`, `src/lib/canvas/{compose,emit}.ts`, `src/app/globals.css`,
  `src/app/doc-flow.css`, `src/app/admin/admin-proof.css`, `docs/agent-file-locks.md`,
  `CLAUDE.md`, `.mcp.json`.
- **`.mcp.json` = sécurité** : Supabase MCP reste `--read-only` ; jamais de commit qui retire
  ce flag sans approbation explicite.
- Jamais commités : `.env*`, `*.local`, `screenshots/`, `tmp/`, `logs/`, `coverage/`,
  `playwright-report/`, `.continue/`, `.DS_Store`.

## Architecture & conventions

Produit construit, pas un squelette : cockpit investisseur (`src/app/(product)/*`) + console
admin (`src/app/admin/*`, ~20 sections) sur le shell Cockpit 3 colonnes ; engine pur
(`src/lib/engine/*`), 4 batch agents + LP Master Agent, jobs Inngest, contrats Base Sepolia.
Prod DB = Supabase Postgres (~50 tables Prisma), storage bucket `reports`.
Pattern de mutation canonique (toute surface admin) : static doc → Prisma overlay → Server
Component query → Server Action (`requireAdmin` → rate-limit → Zod → `$transaction` → audit →
`revalidatePath`). Zéro fetch client. Détail : `docs/BACKEND_CONTEXT.md` + `docs/SYSTEM_MAP.md`.

Conventions : Server Components par défaut ; pas de `any` ni `as unknown as` ; `server-only`
sur tout module touchant fs/prisma ; `cn()` de `@/lib/cn` ; env validée Zod (`src/lib/env.ts`).

## Sub-agents disponibles

4 spécialistes sous `.claude/agents/` (scope + forbidden propres, plus stricts que ce
fichier) : `engine-dev` (engine, refuse UI et I/O), `agent-dev` (agents, GPT-4.1 pinned),
`sc-dev` (contrats Foundry), `ui-dev` (app/components, refuse la logique métier).
Routage tâche→fichiers et STOP conditions par rôle : `AGENTS.md` + `.cursor/rules/*.mdc`.
