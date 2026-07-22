# M2 — Data : DROP distribution, CREATE mining-note models, ingest on-chain, seed, env

**Owner** : backend (Claude) + `agent-dev` pour loaders · **Vague** : 1 · **Dépend de** : — ·
**Périmètre** : `prisma/*`, `src/lib/inngest/*`, `src/lib/env.ts`, `src/lib/distribution/*` (models),
`src/lib/agents/loaders/*`, seed

## Objectif
Faire converger la couche données vers le mining note : retirer la couche distribution morte,
créer les models que le note exige (take-profit / curtailment / BTC-accumulation), câbler
l'ingest on-chain, corriger le faux seed, valider `KEEPER_*` par Zod.

## Contexte
Voir `02-cartography.md §E`. `prisma/schema.prisma` est **single-owner** — réserver le lock avant
édition. Provider Postgres verrouillé prod (migration = port direct 5432, cf. mémoire).

## Tâches (fichier:ligne)
1. **DROP distribution** (ADR-019 §89) : retirer models `Distribution` (`schema.prisma:207`),
   `DistributionLedgerEntry` (`:1026`), `DistributionApproval` (`:241`), `Pcap` (`:1038`) +
   **migration Postgres nommée**. Neutraliser d'abord (Q4 : stop écriture avant drop dur) les
   champs `Position.distributedUsdc` (`:456`), `InvestorTransaction.type="distribution"` (`:480`).
2. **CREATE models mining-note** : take-profit history, curtailment events, BTC-accumulation
   (satoshis réalisés). Aujourd'hui **0 hit** dans schema. FK sur `vaultDeploymentId`, `CHECK` sur
   enums, index sur colonnes de WHERE/ORDER BY, IDs `crypto.randomUUID()`.
3. **KILL crons distribution** : supprimer `src/lib/inngest/functions/distribution-executed.ts` ;
   recadrer/renommer la cadence `investor-memo-monthly.ts:26` (Q3 : memo survit, cadence renommée) ;
   retirer copie `nextDistributionAt` de `src/lib/data/time-to-cash.ts:29,59-63`.
4. **CREATE ingest on-chain** : job Inngest lisant `reportMiningMetrics` / take-profit /
   curtailment (events ABI `dynavault.ts:383/366/375`, vending `:639`) → persistance des models §2.
   Aujourd'hui `MiningMetric` est off-chain avec placeholders en dur
   (`market-data-hourly.ts:120-121` `uptimePct:98.5`, `deployedHashrate:182_000`). **Dépend
   partiellement de M3** (contrat déployé pour que les reads renvoient autre chose que `unavailable`).
   Livrer le job **guardé** (no-op propre tant que mode `legacy`).
5. **REMAP allocations** : `Allocation.bucket` / `VaultSnapshot` (`schema.prisma:34,51`) sur
   B1 40 / B2 27 / B3 33 (ADR-019 §44). Coordonner la migration avec le drop distribution.
6. **RÉSORBER dérive schéma** : versionner `NavTrace` (`:885`) + famille `strategy_*`
   (`:1320-1478`) — aujourd'hui db-push-only sans migration — **avant** d'empiler les migrations du
   pivot, sinon la première migrate génère un diff parasite.
7. **SEED** : purger distributions démo `seed.ts:218-240` ; corriger faux
   `minTicketUsdc:500_000` (`seed.ts:743`) → 250k ; réaligner `seed-zand-demo.ts` (coordonner M8
   qui possède `zand-fixture.ts`). Respecter le garde-fou seed prod (throw si DATABASE_URL=prod
   sauf ALLOW_PROD_WRITES=1 — mémoire).
8. **ENV Zod** (`env.ts`) : ajouter `KEEPER_ENABLED` + `KEEPER_PRIVATE_KEY` (aujourd'hui lus brut
   `keeper.ts:184,209`) — validation format + guard prod, fail-closed. Marquer les adresses
   ERC-4626 legacy (`env.ts:54-55`) comme dette à retirer une fois DynaVault déployé (ne pas les
   retirer maintenant — legacy actif).

## Invariants
- **Back-end #sécurité** : migrations paramétrées, FK/CHECK/index, pas de liste sans LIMIT.
- Supabase MCP reste **read-only** (aucune écriture sans accord explicite Adrien).
- Migration prod = port direct 5432 + `--accept-data-loss` + `</dev/null` (mémoire), et
  **jamais** sans confirmation Adrien (touche la prod).

## Gate
`pnpm typecheck && pnpm test` + `pnpm db:generate` propre. Migration testée sur SQLite dev **puis**
proposée pour Postgres (non appliquée prod sans accord).

## Définition de fini
Models distribution retirés + migration ; models take-profit/curtailment/BTC-accum créés + ingest
job guardé ; dérive schéma résorbée ; seed corrigé (250k, sans distribution) ; `KEEPER_*` sous Zod ;
tests verts.
