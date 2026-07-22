# 04 — Architecture front / back (décision #3, ACTÉE)

**Principe** : **Frontend Hearst-Defi = consommateur. Backend séparé = source of truth.**
**Aucun calcul critique Series 1 ne doit rester propriétaire du frontend.**

---

## État réel vérifié (2026-07-18, HEAD `eca69561`)

| Élément | Documenté | Sur le disque |
|---|---|---|
| Politique "frontend API-only" | ✅ `docs/frontend-api-only-policy.md` (PROMPT 218) | actée |
| Architecture cible `gpu1-backend/` | ✅ `docs/gpu1-backend-architecture.md` (PROMPT 219) — workspace package monorepo, Fastify + Prisma + Zod, Node 22, même Supabase prod | **❌ ABSENT** — `gpu1-backend/` n'existe pas ; workspace ne liste que `packages/*` |
| Client front `src/lib/gpu1-client` | ✅ décrit (DTOs re-exportés du domain) | **❌ ABSENT** — 0 import dans `src/` |
| Migration strangler M1→M10 | ✅ `docs/gpu1-migration-status.md` | **"Nothing yet"** — tout tourne encore dans Next.js (Server Component → Prisma direct) |

**Conclusion** : la séparation front/back est **spécifiée mais jamais matérialisée**. Le pattern
courant réel reste **Server Component → Prisma** en direct (`docs/BACKEND_CONTEXT.md`). Le backend
source-of-truth Series 1 est donc **à créer**, en suivant l'architecture déjà spécifiée.

## Contrainte d'exécution (règle d'Adrien)

> **STOP si le repo/package backend exact manque — mais préparer quand même les contrats API et la
> séparation front/back.**

Application : on **prépare** les DTOs (contrat partagé), le squelette de client, et la frontière —
on **ne matérialise pas** le service `gpu1-backend/` en Vague 1 sans feu vert explicite sur le
package/repo exact (nom, deploy, DATABASE_URL, secrets). Le flag mémoire est posé dans le rapport.

## Frontière cible (ce que le back possède)

Le backend source-of-truth **possède tout calcul critique Series 1** ; le front ne fait que rendre
des DTO sérialisés. Domaines transférés :

```
Sources externes / smart contract v2 (PermissionedDynaVault)
        ↓  indexers / workers  (contract indexing)
BACKEND source-of-truth  (Fastify + Prisma + Zod, Node 22)
   possède :
   • vault state (mode, NAV, shares)          • BTC accumulation (satoshis, range)
   • B1/B2/B3 allocations & soldes            • all-in BTC acquisition cost
   • mining engine (hashrate, uptime, margin) • curtailment (état, seuils, events)
   • take-profit (tiers, history)             • proof / attestations (PoR, mining)
   • Zandbank demo data (fixture serveur)     • contract indexing (events → DB)
        ↓  persistence  (Prisma → MÊME Supabase prod, non dupliquée)
        ↓  api/  (Fastify → DTO Zod : string/number, jamais tuple ABI / BigInt brut)
FRONTEND Hearst-Defi  (src/lib/<client> — SEULE source de données métier)
   • Server Components / Route Handlers → client HTTP → DTO
   • Composants client → présentation seule
```

## Invariant de séparation (non négociable)

- **Aucun calcul critique Series 1 propriétaire du front.** Le front ne recalcule ni la range BTC,
  ni l'acquisition cost, ni l'état curtailment/take-profit : il les **reçoit** en DTO.
- **Le contrat API (DTOs) est la frontière unique.** Pas de type Prisma, pas de tuple ABI, pas de
  BigInt nu qui traverse. Tout est string/number rendu tel quel.
- **Supabase reste la MÊME DB prod** — le backend en devient le propriétaire applicatif, ne la
  duplique pas (schema single-sourced dans `prisma/schema.prisma`).
- **Engine pur (#6) partagé** : `src/lib/engine/*` (fonctions pures) peut être appelé **côté
  backend** ; il ne devient pas propriétaire du front. Le front n'appelle plus l'engine directement
  pour un calcul Series 1 — il consomme le DTO calculé par le back.
- **Zandbank** : la donnée demo vient du backend (fixture serveur), jamais calculée/mockée côté
  front pour les surfaces Series 1.

## Impact sur les missions existantes

- **M2 (Data)** devient **M2 + M10** : la couche données (models, migration, seed, env) reste M2 ;
  le **service backend source-of-truth** + DTOs + indexing = **M10**.
- **M4 (Cockpit)** : les KPI Series 1 (BTC delivered, acquisition cost) sont **reçus en DTO**, pas
  calculés dans le composant. M4 consomme le contrat API (M11), ne recalcule rien de critique.
- **M7 (Proof Center)** : les preuves (PoR, curtailment, take-profit) viennent du backend indexing,
  pas d'un calcul front.

## Missions ajoutées

- **M10 — Backend source-of-truth** : matérialiser (ou préparer si repo manquant) le service +
  domaines Series 1 + contract indexing.
- **M11 — Front API-contract** : DTOs partagés + client front + frontière ; brancher les surfaces
  Series 1 sur le contrat au lieu de Prisma/engine direct.
- **M12 — Intégration front/back** : proxy strangler par domaine, flag de rollback, parité prouvée
  avant de couper le chemin direct.
