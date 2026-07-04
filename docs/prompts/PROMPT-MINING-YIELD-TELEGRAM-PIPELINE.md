# PROMPT — Rendement mining Hearst : calcul, projection stratégies, et pipeline de prix (Telegram / hashprice / hosters)

> À coller dans un autre workspace. Ce document est **autoportant** : il décrit exactement
> comment le rendement mining est calculé aujourd'hui dans `connect — Hearst Defi`, comment
> il est projeté dans les stratégies produit, et la config complète des jobs qui vont chercher
> les prix (canal Telegram des machines, hashprice réseau, coûts hosters/énergie/douane).
> Toutes les formules, constantes en dur, env vars, URLs d'API et schedules cron sont donnés
> verbatim, avec chemins de fichiers et lignes.

---

## 0. TL;DR — ce qu'il faut retenir avant de lire le détail

1. **Le hashprice** (revenu brut du mining, en `$/TH/day`) est calculé par une seule formule pure
   à partir de la difficulté réseau (mempool.space) et du prix BTC (Chainlink → CoinGecko).
2. **Le rendement mining** existe sous **deux formes distinctes** dans le code :
   - un **score de santé 0–100** (`margin_score`) — pas un APY ;
   - un **rendement LP annualisé en %** (`lpMiningYieldPct`) = `(lpNet × 365) / coût landed par TH × 100`.
3. **La projection dans les stratégies** : le `lpMiningYieldPct` alimente un allocateur (floor mining 30 %)
   puis un **Monte-Carlo seedé** qui sort une fourchette APY p5/p50/p95. Les « 3 stratégies »
   (Safe/Balanced/Opportunistic) écrites en dur dans la config **ne pilotent AUCUN nombre** — elles
   sont descriptives. Tous les nombres sont **déterministes** ; le LLM ne fait que la prose finale.
4. **Les prix machines** viennent d'un **canal Telegram** (`@LetineSidonia`) lu en **MTProto**
   (session utilisateur, pas un bot), parsé à la volée, enrichi (cooling/fabricant/efficacité),
   puis passé dans un **cost-model** qui ajoute fret + douane + énergie + amortissement.
5. **Il n'y a PAS de cron qui rafraîchit les prix Telegram** : c'est lu à la demande au render de
   `/admin/source`. Seul le **hashprice/BTC** est rafraîchi par un cron horaire, et l'agent santé
   par un cron quotidien.

---

## 1. Le hashprice — revenu brut du mining

Fichier : `src/lib/engine/hashprice-formula.ts` (module **pur**, aucun I/O). Une seule
implémentation partagée par le fetcher live et le backfill historique.

Constantes :
```
BLOCK_REWARD_BTC       = 3.125          // post-halving avril 2024
BLOCKS_PER_DAY         = 144
HASHES_PER_DIFFICULTY  = 2 ** 32
HASHES_PER_TH          = 1e12
SECONDS_PER_BLOCK      = 600
```

Network hashrate (TH/s) :
```
networkHashrateThs(difficulty) = (difficulty × 2^32) / 600 / 1e12
```

Hashprice — **USD par TH par jour** (pas par PH ; fees de transaction volontairement omis,
choix conservateur < 2 %) :
```
hashprice_usd_th_day = (3.125 × 144 × btcPriceUsd) / networkHashrateThs(difficulty)
```
Retourne `0` sur entrée dégénérée (difficulty ≤ 0, prix ≤ 0, non-fini) pour ne pas propager NaN.

Fallbacks si fetch échoue (`src/lib/data/hashprice.ts`, `stale: true`) :
```
FALLBACK_USD_PER_TH_DAY = 0.055
FALLBACK_DIFFICULTY     = 1.32e14
FALLBACK_BTC_PRICE_USD  = 100_000
```

---

## 2. Le rendement mining — DEUX pipelines distincts

⚠️ Source de confusion n°1 : deux calculs coexistent, avec des sorties différentes.

### 2.A — Score de santé (`src/lib/engine/mining.ts`, `computeMiningRevenue`)

Sort un **margin score 0–100**, pas un APY. Défauts injectés (`DEFAULT_MINING_COSTS`) :
`efficiency = 0.1 kWh/TH/day`, `hosting = 0.005 $/TH/day`, `target = 0.04 $/TH/day`, `uptime = 0.98`.
```
gross           = hashprice_usd_th_day × uptime
energy          = energy_cost_kwh × efficiency
operating_costs = energy + hosting
net             = gross − operating_costs
margin_score    = clip(50 + 50 × (net / target − 1), 0, 100)
```
`computeOperationalConfidence(marginScore, btc24hChange)` : base 85/65/40 selon marginScore
≥70/≥40/<40, moins `min(20, |btc24hChange| × 0.5)`, clippé [0,100].

### 2.B — Coverage (`src/lib/engine/coverage.ts`, `calculateDistributionCoverage`)

Cœur économique du vault. C'est le **gate de distribution**. Défauts locaux miroir :
efficiency `0.1`, hosting `0.005`, period `30 jours`. Bandes : healthy `1.25`, adequate `1.0`, stressed `0.8`.
```
netMarginPerThDay = max(0, hashprice − efficiency × energy_cost_kwh − hosting_pool)
netMiningCashUsd  = netMarginPerThDay × deployed_th × (uptime_pct/100)
                    × revenue_share_fraction × period_days
coverage_ratio    = netMiningCashUsd / target_distribution_usdc
state             = healthy(≥1.25) / adequate(≥1.0) / stressed(≥0.8) / suspended(<0.8)
```
`max(0, …)` : marge négative → cash 0, jamais négatif. Input invalide → `state="invalid"`,
`ratio=null`, jamais un nombre fabriqué.

### 2.C — Rendement LP annualisé en % (`src/lib/products/mining-canvas-model.ts`, `computeCanvasMachineEcon`)

**C'est ici que le rendement mining devient un pourcentage (APY-like).** Constantes :
`FREIGHT_USD_PER_UNIT = 100`, `DAYS_PER_MONTH = 30.4`, `HOURS_PER_DAY = 24`, `DAYS_PER_YEAR = 365`.
```
exWorks       = machinePriceUsd × (1 + markupPct/100)
landedPerMach = exWorks + 100                                   // fret
landedPerTh   = landedPerMach / machineHashrateTh
capex         = landedPerMach / th / (lifeMonths × 30.4)        // $/TH/day
kwhPerThDay   = (machineEfficiencyJTh × 24) / 1000
energy        = kwhPerThDay × energyCostUsdPerKwh × uptime      // $/TH/day
poolMaint     = hashprice × (poolFeePct + maintenanceFeePct)/100
totalCost     = capex + energy + poolMaint
net           = hashprice − totalCost
companyCut    = max(0, net) × (revenueSharePct/100)            // part opérateur
lpNet         = net − companyCut                               // part LP
lpMiningYieldPct = (lpNet × 365) / landedPerTh × 100           // ← RENDEMENT MINING LP
```

Défauts canvas (`DEFAULT_CANVAS_INPUTS`) : capital 1 M$, BTC 60 000 $, hashprice 0.06 $/TH/day,
machine Antminer S21 Pro 234 TH / 15 J/TH, life 60 mois, énergie 0.06 $/kWh, uptime 0.98,
pool 1 %, maintenance 1 %, markup 15 %, revenue-share 20 % (LP garde 80 %), borrow 6 %,
stable yield 9 %, LTV moy 0.5 / liq 0.825, fees 2 %, scénarios BTC −20 / +40 / +120 %.

### Formules canoniques de la spec (`docs/spec/05-mining-model.mdx`)
```
mining_revenue      = deployed_hashrate (TH/s) × hashprice ($/TH/day) × uptime (%)
operating_costs     = energy + hosting + pool_fee + maintenance
mining_gross_margin = mining_revenue − operating_costs
distributable_yield = (mining_gross_margin × revenue_share_hearst) − management_fee
```
**Hearst n'opère pas d'ASIC en direct** : le vault achète l'exposition au cashflow via revenue-share
avec 1–2 fermes partenaires, livré en USDC mensuel par attestation.

### Waterfall (`src/lib/products/btc-mining-waterfalls.ts`, descriptif — ne déplace jamais d'argent)
Ordre normal fixe (1→8) : power/hosting/maintenance → financing/borrow → stable reserve →
**distribution mensuelle (gate coverage ≥ 1.0)** → debt mgmt → client target → operator spread →
machine residual. L'étape distribution est **`blocked` si coverage < 1.0**, jamais payée depuis le
principal, jamais garantie.

---

## 3. Projection du rendement mining dans les stratégies

⚠️ Source de confusion n°2 : il y a **deux systèmes qui ne partagent pas leurs nombres**.

### Système A — Config déclarative statique (`src/lib/product-strategies/`)
Trois familles produit × 3 scénarios (Safe/Balanced/Opportunistic), en **basis points écrits à la main**
(les 4 sleeves `miningBps + btcBps + stableReserveBps + yieldOverlayBps` somment à 10 000). Ex.
famille « BTC Mining Performance », scénario Balanced : mining 3400 / btc 2600 / stableReserve 1200 /
yieldOverlay 2800, distribution 700–1100 bps, perf totale 900–1500 bps, floor 800 bps.
**Le mining yield live n'entre PAS ici.** C'est de la donnée versionnable, descriptive.
`select.ts` / `from-objective.ts` / `objective-profile.ts` = scoring **pur, déterministe, sans LLM**.

### Système B — Pipeline live-swarm + Monte-Carlo (le vrai calcul numérique)
Chaîne complète :
```
Telegram (prix machine Letine)
  → parse-machine-price.ts                     (samples structurés)
  → cost-model.ts                              (landed, capex/TH, énergie/TH → totalCost/TH)
  → telegram/strategy-model.ts                 (markup + hashprice − cost − companyShare → lpMiningYieldPct)
  → read-vault-apy.ts                          (meilleur lpMiningYieldPct de la flotte = miningYieldPct)
  → runners-data.ts runStrategyCross           (StrategyCrossArtifact.miningYieldPct)
  → strategy-allocation.ts deriveRegimeAllocation  (floor mining 30 %, 4 sleeves, exception gouvernance si underwater)
  → pipeline.ts                                (fold en 3 legs MC + drift BTC par régime)
  → runners-data.ts runQuant → runMonteCarlo   (fan p5/p50/p95 → headlineRange APY)
  → draft.quant / draft.scenarios / draft.canonicalAllocation
```

Détails clés :
- **Allocateur** (`allocator.ts`) : score risk-adjusted `score = max(0, returnPct) / max(riskPct, ε)`,
  risques proxy mining 35 / btc 65 / usdc 3, poids Sharpe-like normalisés, **floor mining 30 % forcé**
  (si mining underwater mais forcé au floor → `governanceException` flaggé).
- **Drift BTC par régime** (ce qui différencie les 3 régimes, PAS les bps de la config A) :
  `annualDrift = (1 + totalReturn)^(12/months) − 1`, `totalReturn` = scénarios bear −0.20 / base 0.40 /
  bull 1.20 du produit. defensive→bear, balanced→base, opportunistic→bull.
- **Monte-Carlo** : seed dérivé de `objective + btcUsd` via FNV-1a (déterministe, ADR-006,
  no `Math.random`, no `Date.now`). GBM BTC + difficulté mean-reverting + blend de yields.
- **`draft.strategySelection`** (slug/name/score/why) provient du système A et est **purement
  descriptif** : commentaire explicite dans `pipeline.ts` — *« This does NOT drive the numeric
  projection »*.
- Un **3e moteur déterministe** (`engine/scenario.ts`) sert `/admin/projection` avec des inputs
  manuels (sliders hashprice/énergie), indépendant du live-swarm.

**Déterministe vs LLM** : 100 % des nombres (mining yield, allocations, ranges APY, sélection de
stratégie) sont déterministes. Le LLM (`runWriteup`) ne produit que la **prose narrative** en lisant
la `canonicalAllocation` ; il ne calcule aucun chiffre.

---

## 4. Config des jobs qui vont chercher les prix

### 4.1 — Prix des machines : canal Telegram

**Auth : MTProto (session utilisateur), PAS Bot API.** Pas de bot token, pas de channel numérique.

Env vars (`src/lib/env.ts`, validation Zod, toutes **optionnelles** — si absentes, `/admin/source`
dégrade en « not configured » au lieu de throw) :
```
TELEGRAM_API_ID    = z.coerce.number().int().positive().optional()
TELEGRAM_API_HASH  = z.string().optional()      // secret
TELEGRAM_SESSION   = z.string().optional()      // secret — string session MTProto
```
- Credentials lus dans `src/lib/telegram/client.ts` directement depuis `process.env`, jamais loggés.
  Client MTProto (`new TelegramClient(new StringSession(session), apiId, apiHash, {connectionRetries:3})`)
  mis en cache module-level, connexion paresseuse.
- Génération de la session : script one-time `scripts/telegram-login.mjs` (lit `API_ID`/`API_HASH`
  depuis `.env.local`, prompte téléphone/code/2FA, écrit `TELEGRAM_SESSION=...` dans `.env.local`).
- **Canal lu : `@LetineSidonia`** (codé en dur `DEFAULT_CHANNEL` dans `read-machines.ts`). Message
  ciblé : liste quotidienne « Letine Mining Update Miner Price ».

**Mécanique de fetch** (`src/lib/telegram/read-machines.ts`) :
- `client.getMessages(channel, { limit: 8 })` — récupère les **8 derniers messages** (pas de curseur).
- Parmi les 8, garde le message qui produit **le plus de samples parsés** (best-parse).
- **AUCUN cron.** Fetch à la demande, à chaque render de `/admin/source` (`force-dynamic`).
  Pas de TTL, pas de persistance, in-memory le temps d'un render. Seul l'objet client MTProto est caché.

**Parsing** (`src/lib/telegram/parse-machine-price.ts`, pur). Format Letine attendu :
```
*Air Cooling*
S21++ 235T: $1296 (6U/T)
*Hydro Cooling*
S21+ Hyd 358T: $2273 (6.35U/T)
*Whatsminer BTC Miners*
M63S 18.5W 372/374/390/398T: $6.6/T
```
Heuristiques :
- Date liste : regex `/(\d{1,2})(?:st|nd|rd|th)?\.?\s+([A-Za-z]{3})…\s+(\d{4})/`.
- Cooling : header gras (`*Air/Hydro/Immersion Cooling*`) ou label modèle (`Hyd`, `imm`) qui override.
- Hashrate TH/s : `/(\d+(?:\.\d+)?)\s*T(?:H)?(?:\/s)?\b/i`, prend la **première** valeur (`372/374/390T` → 372).
- Efficacité J/TH : première valeur dans `[5, 60]` (bande ASIC réelle, évite les nombres parasites).
- Prix : per-TH `$6.6/T` (→ `perThUsd`, `priceUsd = perThUsd × th`) OU unitaire `$1296`
  (→ `priceUsd`, `perThUsd = priceUsd / th`).
- Région : header `*USA Stock*` → usa (douane 27.6 %), défaut china.
- Split modèle/prix sur le **dernier `:` avant le premier `$`** ; ligne sans `$` ignorée.

Enrichissement (catalogues purs) :
- `model-catalog.ts` : résout le cooling par famille si non explicite (fallback air).
- `manufacturer-catalog.ts` : classe fabricant (bitmain/microbt/bitdeer/canaan/bitaxe) ; table
  d'efficacités par défaut quand Letine omet le wattage (ex. Antminer S21 XP = 13.5, S21 = 17.5 J/TH).
- `manufacturer-logos.ts` : mappe fabricant → icône.

**Cost-model** (`src/lib/telegram/cost-model.ts`) — ajoute les coûts **hosters/logistique** au prix :
```
ENERGY_COST_USD_PER_KWH = 0.06                     // électricité fixe 6 ¢/kWh
AMORT_MONTHS = { air: 36, hydro: 60, immersion: 60 }
DAYS_PER_MONTH = 30.4 ; HOURS_PER_DAY = 24 ; DEFAULT_UPTIME = 0.98
FREIGHT_USD_PER_UNIT = 100                          // fret forfaitaire $/unité
CUSTOMS_DUTY_PCT = { usa: 27.6, uae: 5, france: 0, russia: 5, china: 0 }
DEFAULT_DESTINATION = "uae"
```
```
landedUsd            = exWorks + freight($100) + customs(duty% × exWorks)
capexUsdPerThDay     = landedUsd / th / (amortMonths × 30.4)
kwhPerThDay          = (efficiencyJTh × 24) / 1000
energyUsdPerThDay    = kwhPerThDay × energyUsdPerKwh × uptime
totalCostUsdPerThDay = capex + energy
```
(Hosting/pool fees hors de ce module ; ils sont dans le canvas-model côté produit.)

**Pont prix → stratégie** (`src/lib/telegram/strategy-model.ts`, pur) :
```
billedPriceUsd = costPrice × (1 + markupPct/100)                  // markup société = le spread
econ           = computeMachineEconomics({...sample, priceUsd: billedPriceUsd}, destination)
netUsdPerThDay = hashpriceUsdPerThDay − econ.totalCostUsdPerThDay
companyCut     = max(0, net) × companySharePct/100
lpNet          = net − companyCut
lpMiningYieldPct = (lpNet × 365) / landedPerTh × 100
```
Consommé par `read-vault-apy.ts` (garde le meilleur `lpMiningYieldPct` de la flotte) puis
`composeVaultApy` (plage APY par vault). Leviers société (markup, revenue-share, borrow, fees,
scénarios BTC) viennent de `getProjectionAssumptionsConfig().company` (status `CONFIGURED`).

### 4.2 — Prix hashprice / BTC / stable yield : APIs + crons

| Source | URL exacte | Auth | Env override |
|---|---|---|---|
| Difficulté réseau | `https://mempool.space/api/v1/mining/difficulty-adjustments/1m` | non | — |
| BTC (primaire) | Chainlink BTC/USD `0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c` (Ethereum) | RPC | `CHAINLINK_RPC_URL` (requis), `NEXT_PUBLIC_CHAINLINK_BTC_USD_ADDRESS` |
| BTC (fallback) | `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true` | non | — |
| Stable yield | `https://yields.llama.fi/pools` | non | `DEFILLAMA_BASE_URL` |
| Fear & Greed | `https://api.alternative.me/fng/?limit=1` | non | `FEAR_GREED_BASE_URL` |
| Énergie | (table Prisma non créée → env → défaut) | — | `MINING_ENERGY_COST_USD_PER_KWH` (défaut 0.05) |

Provenance BTC : `oracle` (Chainlink, SLO 75 min) → `live` (CoinGecko) → `stale` (age > 5 min).
Sans `CHAINLINK_RPC_URL`, CoinGecko `live` est le mode intentionnel. Cache CoinGecko `revalidate: 60`,
difficulté `revalidate: 600`.

**Crons Inngest :**
- `market-data-hourly` — cron `"0 * * * *"` (chaque heure), concurrency 1. Fetch BTC + hashprice
  (+ DeFiLlama & Fear&Greed loggés non persistés), calcule `margin_score` + `operational_confidence`,
  **persiste dans la table Prisma `MiningMetric`**, émet `market.data.updated`. Placeholders en dur :
  `uptimePct 98.5`, `deployedHashrate 182_000 TH/s`, `stable_apy_pct 3.8`, `vol_index 50`.
- `mining-health-daily` — cron `"0 8 * * *"` (08:00 UTC). Charge la dernière snapshot `MiningMetric`,
  fait tourner l'agent **OpenAI GPT-4.1** (`runMiningHealth`, ADR-011) qui sort `alert_level`
  (green/amber/red) + `summary` + `recommendation`, persiste une nouvelle ligne `MiningMetric`.
  Anti-doublon : skip si une ligne agent existe déjà aujourd'hui.

**Table Prisma unique** `model MiningMetric` (`prisma/schema.prisma`) : `hashprice`, `difficulty`,
`btcPrice`, `energyCost`, `uptimePct`, `deployedHashrate`, `miningMarginScore`, `hashpriceTrendPct`,
`operationalConfidence`, `alertLevel?`, `summary?`, `recommendation?`, `takenAt` (index).
Pas de table `MarketSnapshot`, `MiningAssumption` ni settings/config (pas encore implémentées).

---

## 5. Hypothèses & provenance (source de vérité honnête)

- `src/lib/projection/assumptions-config.ts` : seam unique versionné (`version v1`, `status CONFIGURED`,
  `source CODE_DEFAULT`). Règle stricte : `ADMIN_CONFIG ≠ REAL` ; un override admin reste `CONFIGURED`
  (jamais `AUDITED/REAL`) ; les overrides changent les **valeurs, jamais les formules**. Pas encore de
  table settings Prisma.
- Provenance possible des coûts mining : `TELEGRAM_COST_MODEL | CONFIGURED | FALLBACK | MOCK`.
  `miningCostsFromCostModel` back-out l'efficacité implicite depuis le cost-model Telegram live.
- Levers produit (`btc-mining-performance-vault.ts`, tous `CONFIGURED`, non validés) : markup 15 %,
  revenue-share 20 % (LP garde 80 %), énergie 0.06 $/kWh, borrow 6 % APR, BTC bear −0.20 / base 0.40 /
  bull 1.20, LTV {avg 0.50, liq 0.825}, machine life 5 ans. Targets : distribution mensuelle
  annualisée **8–12 %**, performance totale **20–24 %** sur ~24 mois **inclusive des distributions,
  jamais additive** (invariant dur). Rien n'est garanti (`guarantees` tous `false`).

⚠️ Point d'attention : les défauts `efficiency 0.1` / `hosting 0.005` sont **dupliqués** dans
`mining.ts`, `mining-cost-assumptions.ts` et `coverage.ts` sans assert automatique entre eux →
dérive silencieuse possible si l'un change sans les autres.

---

## 6. Non-négociables à respecter si tu recodes ça ailleurs

1. **APY toujours en fourchette**, jamais un point unique (`"9.4-12.8%"`).
2. **Chaque métrique porte un badge de provenance** : Live / Oracle / Attested / Estimated / Manual / Stale.
3. **Moteur de scénario pur** : pas de DB, pas de fetch, pas de `Math.random()`, pas de `Date.now()`
   dans le code moteur (seed PRNG injecté).
4. **Mots interdits** dans les sorties : « guarantee », « promise », « certain », « will deliver »,
   « risk-free ».
5. **Aucune action financière/custodiale automatique** : le mining yield est une **projection**,
   la distribution est **gated par le coverage ≥ 1.0**, jamais garantie, jamais payée depuis le principal.
6. **Secrets en `process.env` uniquement** (`TELEGRAM_API_ID/HASH/SESSION`, `CHAINLINK_RPC_URL`,
   `MINING_ENERGY_COST_USD_PER_KWH`), jamais hardcodés ni loggés.
