# 03 — Plan d'exécution : vagues, dépendances, anti-collision

Ce plan n'est **pas** exécuté par ce pack (mode `prepare`). Il décrit **comment** lancer les 9
missions quand Adrien le déclenche, en respectant le workflow multi-agent du `CLAUDE.md` local
(worktrees, locks `docs/agent-file-locks.md`, commit atomique, gate `pnpm typecheck` + `pnpm test`,
push/merge sur `main` **uniquement sur confirmation explicite** — un push `main` = deploy prod).

---

## Séquencement en 3 vagues

```
VAGUE 1 — fondations (parallèles, zéro collision entre elles)
  M1 engine ─┐
  M2 data  ─┼─► pas de fichier partagé (engine/ vs prisma+inngest+env vs contracts+chain)
  M3 sc    ─┘

VAGUE 2 — surfaces (parallèles entre elles, dépendent de la vague 1)
  M4 cockpit  (dépend M1 range BTC + M2 KPI acquisition cost)
  M5 borrow/LTV retrait  (dépend décision #2)
  M6 chat+agents  (dépend M1 vocabulaire)
  M7 proof + rail distribution  (dépend M2 models)
  M8 docs + demo Zandbank  (dépend M1+M2 pour cohérence chiffres)

VAGUE 3 — cosmétique (dernier)
  M9 rebrand  (dépend décision #1 + M4-M8 convergés)
```

## Décisions bloquantes (voir `00-decisions-required.md`)

- **#1 rebrand** → conditionne **M9** (défaut : différer).
- **#2 borrow/LTV** → conditionne la **forme** de **M5** (défaut : (b) deux produits distincts,
  isolation plutôt que suppression).

Les vagues 1 et 2 (hors M9) peuvent démarrer sans trancher #1. M5 a besoin de #2.

## Ownership & fichiers (anti-collision)

Les périmètres sont **disjoints par construction** — dérivé de `docs/OWNERSHIP_MATRIX.md` +
`coordination.md`. Fichiers **single-owner** sensibles (à réserver dans
`docs/agent-file-locks.md` avant édition) : `prisma/schema.prisma` (M2 seul),
`src/lib/llm/tools/registry.ts` (M6 seul), `src/app/globals.css` (aucune mission ne devrait y
toucher), `package.json` (M2/M8 si scripts — sérialiser).

| Mission | Périmètre exclusif | Ne touche jamais |
|---|---|---|
| M1 | `src/lib/engine/*` (+ ses `__tests__`) | UI, prisma, chain, agents |
| M2 | `prisma/*`, `src/lib/inngest/*`, `src/lib/env.ts`, `prisma/seed*.ts`, `src/lib/distribution/*` (models) | `src/app/*`, engine, prompts |
| M3 | `contracts/*`, `src/lib/chain/*`, `config/deployments.*` | UI, prisma, engine |
| M4 | `src/app/(product)/{vaults,portfolio,my-vaults}/*`, `src/components/vaults/*`, `src/components/portfolio/*` (hors capital-protection→M5), `src/lib/data/vaults.ts`, `src/lib/format/apy.ts`, `src/lib/constants/vault.ts` | engine, prisma, chain, admin |
| M5 | `src/app/(product)/portfolio/preview/*`, `src/components/portfolio/position-capital-protection.tsx`, `portfolio/_cockpit/pilot-fixtures.ts`, isolation `src/lib/products/*` (selon décision #2) | term-sheet/deposit (→M4) |
| M6 | `src/lib/llm/*`, `src/lib/agents/*` (prompts, guards, 4 agents) | UI, prisma, contracts |
| M7 | `src/app/admin/distributions/*`, `src/app/admin/proof*/*`, `src/components/proof-center/*`, `src/lib/proof-center/*`, `src/components/nav/product-nav-items.ts`, `src/lib/admin/overview-clusters-view.ts` | engine, contracts |
| M8 | `docs/spec/*`, `docs/roadmap.json`, `src/lib/demo/*`, `scripts/*zand*`, PDF wordmark (coord. M9) | src/app, engine |
| M9 | wordmarks legacy (cover.tsx, disclaimer.tsx, glossary, vaults labels, ticker) | logique produit |

**Frontière M4 / M5** : M4 possède term-sheet + deposit + position hero KPI ; M5 possède
`position-capital-protection.tsx` + sandbox `preview` + isolation modèles à levier. Aucun fichier
commun. Si un fichier doit être touché par les deux → **sérialiser** (M4 d'abord, puis M5).

## Gate par mission (avant tout commit)

- Détection gate (repo JS avec `pnpm`) : `pnpm typecheck` (le vrai gate — lint = `eslint src || true`
  advisory) + `pnpm test` (~2400 vitest) + `pnpm build`. M3 ajoute `forge build && forge test`.
- Chaque mission compare la gate **avant/après** son diff et ne bloque que sur une **régression
  qu'elle introduit** (main peut déjà être rouge d'environnement — ne pas s'y arrêter).
- **Playwright / vérif browser** sur toute mission à surface produit (M4, M5, M7) : Adrien pilote
  la validation visuelle (mémoire : jamais de navigateur piloté par l'agent) — les missions
  produisent des screenshots demandés à Adrien, pas de pilotage autonome.

## Ce que le pack NE fait pas (garde-fous)

- Aucun push/merge `main` sans confirmation explicite (deploy prod).
- Aucun agent ne touche git (RULE 0) — intégration par l'orchestrateur seul.
- Aucune suppression de `--read-only` sur Supabase MCP.
- Mainnet reste gaté Spearbit (M3 s'arrête au testnet Base Sepolia).
