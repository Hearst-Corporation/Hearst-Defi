# M11 — Front API-contract (Series 1)

**Owner** : `ui-dev` + backend (contrat) · **Vague** : 2 · **Dépend de** : M10 (DTOs) ·
**Périmètre** : `src/lib/<series1-client>` (à créer), surfaces Series 1 (`src/app/(product)/*`)

## Objectif
Le front consomme les DTOs Series 1 **via le contrat API**, jamais via Prisma / engine / RPC direct
pour un calcul critique. Matérialiser la frontière `src/lib/gpu1-client` (ou équivalent) aujourd'hui
absente.

## Contexte
`src/lib/gpu1-client` est **absent** (0 import dans `src/`). La politique frontend API-only
(`docs/frontend-api-only-policy.md`) est actée mais non appliquée aux domaines Series 1.

## Tâches
1. **Client front** : créer le module client (nom coordonné avec M10 — `gpu1-client` ou
   `series1-client`) qui appelle le contrat API et **re-exporte les DTOs** du domain partagé
   (schemas Zod côté client pour valider la frontière).
2. **Brancher les surfaces Series 1** sur le client au lieu du direct :
   - `/btc`, `/dashboard` (déjà cible) → consommer les DTOs vault state / BTC accumulation / pockets.
   - term-sheet, deposit, position (M4) → KPI **BTC delivered + acquisition cost reçus en DTO**, pas
     recalculés dans le composant.
   - Proof Center (M7) → preuves reçues du backend indexing.
3. **Zero calcul métier client** : auditer que les surfaces Series 1 ne recalculent rien de critique
   (range, acquisition cost, curtailment) côté client ou même Server Component en direct — tout
   passe par le contrat.
4. **DTO discipline** : jamais de type Prisma / tuple ABI / BigInt nu côté front — le client rejette
   à la frontière (validation Zod).

## Invariants
- **Aucun calcul critique Series 1 propriétaire du front.**
- Pendant la transition (strangler, M12) : le direct Prisma reste **en place** derrière un flag, pas
  supprimé — rollback en un flip.
- Composants Catalyst uniquement ; honnêteté des états préservée.
- No cross-project imports (#11).

## Gate
`pnpm typecheck && pnpm test`. Vérif browser : screenshots Adrien (surfaces Series 1 servies via
contrat rendent identiquement — parité). `grep` : aucune surface Series 1 n'importe `@/lib/engine`
ou Prisma pour un calcul critique après bascule.

## Définition de fini
Client front matérialisé + DTOs validés à la frontière ; surfaces Series 1 consomment le contrat ;
zéro calcul critique client ; direct Prisma conservé derrière flag pour rollback ; tests + parité OK.
