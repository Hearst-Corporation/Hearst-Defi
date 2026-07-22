# M10 — Backend source-of-truth (Series 1)

**Owner** : backend (Claude) · **Vague** : 1 (préparation contrats) → 2 (matérialisation) ·
**Dépend de** : M2 (models), décision #3 · **Périmètre** : `gpu1-backend/` (à créer),
`prisma/schema.prisma` (partagé M2), DTOs domain

## ⚠️ Contrainte STOP
`gpu1-backend/` est **spécifié mais ABSENT du disque** (voir `04-architecture-front-back.md`). Règle
d'Adrien : **STOP si le repo/package backend exact manque — mais préparer les contrats API + la
séparation.** Donc en Vague 1 : **préparer les DTOs + la frontière**, **ne pas matérialiser** le
service sans feu vert explicite (nom package, deploy, DATABASE_URL, secrets, CORS).

## Objectif
Faire du backend séparé la **source of truth** de tout calcul critique Series 1. Le front n'est plus
propriétaire d'aucun calcul métier Series 1.

## Ce que le backend possède (transféré du front)
vault state · B1/B2/B3 (allocations + soldes) · mining engine · BTC accumulation (range) ·
all-in BTC acquisition cost · curtailment · take-profit · Zandbank demo data · proof/attestations ·
contract indexing.

## Tâches
### Vague 1 — préparation (sans matérialiser le service)
1. **Contrat DTO partagé** : définir les DTOs canoniques Series 1 (`domain/`) — vault state, pockets
   B1/B2/B3, BTC accumulation range, acquisition cost, curtailment, take-profit, proof. **string /
   number uniquement** — jamais type Prisma, tuple ABI, ni BigInt nu. Emplacement de préparation :
   un module partageable (ex `src/lib/series1-contract/` ou `packages/*`) que le futur backend
   ré-exportera — décidé avec Adrien pour ne pas préjuger du package.
2. **Calcul côté serveur** : câbler l'engine pur (`src/lib/engine/mining-note-projection.ts`, M1)
   comme moteur de calcul **serveur** produisant les DTOs (range BTC, acquisition cost). L'engine
   reste pur ; c'est le **producteur de DTO** qui vit côté back.
3. **Spécifier le contract indexing** : comment les events `PermissionedDynaVault` (curtailment,
   take-profit, mining metrics — M3) sont indexés → persistés (models M2) → exposés en DTO.

### Vague 2 — matérialisation (SUR FEU VERT repo/package)
4. Créer `gpu1-backend/` (workspace package, Fastify + Prisma + Zod, Node 22) selon
   `docs/gpu1-backend-architecture.md` : `config/env.ts` (Zod, fail-loud), `persistence/prisma.ts`
   (même Supabase pooler), `api/` (routes par domaine), `domain/` (DTOs), `indexers/`, `workers/`.
5. Brancher les domaines Series 1 un par un (strangler) — voir M12.

## Invariants
- **Aucun calcul critique Series 1 propriétaire du front.**
- Supabase = **même** DB prod, non dupliquée ; schema single-sourced `prisma/schema.prisma`.
- Engine pur #6 préservé (appelé côté back, pas dupliqué).
- **Pas de DB write prod, pas de migration prod sans plan, pas de secrets commités.**
- STOP + flag si le package/repo exact n'est pas confirmé.

## Gate
`pnpm typecheck && pnpm test` sur les DTOs préparés. Si service matérialisé :
`pnpm --filter gpu1-backend typecheck && test`.

## Définition de fini
- **Vague 1** : DTOs Series 1 définis + calcul serveur câblé sur l'engine + indexing spécifié +
  flag STOP posé pour la matérialisation.
- **Vague 2** (feu vert) : service `gpu1-backend/` matérialisé, domaines Series 1 servis.
