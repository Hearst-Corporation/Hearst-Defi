# M8 — Docs + demo Zandbank : realign specs 01/02/99, roadmap, fixture Zand

**Owner** : backend · **Vague** : 2 · **Dépend de** : M1 + M2 (cohérence chiffres/models) ·
**Périmètre** : `docs/spec/*.mdx`, `docs/roadmap.json`, `src/lib/demo/*`, `scripts/*zand*`,
PDF wordmark (coord. M9)

## Objectif
Réaligner les docs restées ancien modèle et **refondre la demo Zandbank** — aujourd'hui 100 %
yield vault (12 distributions mensuelles + APY + 4-buckets), incohérence frontale P0 avec le
mining note.

## Contexte
Voir `02-cartography.md §F`. Le modèle de vérité (ADR-019, v3.0, README, specs 00/04/05/07, PDF
corps) est **déjà aligné — ne pas y toucher**. Chantier = specs 01/02/99, roadmap, demo Zand.

## Tâches (fichier:ligne)
1. **`docs/spec/01-dashboard.mdx:17-28`** : retirer carte "Next distribution" (`:20`), "APY range
   9.4-12.8% / Methodology v1.0" (`:17`) → range BTC accumulé + v3.0, "Stressed APY 5.2%" (`:18`) ;
   **donut 4 buckets → 3 pockets B1/B2/B3 40/27/33** (`:24-28`).
2. **`docs/spec/02-scenario-lab.mdx:27,33,34,50`** : retirer slider "Stable base APY" (`:27`),
   output "Projected APY range P25-P75" (`:33`), "Monthly USDC distribution forecast" (`:34`), PTAI
   Impact "distribution %" (`:50`) → range BTC accumulé.
3. **`docs/spec/99-glossary.mdx:11-14`** : réécrire "Hearst Yield Vault — single MVP product"
   (`:11`), "APY range"/"Stressed APY" (`:12-13`), "Distribution — monthly USDC payout to LPs"
   (`:14`) → mining note / accumulated BTC / no distribution.
4. **Demo Zandbank (P0)** — `src/lib/demo/zand-fixture.ts` : refondre la fixture $2M en position
   mining note. Retirer : `VAULT_DEPLOYMENT_ID="hearst-yield-vault"` (`:40`), share-class distribution
   cadence (`:48,53`), "12 monthly distributions ~9-12% APY" (`:74`),
   `ZAND_FIXTURE_MONTHLY_DISTRIBUTIONS_USDC` (`:80`), 12 tx `type:"distribution"` (`:134,183-198`),
   `accruedYieldUsdc` (`:163`). Remplacer par : 3 pockets 40/27/33, BTC accumulé à date, all-in
   acquisition cost, pas de tx distribution. Coordonner avec **M2** (`seed-zand-demo.ts`).
5. **Validateur** `scripts/validate-zandbank-demo.mjs` : retirer `distribution` de
   `ALLOWED_TX_TYPES` (`:28`), la réconciliation distribution (`:243,263-268`), `targetApyLowBps/
   HighBps` + **4-bucket alloc** (`:296,307-320`) → valider 3 pockets + BTC accumulé.
   `scripts/seed-zandbank-demo-local.ts:92-93` (log "distributed") → log BTC accumulé.
6. **`docs/roadmap.json`** : **0 item pivot** aujourd'hui. Retirer/reclasser les items distribution
   (`:430,504,539,553,790,818`) et futurs yield vaults APY (`:907,914`) ; **ajouter** les chantiers
   ADR-019 (reads on-chain vending curve/curtailment/take-profit/tvlCap/whitelist — ADR-019:97-98,
   + les models/ingest de M2, le deploy M3). Mettre à jour `/admin/roadmap` en cohérence.
7. **PDF wordmark** `cover.tsx:34`, `disclaimer.tsx:12` (brand only) → **M9** si rebrand, sinon
   laisser (corps corrects).

## Invariants
- **Ne pas toucher** : README pitch, specs 00/04/05/07, methodology v1/v2/v3 + cross-refs, PDF corps.
- Mots interdits #5 : aucune violation à introduire ("not guaranteed" reste permis).
- Doc = miroir du code : réaligner dans le même passage que le code correspondant si couplé.
- Garde-fou seed prod respecté (Zand demo refuse NODE_ENV=production).

## Gate
`pnpm typecheck && pnpm test` + `node scripts/validate-zandbank-demo.mjs` vert sur la fixture
refondue. Les `.mdx` ne cassent pas le build.

## Définition de fini
Specs 01/02/99 alignées mining note (3 pockets, no distribution, v3.0) ; demo Zandbank refondue +
validateur cohérent ; roadmap pivotée (items distribution retirés, chantiers ADR-019 ajoutés) ;
tests + validateur verts.
