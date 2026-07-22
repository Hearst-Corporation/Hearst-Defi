# 02 — Cartographie brute (6 axes, `fichier:ligne`)

Reconnaissance read-only, 6 lecteurs parallèles, 2026-07-18. C'est la matière première des
missions. Chaque item est vérifié dans le code à la date de reco (HEAD `eca69561`).

---

## A. Smart-contract + chain adapter

**Verdict : couche on-chain DÉJÀ propre (0 borrow/LTV). Le vrai chantier = déployer + vérifier,
et isoler le levier off-chain.**

- Contrats Foundry `contracts/src/` : `PermissionedDynaVault.sol:31` (cible v2.1, multi-poche,
  shares non-transférables, 6 déc), `HearstYieldVault.sol:35` (legacy ERC-4626 **déployé**),
  `EventLogger.sol`, `PoRRegistry.sol`, adapters `USDCMiningAdapter`/`LBTCPouchAdapter`/
  `USDCReserveAdapter` (**stubs USDC**).
- `grep borrow|ltv|liquidat|collateral|leverage|loan` sur `contracts/` = **0**, sur
  `src/lib/chain/` = **0**.
- Spec : `docs/VAULT_SPEC_V2.1.md` = source de vérité de l'interface (deposit/redeem, rebalance,
  swapAndReport `:113`, payElectricity `:119`, reportMiningMetrics `:126`, vendingCurveBps `:187`,
  events `Deposit(3 params ≠ ERC-4626)` `:192`, TakeProfitExecuted / Curtailment* `:341-343`).
- Adapter `src/lib/chain/dynavault.ts` (1992 l., `server-only`) : modes `v2`/`legacy`/
  `not_configured` (`vault-mode.ts:79-97`). Reads câblés (`readVaultCore:1224`, `readVendingCurve:1818`,
  `readMiningMetrics:1584`, `readElecStatus:1631`…). Writes câblés (deposit/redeem/payElectricity:701/
  reportMiningMetrics:708/runMonthlyEngine:728/executeTakeProfit:749/curtail…).
- **Manquant** : ABI **non vérifiée contre bytecode** (`:266`) ; `V2_SHARE_DECIMALS=6` @todo (`:114`) ;
  **10 setters+getters owner absents** de l'adapter (setCurtailmentThresholds / setHalvingMonth /
  setTakeProfitTier + getters — spec §9.2) ; encodage `swapAndReport bytes32[]` vs `bytes` (§9.5).
- **Déploiement** : `config/deployments.base-sepolia.json` (chainId 84532). Legacy HYV **déployé**
  `0x2bd14d…329e` ; EventLogger `0x6A5483…BD38` ; PoRRegistry `0xbB9e03…A60D`. **DynaVault v2.1 NON
  déployé** (44/44 tests locaux, script `DeployDynaVault.s.sol` jamais broadcast) → `NEXT_PUBLIC_DYNAVAULT_ADDRESS`
  absente → app en mode `legacy`, DynaVault dormant. Mainnet gaté Spearbit (ADR-006).
- **Levier off-chain (~1082 hits `src/lib/`)** : `products/btc-mining-performance-vault.ts:171-354`
  (`liquidation:0.825`, `borrowAprPct:0.06`), `products/mining-canvas-model.ts:63-565`,
  `products/operator-economics.ts:71-111`, `products/exit-recovery.ts:47-131`,
  `products/stable-funding-engine.ts`, `strategy-data-lab/collateral-rebalancing.ts` (263 hits),
  `scenario-runner/*` (~135), sandbox `portfolio/preview/_data/mock.ts:12-190` (Morpho/LLTV 86 %).

## B. Engine (`src/lib/engine/*`)

**Verdict : cœur mining-note v3.0 fait et PUR (#6 intact). Restes yield/APY à purger + companion
MC BTC-accumulation à créer.**

- Cible faite : `mining-note-projection.ts` (mining economics `:160-165`, take-profit `:243-256`,
  vending `:63-66`, curtailment `:73-83`, range BTC `:100-106`, pockets 40/27/33 `:52-54`),
  `mining-note-types.ts`, `mining.ts`, `hashprice-formula.ts`, `prng.ts` (seed injecté).
- **Pureté #6 : AUCUNE violation** (Math.random/Date.now/fetch/prisma seulement en commentaires ;
  clocks/seeds injectés partout).
- Range #1 respectée : `mining-note-projection.ts:100-106`, `monte-carlo.ts:271`,
  `projection.ts:52` (MIN_SPREAD_PCT).
- **Restes yield/APY** : `vaults.ts` (`ApyTargetRange:41`, `apyTarget:{8,15}:100`, ticker "HYV":96-97,
  `VAULT_DEFENSIVE:124-146` + `VAULT_BTC_PLUS:149-171` full yield-APY 4-sleeves) ;
  `projection.ts` (APY-centré) ; `monte-carlo.ts` (sortie **APY**, pas BTC-accum) ;
  `methodology.ts:29-42` (STRESSED_APY_BAND) ; `coverage.ts`/`distribution-policy.ts`/
  `coverage-view.ts` (modèle distribution cash) ; `rebalancing-rules.ts:234-256` (strings APY+distribution).
- Tests engine : 19 fichiers, dont `mining-note-projection.test.ts` (range, curtailment, vending,
  guard vocabulaire), `monte-carlo.test.ts`.

## C. Cockpit investisseur

**Verdict : deux modèles superposés. Neuf (`/btc`,`/dashboard`,`features/investor-ui/*`) =
cible. Legacy (`/portfolio`,`/vaults`,`components/vaults|portfolio/*`) = chantier.**

- Routes retirées OK : `portfolio/distributions/page.tsx` (`redirect`), `portfolio/yield/page.tsx`
  (`redirect:1-14`).
- **Restes APY/yield surface** : `components/vaults/term-sheet-preview.tsx:8,51-65,171`
  ("Est. yield range" = apyLow/high, APY_DISCLAIMER_SUFFIX) ; `components/vaults/invest-form.tsx:15,
  153-163,861-868` (ApyRange) ; `portfolio/[positionId]/page.tsx:38,110,204-212,302-322`
  (formatApyRange, "Est. yield", accruedYieldUsdc, ValueTrajectory APY-driven) ;
  `my-vaults/page.tsx:129`, `portfolio/tax/page.tsx:33,48,50` ; data `lib/data/vaults.ts:21-22,89-107`
  ; `prisma/schema.prisma:38-39,509` ; `lib/constants/vault.ts`, `lib/format/apy.ts`,
  `catalyst/apy-range.tsx`.
- **Restes borrow/LTV surface** : `components/portfolio/position-capital-protection.tsx:50-52`
  ("Collateralised pockets" — **actif** sur page position) ; `portfolio/page.tsx:110,300` (mentions
  négatives Morpho) ; sandbox `portfolio/preview/*` massif (`mock.ts`, `preview/page.tsx:198,201`,
  `_charts/meter.tsx`, `honest-fan.tsx`) ; `portfolio/_cockpit/pilot-fixtures.ts:18,128`.
- **Nommage legacy** : "Hearst Yield Vault" à `vaults/[id]/page.tsx:16`, `vaults/page.tsx:9`.
- **Honnêteté états : globalement SAINE** — `/btc` `DataNotConfigured` "not deployed yet"
  (`page:152-158`), donut refuse de fabriquer 40/27/33 sans ownership (`:138-141`), zero-states
  avec badges `Simulated`, aucun faux Live. **Seul point douteux** : `/portfolio/preview` = mock
  Morpho rendu comme page réelle.
- 40/27/33 en dur (cible) : `btc/_components/btc-composition-panel.tsx:36-40`,
  `components/vaults/invest-form.tsx:136`. $250k : `portfolio/demo-actions.ts:47-48`. 60-day :
  `btc/_data/btc-page-fixtures.ts:99`.

## D. Proof Center + Admin + Chat

**Verdict : Investor Memo + prompt admin pivotés. Scenario Narrative + guards chat + rail
distribution = chantiers.**

- **~30 sections admin** (`components/nav/product-nav-items.ts:89`). À bouger :
  `products/btc-mining-performance-vault`, `strategies`, `product-workspace`, `vaults`,
  **`distributions`** (retrait/refonte), `signals` (rebalancing), `spec`, `roadmap`,
  `investor-memo`, `proof-center`/`proofs`. Tab "Distributions" `product-nav-items.ts:131` ;
  cluster "Total distributed" `overview-clusters-view.ts:191,205`.
- **Proof Center** (`components/proof-center/proof-center-hub.tsx`) : PoR `:172`, Mining cash-flow
  `:190` ("Accumulation source"), **"Latest proceeds"/`RecentDistributions` `:203`** (empty déjà
  pivoté `:213` mais plomberie distribution `hub-data.ts:32,58`), Rebalancing `:225`.
  Provenance ladder complète `provenance-badge.tsx:7-25`. **Curtailment/take-profit PAS encore
  matérialisés en preuves attestées.** Module mort `proof-center/distribution-provenance.ts`.
- **Chat** (`api/cockpit-chat/route.ts`) : moteur unique `runMasterAgentTurn:498`, kill-switch
  `CHAT_MASTER_AGENT` (`feature-flags.ts:28`, ON) `:1061`. Prompt admin
  `prompts.ts:94` **pivoté** (40/27/33, no distribution/no APY). Prompt default `prompts.ts:137`
  **hybride, reste yield/APY** (`:137,178,183,206`, route `/admin/distributions:172`).
- **Guards** : `agents/forbidden-words.ts` (CHAT_FORBIDDEN_WORDS:67), `agents/apy-range.ts`
  (`hasSinglePointApy`, **ancré YIELD/%**, ne couvre PAS "single-point BTC accumulated"),
  `llm/output-guard.ts:64` (yield-centric), `llm/semantic-guard.ts:32`. **Chantier : étendre au
  BTC-accumulation.**
- **4 agents** : Investor Memo `investor-memo.ts:139-150` **pivoté ✓** (reste `apy range:55`,
  `distribution-coverage:59`) ; Mining Health `mining-health.ts:105` mining-natif ; Risk
  Explanation `risk-explanation.ts:102-105` neutre ; **Scenario Narrative `scenario-narrative.ts:
  115,119,150,157` = le plus yield-centric (PTAI apy_range + yield_contribution_bps), prioritaire.**

## E. Données (Prisma / Inngest / seed / env)

**Verdict : distribution à démolir, models mining-note à créer, dérive schéma à résorber, faux
$500k à corriger, KEEPER_* hors Zod.**

- **Models MORTS** (ADR-019 §89) : `Distribution` `schema.prisma:207`, `DistributionLedgerEntry:1026`,
  `DistributionApproval:241`, `Pcap:1038`. Champs morts : `Position.distributedUsdc:456`,
  `InvestorTransaction.type="distribution":480`.
- **Models VIVANTS** : `MiningMetric:67`, `VaultSnapshot:34`+`Allocation:51` (remap 3 pockets),
  `RebalanceEvent:181`, `Proof:252`, `VaultDeployment:495`, `Position:447`/`Investor:415`,
  `ShareClass:979`.
- **Models ABSENTS à créer** : take-profit history / curtailment events / BTC-accumulation
  (satoshis). 0 hit dans schema.
- **Crons** : à mourir `distribution-executed.ts:44`, cadence `investor-memo-monthly.ts:26`, copie
  `time-to-cash.ts:29,59-63` (pas de générateur `.ics` réel trouvé). À garder `market-data-hourly.ts:27`
  (écrit MiningMetric, mais placeholders en dur `:120-121`), `mining-health-daily.ts:21`,
  `custody-snapshot-hourly.ts:29`, `investor-nav-snapshot-hourly.ts:17`, `rebalancing-signal.ts:66`,
  `risk-daily.ts:36`. À créer : ingest on-chain reportMiningMetrics/take-profit/curtailment.
- **Trou de provenance** : mining metrics on-chain, take-profit, curtailment n'ont **aucun point
  d'entrée DB** (reads ABI existants, rien ne persiste).
- **Migrations** : 10, `postgresql`. **Dérive schéma** (models sans migration, db-push-only) :
  `NavTrace:885`, famille `strategy_*:1320-1478`. `document_vault` déjà appliqué.
- **Seed** : distributions démo `seed.ts:218-240` (mortes), **faux `minTicketUsdc:500_000` `seed.ts:743`**
  (vrai = 250k `:618,783`), `seed-zand-demo.ts` réfère distribution.
- **Env Zod** (`env.ts`) : `NEXT_PUBLIC_DYNAVAULT_ADDRESS:68` OK ; mining `:161,167` OK ; Fireblocks
  `:177-187` OK. **KEEPER_* ABSENTS** (lus brut `keeper.ts:184,209`). `PRISMA_PROVIDER` n'existe pas
  (hardcodé `schema.prisma:27`). Adresses ERC-4626 legacy `env.ts:54-55` encore requises (dette).

## F. Docs + demo Zandbank

**Verdict : modèle de vérité aligné ; specs 01/02/99 + roadmap + demo Zandbank = ancien modèle.**

- **Alignés (ne pas toucher)** : `README.md:1-12`, specs `00-vision`, `04-investor-memo`,
  `05-mining-model`, `07-rebalancing-rules` ; methodology v1/v2/v3 + cross-refs ; PDF memo corps.
- **Ancien modèle (à réaligner)** : `docs/spec/01-dashboard.mdx:17-28` ("Next distribution",
  "APY range/Stressed APY", donut **4 buckets**, "Methodology v1.0") ; `02-scenario-lab.mdx:27,33,
  34,50` ("Stable base APY" slider, "Monthly USDC distribution forecast", "distribution %") ;
  `99-glossary.mdx:11-14` ("Hearst Yield Vault single MVP", "Distribution — monthly USDC payout").
- **PDF résidu = brand only** : `cover.tsx:34` ("Hearst Yield Vault / Monthly Investor Memo"),
  `disclaimer.tsx:12`. Corps corrects. Aucune page n'affirme APY/distribution.
- **Demo Zandbank = 100 % ANCIEN MODÈLE** (incohérence frontale P0) : `src/lib/demo/zand-fixture.ts:40`
  (`VAULT_DEPLOYMENT_ID="hearst-yield-vault"`), `:48,53` (share-class, distribution cadence),
  `:74` ("12 monthly distributions — ~9-12% APY"), `:80` (12 valeurs distribution), `:134,183-198`
  (12 tx `type:"distribution"`), `:163` (accruedYieldUsdc). Validateur
  `scripts/validate-zandbank-demo.mjs:28,243,296-320` (ALLOWED_TX_TYPES distribution, targetApyBps,
  4-bucket alloc). Seed `scripts/seed-zandbank-demo-local.ts:92-93`.
- **roadmap.json** : **0 item pivot** (grep adr-019/mining note/v3.0/40-27-33/pocket = 0). Reste
  ancré distribution : `:430,504,539,553,790,818` + futurs yield vaults `:907,914`.
- **Mots interdits #5 dans docs** : aucune violation réelle (tous = allowlists/définitions ou
  "not guaranteed" permis).
- **Nom "Bitcoin Reserve Vault / Series 1" : 0 occurrence — à créer** (cf. décision #1).
