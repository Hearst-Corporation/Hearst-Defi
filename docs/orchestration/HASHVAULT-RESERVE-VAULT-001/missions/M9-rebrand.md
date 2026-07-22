# M9 — Rebrand "Hearst Bitcoin Reserve Vault — Series 1" (CONDITIONNEL)

**Owner** : backend · **Vague** : 3 · **Dépend de** : **décision #1 = oui** + ADR-020 + M4-M8
convergés · **Périmètre** : wordmarks legacy uniquement (pas de logique produit)

## ⚠️ Mission conditionnelle
Cette mission n'existe **que si** la décision #1 (`00-decisions-required.md`) est prise :
adopter le nom "Bitcoin Reserve Vault — Series 1". **ADR-019 §99-101 laisse le rebrand hors
scope** — il faut donc d'abord **acter un ADR-020 (rebrand)**. **Défaut : différer M9** (le pivot
de modèle ne dépend pas du nom). Ne pas lancer avant que le modèle (M1-M8) ait convergé, sinon on
renomme une cible mouvante.

## Objectif
Propager le nom cible depuis les wordmarks legacy "Hearst Yield Vault" / "HYV", sans toucher à la
logique produit (déjà pivotée par M1-M8).

## Tâches (fichier:ligne) — wordmarks seulement
1. **PDF memo** : `src/lib/pdf/memo-pages/cover.tsx:34` ("Hearst Yield Vault / Monthly Investor
   Memo"), `disclaimer.tsx:12` ("Hearst Yield Vault is a mining-backed note…").
2. **Demo** : `src/lib/demo/zand-fixture.ts:40,53` (`VAULT_DEPLOYMENT_ID="hearst-yield-vault"`,
   vaultKey `hearst_yield_vault:class-A`) — **coordonner avec M8** (qui refond déjà la fixture).
3. **Glossaire** : `docs/spec/99-glossary.mdx:11` ("Hearst Yield Vault — the single MVP product") —
   **coordonner avec M8**.
4. **Engine** : `src/lib/engine/vaults.ts:96-97` (label "Hearst Yield Vault", ticker "HYV") —
   **coordonner avec M1**.
5. **Cockpit** : `src/app/(product)/vaults/[id]/page.tsx:16`, `vaults/page.tsx:9`,
   `invest/page.tsx:17`, `confirmed/page.tsx:33` — **coordonner avec M4**.
6. **Data** : `src/lib/data/vaults.ts` (ticker/nom) — **coordonner avec M4**.

## Invariants
- **Wordmark uniquement.** Aucune logique, aucun calcul, aucune allocation touchés.
- Le contrat s'appelle toujours `PermissionedDynaVault` on-chain — le rebrand est **produit /
  marketing**, pas contrat. Ne pas renommer le contrat ni `VAULT_DEPLOYMENT_ID` on-chain sans
  migration de données (coordonner M2/M8).
- "Reserve USDC" (pocket B3) et `USDCReserveAdapter` ne sont **pas** le nom cible — ne pas les
  confondre / renommer.

## Gate
`pnpm typecheck && pnpm test` (dont tests qui matchent des strings de nom — les mettre à jour dans
le même diff). `node scripts/validate-zandbank-demo.mjs` si vaultKey touché.

## Définition de fini
ADR-020 acté ; nom "Bitcoin Reserve Vault — Series 1" propagé sur tous les wordmarks legacy ; zéro
logique modifiée ; tests verts. **Ou** : mission explicitement différée (décision #1 non prise).
