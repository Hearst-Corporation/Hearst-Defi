# DEFI_CONTEXT — engine, vaults, projections, on-chain

Charger ce fichier + le module engine/onchain ciblé. Pour les surfaces LP, charger aussi
`src/lib/data/vaults.ts`. Ne pas charger le CSS ni les composants sauf la copie en cause (cf. STOP/bug).

## Où est quoi
- **Engine pur** (`src/lib/engine/`) : `scenario.ts`, `projection.ts`, `backtest.ts`, `monte-carlo.ts`,
  `mining.ts`, `coverage.ts`, `risk.ts`, `rebalancing*.ts`, `distribution-policy.ts`, `share-class.ts`,
  `prng.ts`, `vaults.ts` (presets), `types.ts`. Tests : `src/lib/engine/__tests__/` (dont
  `apy-spread-disclosure.test.ts`).
- **Vaults read-boundary** : `src/lib/data/vaults.ts` (`VaultProduct`, `listVaults`, `getVault`).
- **On-chain** : `src/lib/onchain/vault.ts` (viem ERC-20 approve + ERC-4626 deposit, Base Sepolia).
- **Projection client** : `src/lib/projection-chart.ts` (réimplémente l'arithmétique engine côté client).

## Non-négociables
- **Engine déterministe (#6)** : `src/lib/engine/*` n'importe JAMAIS `prisma`, `fetch`, `Date.now()`,
  `Math.random()`, `process.env`, ni rien de `src/app/` ou `src/components/`. PRNG → `prng.ts`, **seed
  injecté** (Monte-Carlo, ADR-006). Pas de RNG ni d'horloge non gouvernés.
- **APY toujours une RANGE (#1)** : sortie `"9.4-12.8%"`, jamais un point. `apyMedianInternal`
  (`scenario.ts:377`, `types.ts:123`) est **interne** — ne JAMAIS le sérialiser vers une surface LP
  (memo, term-sheet, /vaults, chat). `MIN_APY_SPREAD_BPS=50` / `MIN_APY_SPREAD_V2=0.005`
  (`scenario.ts:24,229`) élargissent la bande pour qu'elle reste une bande, jamais un point — garde
  verrouillée par `apy-spread-disclosure.test.ts`. Ne pas retirer.
- **Multi-vault first-class (ADR-006, lève #9)** : `yield` / `defensive` / `btc-plus`. Chaque vault
  porte SES PROPRES `apyTarget`/assumptions/AUM. **Seul le Yield Vault a un AUM live** ; les autres
  restent à `currentAumUsdc = 0` tant que `VaultSnapshot.vaultDeploymentId` n'existe pas (Phase 3).
  Reconnaissance : `isYieldVaultRow()` (`src/lib/data/vaults.ts:120`). Ne JAMAIS laisser un vault
  hériter des chiffres d'un autre.
- **Vault = Modèle B (cash)** : le principal est détenu en **réserve CASH USDC**. Le mining n'est
  **PAS on-chain** (advisory only). Le yield est **exogène, injecté mensuellement**. Aucune sortie
  owner/manager (custody forte). Déploiement on-chain = **V2 auditée** uniquement.
- **Discipline d'unités** (`src/lib/onchain/vault.ts`) : USDC = **6 décimales** (`USDC_DECIMALS=6`),
  shares ERC-4626 = **RAW 18 décimales**. Ne JAMAIS mélanger les deux échelles dans un calcul.

## Garde-fous money paths (ledger)
Subscribe / redeem / distribution sont défendus par `$transaction` + idempotency. **Ne jamais simplifier** :
- `Position.txHashOpen` **unique** → empêche le double-comptage d'un même dépôt.
- `@@unique([period, vaultRef])` sur `Distribution` (`schema.prisma:182`) → une seule distribution
  par (période, vault). Backstop période-seule pour les rows legacy `vaultRef = null`.
- `@@unique([period, signerWallet])` → un signataire approuve une fois par période.
- **TOCTOU** : `updateMany` conditionnel (compare-and-set) dans le `$transaction`
  (`src/lib/distribution/atomic-exec.ts:74,145`), gardé par `principalUsdc gte` côté redeem.

## Coverage (ligne compliance)
`src/lib/engine/coverage.ts` — seuils **fixés par l'Investment Policy, ne pas tuner en silence** :
`BAND_HEALTHY = 1.25`, `BAND_ADEQUATE = 1.0`, `BAND_STRESSED = 0.8` (`coverage.ts:34-36`).
Sous 0.8 → `suspended` ; distribution jamais payée par un puisement silencieux de réserve.

## Projection client — synchro manuelle
`src/lib/projection-chart.ts` **réimplémente** l'arithmétique de l'engine côté client (pour le rendu
sans round-trip serveur). Tout changement de méthodologie dans `src/lib/engine/` doit être **répliqué
à la main** ici, sinon graphe et chiffres serveur divergent.

## Bug de copie à signaler (NE PAS auto-fixer — confirmer l'intention)
La string « **Results are not projected** » apparaît dans des blocs PTAI/projection et se lit comme un
lapsus pour « not guaranteed » — affaiblit le disclaimer #10 :
- `src/components/vaults/invest-form.tsx:95-96` et `:497`
- `src/components/vaults/term-sheet-preview.tsx:183`
- `src/app/admin/distributions/distribution-form.tsx:314`
Remonter à Adrien avant toute modif de wording.

## Validation
`pnpm test src/lib/engine/__tests__` (inclure `apy-spread-disclosure`) + `pnpm typecheck`.

## STOP
Toute mutation de `contracts/**` ou déploiement **mainnet** (gated sur audit Spearbit + remédiation,
ADR-006). Pas de modif de la copie disclaimer ci-dessus sans accord. On-chain reste **Base Sepolia /
V2 auditée** — ne pas lever le lock.
