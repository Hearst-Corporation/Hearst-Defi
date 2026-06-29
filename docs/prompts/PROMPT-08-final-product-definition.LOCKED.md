<!--
  ████ LOCKED REFERENCE DOCUMENT — DO NOT EXECUTE, DO NOT EDIT THE PROMPT BODY ████

  This file archives PROMPT 8 verbatim as the immutable SOURCE PROMPT behind the
  BTC Mining Performance Vault product definition. It is a reference, not a task.

  - It is NOT a request to (re)generate the product definition — that already
    exists, fully written, in `docs/strategy/BTC_MINING_PERFORMANCE_VAULT.md`
    and is mirrored in typed code at `src/lib/products/btc-mining-performance-vault.ts`.
  - The prompt body below (everything under "## PROMPT 8 — verbatim") is FROZEN.
    Do not rewrite, summarize, or "improve" it. If the product strategy must
    change, bump a NEW prompt (PROMPT 9) — never mutate this one.
  - No code edits, no commits, no PR, no build are implied by this file.

  Status:      LOCKED / reference-only
  Archived:    2026-06-30
  Supersedes:  nothing (first archival of PROMPT 8)
  Canonical doc this prompt produced: docs/strategy/BTC_MINING_PERFORMANCE_VAULT.md
  Typed mirror:                       src/lib/products/btc-mining-performance-vault.ts
-->

# PROMPT 8 — Final Product Definition (LOCKED REFERENCE)

> **Read-only archive.** This document freezes the exact prompt that defined the
> **BTC Mining Performance Vault**. Nothing here is to be executed. The product it
> describes is **already authored** (canonical strategy doc) and **already mirrored
> in code** (typed product const). This file exists so the *intent of record* can
> never drift away from what shipped.

---

## How to use this file

- **To read the product** → open `docs/strategy/BTC_MINING_PERFORMANCE_VAULT.md`
  (the 24-section final definition) — that is the human source of truth.
- **To read the product in code** → `src/lib/products/btc-mining-performance-vault.ts`
  (typed const; every number mirrors the doc verbatim, all levers `CONFIGURED`).
- **To understand WHY the product is shaped this way** → this prompt, below.
- **To change the product** → do NOT edit this prompt. Author a new prompt
  (PROMPT 9+), update the canonical doc, then re-mirror the code const.

---

## Prompt → implementation map (what PROMPT 8 asked for vs. what already exists)

This is the only interpretive layer this file adds. The prompt body itself is
frozen below. Statuses reflect the repo at archival time (2026-06-30); they are a
pointer, not a re-validation.

| PROMPT 8 section | Where it lives now | Status |
|---|---|---|
| §0 Product name | doc §2 · code `name: "BTC Mining Performance Vault"` | ✅ written |
| §1 Central thesis | doc §1/§3 · code `thesis: "Mining-first commercially, BTC-cycle-aware financially"` | ✅ written |
| §2 What it is NOT | doc §1 framing · `guarantees: { all false }` | ✅ written |
| §3 One-line thesis (FR+EN) | doc §3 | ✅ written |
| §4 Product architecture (6 engines) | doc §6 · 4 sleeves typed; funding/exit-recovery/operator-spread are the **net-new** constructs | 🟡 sleeves typed, 3 engines documented but not all in code |
| §5 Mining sleeve (30–40% floor) | doc §5 · code `allocation.mining { floor:0.30, min:0.30, max:0.40 }` | ✅ written |
| §6 BTC holding / collateral | doc §6 · code `btcHoldingCollateral { min:0.40, max:0.55 }` | ✅ written |
| §7 Stable Funding Engine | doc §10 · **decision logic not yet a code module** (LTV ladder typed: `levers.ltv`) | 🟡 documented, engine TBD |
| §8 Yield Overlay (excess-only) | code `yieldOverlay { min:0, max:0.10, excessOnly:true }` | ✅ written |
| §9 Allocation targets (3 regimes) | code `regimeBands[]` (balanced / accumulation / harvest) | ✅ written |
| §10 BTC cycle logic (zones) | doc §10 · `btcScenarios { bear:-0.20, base:0.40, bull:1.20 }` | ✅ written |
| §11 Monthly distribution (8–12%) | code `monthlyDistributionTargetAnnualized { min:0.08, max:0.12 }`, coverage-gated | ✅ written |
| §12 Performance target (20–24%, inclusive) | code `totalPerformanceTarget { min:0.20, max:0.24, inclusiveOfDistributions:true }` | ✅ written |
| §13 Exit conditions | doc §13 (maturity / early / phase / protection) | 🟡 documented, state machine TBD |
| §14 Recovery Plan (6–12mo, capital-first) | code `recovery { extensionMonths:{6,12}, defaultMode:"capital_only" }` | ✅ written |
| §15 Machine lifecycle (~5y) | code `levers.machineLifeYears: 5` | ✅ written |
| §16 Operator economics | code `levers.markupPct:0.15`, `revenueSharePct:0.20` · spread accounting **net-new** | 🟡 levers typed, spread TBD |
| §17 Waterfalls (×3) | doc §17 | 🟡 documented, not modeled in code |
| §18 Rebalancing rules | doc §18 · LTV ladder typed (`avg:0.50 trim:0.55 buffer:0.58 cap:0.60 liq:0.825`) | 🟡 thresholds typed, allocator partial |
| §19 Risk framework | doc §19 | ✅ written |
| §20–21 Scenarios | doc §20/§21 · live Monte-Carlo present (`QuantArtifact`, p5/p50/p95) | 🟡 MC live, full scenario table TBD |
| §22 Product outputs (24 sections) | `docs/strategy/BTC_MINING_PERFORMANCE_VAULT.md` | ✅ written |
| §25 Data model | `ProductConstructionDraft` + inputs in the construction pipeline | 🟡 partial |
| §26 Final judgment | doc §26 (24mo, 8–12% monthly, 20–24% total, 30% mining floor, 40–55% BTC, 6–12mo recovery) | ✅ written |

Legend: ✅ written/typed · 🟡 documented but the live engine/state-machine is net-new work.

---

## PROMPT 8 — verbatim (FROZEN — do not edit below this line)

```text
PROMPT 8 — FINAL PRODUCT DEFINITION / BTC MINING PERFORMANCE VAULT

Tu es Opus orchestrateur senior produit + finance + DeFi + mining Bitcoin.

Mission : rédiger, structurer et calibrer le produit final pour Hearst Connect / Hearst DeFi.

Ce n’est pas une mission d’audit.
Ce n’est pas une mission de micro-fix.
Ce n’est pas une mission de pitch vague.

Tu dois produire une définition produit complète, investissable, modélisable et ensuite intégrable dans la plateforme.

# 0. Nom de travail du produit
Nom principal : BTC Mining Performance Vault
Variantes : Bitcoin Mining Performance Vault · BTC Mining Yield & Rebalancing Vault ·
Bitcoin Mining Income & Rebalancing Vault · BTC Mining Performance & Recovery Vault
Produit de référence : BTC Mining Performance Vault

# 1. Thèse centrale obligatoire
Nous sommes une société de mining Bitcoin. Le produit doit vendre du mining Bitcoin réel,
pas un simple trade BTC, pas un simple vault DeFi, pas un simple produit stable yield.
Mais pas 100% mining non plus : performance importante à capter sur le holding BTC selon le cycle.
Contrainte structurante :
  Mining allocation minimum: 30–40%
  BTC holding / collateral remains material
  Stable / funding reserve is a financing and protection tool
  Yield is secondary and only applied on excess liquidity
À comprendre comme : un produit mining-first commercialement, mais BTC-cycle-aware financièrement.
Phrase centrale : Le vault vend une exposition réelle à la production Bitcoin via mining, avec une
poche mining minimale de 30–40%, tout en conservant une poche BTC significative pour capter
l’appréciation du cycle et servir de collatéral stratégique.

# 2. Ce que le produit n’est pas
Jamais : 100% mining · 100% BTC spot · bot de trading · DeFi yield product · APY garanti ·
stablecoin farming · machine leasing simple · produit magique sans risque.
Le produit est : un cycle de performance mining + BTC holding + financement stable + rebalancing + recovery plan.

# 3. Produit en une phrase
Le BTC Mining Performance Vault combine une exposition mining structurelle de 30–40% minimum,
une poche BTC destinée à capter l’appréciation du cycle et à servir de collatéral, et un moteur de
financement stable permettant d’optimiser le paiement des coûts d’énergie et de hosting. Le vault
vise une distribution mensuelle équivalente à 8–12% annualisé, avec une target de performance totale
définie à l’avance. Si la target est atteinte plus tôt que prévu, le vault peut être clôturé par phases
ou en totalité. Si elle n’est pas atteinte à maturité, une phase de recovery peut prolonger l’exposition
du client à la production mining jusqu’à récupération du capital ou selon le waterfall contractuel.
(+ version anglaise institutionnelle.)

# 4. Architecture produit
1. Mining Sleeve · 2. BTC Holding / Collateral Sleeve · 3. Stable Funding Engine ·
4. Yield Overlay · 5. Rebalancing Engine · 6. Exit & Recovery Engine

# 5. Mining Sleeve
Obligatoire et structurelle. Minimum mining exposure: 30–40%. Couvre : ASIC, hosting,
électricité/hydro, maintenance, pool fees, setup, deployment, monitoring. Durée de vie machine ≈ 5 ans.
Performance économique évolue selon : BTC price, hashprice, difficulty, halving, energy, hosting, uptime,
efficiency, resale value. Risque halving explicite : récupérer le capital le plus tôt possible.

# 6. BTC Holding / Collateral Sleeve
Obligatoire. Capte l’upside BTC, sert de collatéral, finance indirectement le mining, évite de vendre
BTC trop tôt. Règle : le BTC n’est pas vendu par défaut pour payer l’électricité. Vendu seulement si
target atteinte, harvest déclenché, ratio collatéral dangereux, remboursement dette pour éviter
liquidation, ou waterfall de sortie l’exige.

# 7. Stable Funding Engine
La stable reserve ne paie pas automatiquement l’électricité. Le moteur décide à l’instant T la source
de financement la plus intelligente (stable en poche, stable yield, emprunt contre BTC, unwind yield,
vente partielle BTC en dernier recours). Compare : borrow cost vs stable yield vs BTC yield vs mining
profitability vs BTC upside vs collateral ratio vs liquidation buffer vs electricity runway vs volatilité.
Phrase centrale : Le vault finance l’électricité et les coûts opérationnels avec la source de liquidité
stable la moins coûteuse et la moins risquée disponible à l’instant T.

# 8. Yield Overlay
Target : 8–12% annualized distribution, paid monthly. Jamais garanti. Yield only on excess BTC or
excess stable liquidity. Never put collateral safety or power funding at risk for yield. Secondaire vs
mining minimum, BTC cycle upside, collateral protection, capital recovery.

# 9. Allocation cible
Core target : Mining 30–40% · BTC 40–55% · Stable 5–15% · Yield 0–10%.
More BTC-cycle-sensitive (BTC bas) : Mining 30–35% · BTC 50–60% · Stable 5–10% · Yield 0–5%.
More harvest / mature (BTC proche target) : Mining 40–55% · BTC 25–40% · Stable 10–20% · Yield 5–10%.
Règle constante : Mining never below the structural minimum unless explicitly triggered by
protection/recovery governance.

# 10. BTC cycle logic
Cycle-aware. Zones : accumulation · balanced · harvest · protection.
Under target → maintain mining min, keep BTC holding, avoid over-selling BTC, finance via stable if safe.
Approaching target → harvest partial gains, repay debt, fund more mining, secure reserve, prepare early exit.
Above target → protect gains, increase reserve, recycle machines, close vault if target reached.
Mining-first commercially, BTC-cycle-aware financially.

# 11. Monthly distribution
Monthly target distribution: 8–12% annualized. Mécanique : mensualisation du yield cible, distribution
depuis mining net cash-flow / realized BTC performance / stable funding. Suspendable/réduite en
protection mode. Distribution is targeted, not guaranteed.

# 12. Performance target
Target : 20–24% over 24 months · Monthly yield 8–12% annualized. Si atteinte tôt : early closure / phase
exit ; client reçoit la performance convenue ; l’opérateur garde/recycle/vend l’infra mining selon waterfall.

# 13. Exit conditions
13.1 Normal maturity (12/18/24 mois) · 13.2 Early target exit · 13.3 Phase exit
(25% à 50% target, 50% à 75%, 100% à 100% — version simple recommandée MVP) ·
13.4 Protection exit (BTC drawdown, collateral stress, hashprice compression, energy shock,
hosting disruption, borrow spike) → pause expansion, reduce/suspend distribution, unwind yield,
repay debt, sell BTC only if required, activate recovery if maturity proche / target missed.

# 14. Recovery Plan
Obligatoire (machines ≈ 5 ans, halving comprime, target possiblement non atteinte à 24 mois).
Options : 6-month · 12-month · until capital recovery · until capital + minimum return · shared recovery.
Mode A — Capital Recovery Only · Mode B — Capital + Minimum Yield · Mode C — Shared Recovery (ex 80/20
puis 50/50). Recommander la plus simple. Phrase : Si le vault n’a pas récupéré le capital client à
maturité, la production mining nette peut continuer à être allouée au client pendant 6 à 12 mois, ou
jusqu’à récupération du capital selon le waterfall défini.

# 15. Machine lifecycle
0–24 mois : primary client performance phase · 24–36 mois : recovery/continuation si besoin ·
36–60 mois : residual operator upside / redeployment / resale / new vault cycle.
Le client finance un cycle de performance ; l’opérateur construit et recycle une base productive.

# 16. Operator economics
Revenus : performance spread above client target · management/structuring fee · fee on yield ·
spread actual vs target distribution · resale machines · reuse in future vaults · residual production
after client exit · financing spread. Ne pas cacher que l’opérateur gagne sur l’écart — alignement :
le client reçoit une performance définie, l’opérateur est incité à la dépasser.

# 17. Waterfalls
17.1 Normal : power/hosting/maintenance → financing/interest → min stable reserve → monthly target
distribution → repay/manage stable debt → client target performance → operator spread → machine recycle/resale.
17.2 Early closure : realize enough → pay accrued distributions → pay target/principal → close client vault →
operator retains/reallocates/sells → residual seeds new vault.
17.3 Recovery : essential operating costs → suspend/reduce operator fees → net mining production to client
recovery → recover capital → optionally recover min yield → end at cap → residual machines to operator/next/sale.

# 18. Rebalancing rules
Mining target 30–40% minimum. BTC holding material for cycle upside. Stable used/borrowed/deployed/unwound
per risk-adjusted funding cost. BTC sold only if target reached / harvest / collateral unsafe / debt repayment
/ waterfall settlement. Borrow against BTC if borrow cost < stable yield or mining return (risk-adjusted),
collateral comfortable, liquidation buffer sufficient, volatility acceptable, debt within cap. Don’t borrow if
collateral stressed, borrow cost high, BTC vol high, stable reserve low, buffer insufficient.

# 19. Risk framework
Risks : BTC drawdown, hashprice compression, halving, difficulty increase, energy/hosting cost increase,
machine delivery, machine failure, uptime, borrow spike, liquidation, counterparty, custody, stablecoin,
regulatory, exit liquidity, machine resale value. Controls : min stable reserve, collateral thresholds, human
approval for rebalancing, no guaranteed-yield language, distribution deferral mode, recovery extension, resale/
redeploy options, borrow caps, LTV caps, yield whitelist, data freshness checks.

# 20. Scenario framework
Scenario tables (min) : Downside BTC · Flat BTC · Base BTC · Bull BTC · Fast Bull/Early Target ·
Hashprice Compression · Borrow Cost Spike · Halving Compression · Machine Price Discount · Hosting Cost Stress.
Each : allocation · monthly distribution status · BTC action · mining action · stable funding action · debt
action · exit/recovery implication · operator economics.

# 21. Example scenarios
Fast bull : BTC rises quickly, 24% in 6 months, vault closes early, machines recycled/retained/sold.
Slow/flat : mining produces, monthly target partially covered, stable funding supports, recovery if target missed.
Downside : BTC falls, collateral weakens, distributions reduced, expansion paused, debt reduced, recovery likely.
Mining compression : halving/difficulty compresses, margin declines, no new machines, yield/rebalancing protects.

# 22. Product outputs required
1 Executive summary · 2 Product name · 3 One-line thesis · 4 Why now · 5 Target investor ·
6 Product architecture · 7 Allocation model · 8 Mining minimum rationale · 9 BTC holding rationale ·
10 Stable Funding Engine · 11 Yield target & monthly distribution · 12 Exit mechanics · 13 Recovery Plan ·
14 Machine lifecycle · 15 Operator economics · 16 Waterfalls · 17 Rebalancing rules · 18 Risk framework ·
19 Scenarios · 20 Data needed for live model · 21 MVP implementation plan · 22 Open questions ·
23 Final institutional pitch FR · 24 Final institutional pitch EN.

# 23. Tone and positioning
Institutional, clear, commercial, not hype, not over-technical, not DeFi bro, not mining brochure only,
not guaranteed yield. Should feel like a real mining operation packaged into an investable performance
cycle — not a crypto APY farm.

# 24. Critical language rules
Use : target · expected · subject to · risk-adjusted · collateral protected · monthly distribution target ·
recovery extension · performance target · waterfall.
Avoid : guaranteed · risk-free · fixed APY · secured profit · always profitable · no downside.

# 25. Data model preparation
Inputs : capitalAmount, targetDurationMonths, targetAnnualDistribution, targetTotalPerformance,
minMiningAllocation, btcHoldingAllocation, stableReserveAllocation, machinePrice, machineHashrate,
machineEfficiency, machineLifeYears, hostingCost, electricityCost, uptime, hashprice, btcPriceNow,
btcTargetPrice, borrowCost, stableYield, btcYield, collateralRatio, liquidationThreshold.
Outputs : monthlyDistributionTarget, expectedMiningProduction, expectedBTCUpside, stableFundingDecision,
borrowDecision, rebalanceDecision, earlyExitTrigger, recoveryTrigger, operatorSpread, machineResidualValue.

# 26. Final judgment required
Best product form · Recommended target duration · Recommended monthly distribution range ·
Recommended total target · Recommended minimum mining allocation · Recommended BTC holding range ·
Recommended recovery extension · Recommended first MVP version. (Do not be vague.)

# 27. Final answer format
Return a polished product document "# BTC Mining Performance Vault — Final Product Definition" then full product.
No code implementation yet. No repo edits yet. No commit. No PR. Final product strategy document that will
later feed the app prompt.

PROMPT 8
```

<!-- END FROZEN PROMPT — nothing below the verbatim block, by design. -->
