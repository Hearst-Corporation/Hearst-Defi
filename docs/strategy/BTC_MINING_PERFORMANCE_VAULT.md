# BTC Mining Performance Vault — Final Product Definition

> **Canonical product source of truth.** Internal product-strategy document feeding
> the app integration (`src/lib/products/btc-mining-performance-vault.ts`).
>
> All return figures are **target / expected**, expressed as a **range**,
> **risk-adjusted** and **collateral-protected** — **subject to** BTC price,
> hashprice, network difficulty, USDC yield and borrow-rate changes — and are
> **not guaranteed**. Every company lever cited (markup 15%, revenue-share 20%,
> energy $0.06/kWh, borrow 6% APR, BTC scenarios −20/+40/+120, fee model) is
> status **CONFIGURED, not VALIDATED/CONTRACTUAL** until DB-backed,
> admin-validated and audited (see §22).

---

## 1. Executive summary

The **BTC Mining Performance Vault** is a real Bitcoin mining operation packaged
into an investable performance cycle — **mining-first commercially,
BTC-cycle-aware financially**. It is not a BTC trade, not a DeFi yield farm, and
not a guaranteed-APY instrument.

The vault runs four economic sleeves over a **target ~24-month cycle**: a
**structural mining sleeve (30% floor, 30–40% band)** that produces the monthly
income; a **BTC core/collateral sleeve (40–55%)** that carries cycle upside and
backs borrowing; a **stable funding engine (10–15%)** that finances electricity
and operating costs from the cheapest, least-risky source at each point in time;
and a **secondary yield overlay (0–10%)** deployed only on genuine excess
liquidity.

It delivers two layers, **never double-counted**: a **monthly distribution target
of 8–12% annualized** (paid in USDC, coverage-gated, sourced from net mining cash
flow), and a **total performance target of ~20–24% over the cycle** (inclusive of
those distributions plus captured BTC/mining performance above principal). The
cycle allows **early closure** if the target is hit sooner, and a mandatory
**6–12 month recovery extension** (capital-first) backstops an adverse cycle. The
operator is remunerated transparently on the **spread above the client target**
plus structuring/financing spread and machine resale/redeploy residual — the
client's target band is the operator's hurdle, not the ceiling.

Most of the economic engine (Telegram cost model, allocator, rebalancing rules,
vault-APY composition, live market feeds, Monte-Carlo) is **already implemented**;
the net-new constructs are the **stable funding decision**, the **exit/recovery
state machine**, and the **operator-spread accounting**.

---

## 2. Product name

**Primary: BTC Mining Performance Vault.**

| Variant | Positioning trade-off |
|---|---|
| **BTC Mining Performance Vault** *(pick)* | Leads with *performance cycle*, not a single yield number; "BTC" reads cleaner/more institutional than "Bitcoin". |
| Bitcoin Mining Performance Vault | Same positioning; "Bitcoin" spelled out reads slightly more retail and longer. |
| BTC Mining Yield & Rebalancing Vault | "Yield" over-indexes on income and invites a guaranteed-APY read; "Rebalancing" surfaces internal machinery. |
| Bitcoin Mining Income & Rebalancing Vault | "Income" narrows to distributions and undersells the BTC-cycle capital layer. |
| BTC Mining Performance & Recovery Vault | Accurate, but "Recovery" foregrounds the downside in the headline — keep it a documented feature. |

"Performance" is the only word that spans both layers — the coverage-gated
monthly distribution *and* the captured BTC/mining performance above principal —
without collapsing into a single yield figure or implying a guarantee.

---

## 3. One-line thesis (FR / EN)

**FR (central anchor):** *Une exposition minière réelle (plancher 30–40 %) qui
reste consciente du cycle BTC, adossée à un moteur de financement stable, avec un
objectif de distribution mensuelle, un objectif de performance défini, une sortie
anticipée possible et un plan de recovery.*

**EN (institutional):** A real, mining-first Bitcoin exposure (30–40% structural
floor) that stays BTC-cycle-aware — backed by a stable funding engine, a monthly
distribution target paid in USDC, a defined full-cycle performance target, an
early-exit mechanism, and a documented recovery extension. **Mining-first
commercially, BTC-cycle-aware financially** — target and expected, risk-adjusted
and collateral-protected, never guaranteed.

---

## 4. What it is / what it is not

**It IS:** a real Bitcoin mining operation packaged into an investable performance
cycle — mining production + a BTC core holding + stable financing + rule-based
rebalancing + a defined recovery plan. **Mining-first commercially,
BTC-cycle-aware financially.**

**It is NOT:**

- **Not 100% mining.** Mining is the structural floor (30–40%), not the whole book.
- **Not 100% BTC spot.** The BTC core (40–55%) is collateral-protected and rule-managed, not a naked long.
- **Not a trading bot.** Rebalancing is rule-based and governance-gated, not discretionary.
- **Not a DeFi yield farm.** The yield overlay (0–10%) runs only on genuine excess liquidity.
- **Not a guaranteed-APY instrument.** Every figure is a target/expected range — collateral-protected, not guaranteed.
- **Not stablecoin farming.** The stable reserve is a funding/distribution buffer, not the source of return.
- **Not simple machine leasing.** Investors hold a position in a managed performance cycle, not a rental claim on hardware.

**Core sentence (FR):** *Le BTC Mining Performance Vault combine une exposition
mining structurelle de 30–40 % minimum, une poche BTC destinée à capter
l'appréciation du cycle et à servir de collatéral, un moteur de financement
stable, une distribution mensuelle cible, une target totale inclusive, une sortie
anticipée possible et un recovery plan capital-first.*

---

## 5. Target investor

- **Who buys this.** Institutions, family offices, and qualified/accredited investors seeking real-asset-backed Bitcoin exposure with a defined performance cycle — not passive spot or yield farming.
- **Share classes (ADR-008).** **Class A — institutional:** $250k min, 60-day soft lock-up, 100 bps mgmt / 1000 bps perf. **Class B — large-allocator:** $1M min, 90-day soft lock-up, 75 bps mgmt / 800 bps perf.
- **Risk profile.** Comfortable with BTC price, hashprice, difficulty, USDC-yield and borrow-rate variability. Returns are target/expected ranges (≥ 50 bps display spread), collateral-protected through maintained LTV bands, not guaranteed. The 6–12 month recovery extension (capital-only by default) is the defined backstop.
- **Time horizon.** A target ~24-month cycle, with early closure if the target is hit sooner. The 60–90 day soft lock-up signals medium-term, cycle-length capital — not trading liquidity.

---

## 6. Product architecture

Six interacting sleeves/engines:

1. **Mining Sleeve (30–40%, 35% center).** The productive core: client-financed ASICs that earn the net mining cash flow from which distributions are paid. 30% structural floor, never raised at the expense of power runway. Net margin (after energy, hosting, pool fees, 20% company revenue-share) is the *only* source the coverage gate accepts for distributions.
2. **BTC Holding / Collateral Sleeve (40–55%).** Dual-purpose: carries cycle upside (realized via take-profit) *and* serves as collateral for USDC borrowing at a maintained, risk-adjusted LTV. Collateral-protected, cycle-aware, not sold by default.
3. **Stable Funding Engine (10–15% Balanced; 15–25% Defensive; 5–10% Harvest).** Funds electricity/hosting/operating costs without forcing debt or BTC sales when collateral runs warm; thickens late-cycle to secure distributions and power runway through halving compression.
4. **Yield Overlay (0–10%).** Opt-in, on genuine excess stable/BTC liquidity only — never from collateral or power runway. Subordinate, incremental.
5. **Rebalancing Engine.** Rule-based allocator deriving sleeve weights from risk-adjusted scores; enforces cycle logic and keeps mining at/above its floor commercially. Three coded regimes (Balanced / Opportunistic / Defensive); Methodology v1.0 rule-based, Monte-Carlo p5/p50/p95 additive under v2.0, headline always a range.
6. **Exit & Recovery Engine.** Early closure when the total target is hit; the 6–12 month Recovery Plan (Mode A capital-only default; B; C). *Net-new — needs engineering scoping before it can be projected/governed.*

---

## 7. Allocation model

Indicative regimes, not fixed weights — actual exposure is risk-adjusted and
derived at runtime.

| Regime | Mining | BTC Holding | Stable Reserve | Yield Overlay |
|---|---|---|---|---|
| **Core / Balanced** (default) | 30–40% (35% center) | 40–55% (core + tactical) | 10–15% | 0–10% |
| **BTC-cycle-sensitive / Accumulation** (Opportunistic) | 30–40% (held at floor) | 50–55%+ | 5–10% | 0% (suspended) |
| **Harvest / Mature** (late-cycle / pre-halving / recovery) | 30–40% (declining toward floor) | 40–50% (trimmed) | 15–25% (thickened) | 0–10% (on genuine excess) |

**Constant rule — structural mining floor:** *Mining is never below the structural
minimum (30%) unless explicitly triggered by protection/recovery governance.* The
40–55% BTC band is **core collateral plus tactical exposure combined**.

The allocator is mechanical: each sleeve receives a risk-adjusted score (expected
return over a volatility proxy — mining 35%, BTC 65%, USDC 3%), and weights rotate
toward the better score. If mining net margin is thin/unprofitable at prevailing
hashprice, the engine rotates weight toward USDC — at the limit, all-stable when
every score ≤ 0. **Commercially, the structural mining floor still holds:** a drop
below 30% is a protection/recovery-governance exception (the engine returns
`requires_governance_exception`), not a routine allocator outcome.

---

## 8. Mining minimum rationale

The 30–40% mining band is structural because the product *is* a Bitcoin mining
operation. The client finances a real, productive asset — ASIC hardware that
hashes and earns — and that asset keeps producing after the client's cycle ends.
Below ~30% the structure stops being a miner. The operator retains the ability to
recycle, redeploy, or resell machines into the next cycle, so the hardware carries
residual value independent of any single client's lock-up.

**The mining sleeve covers the full real-world cost stack:** ASIC acquisition
(Letine ex-works + 15% company markup, amortized) · hosting/rack · electricity/hydro
(modeled at $0.06/kWh against efficiency and uptime) · maintenance · pool fees ·
setup/provisioning · deployment, freight ($100/unit), and destination customs
(default UAE 5%) · monitoring/ops.

**Economic drivers (projected as ranges, never a point):** BTC price, hashprice,
difficulty, the halving schedule, energy cost, hosting cost, uptime, machine
efficiency (J/TH), and resale value. Live hashprice and BTC price drive yield at
runtime, with conservative fallbacks flagged stale ($0.055/TH/day, BTC $100k).

Machines carry roughly a **five-year productive life**, amortization
cooling-dependent (air-cooled 36 months, hydro/immersion 60 months); the clean
"~5-year recover-capital" narrative holds most cleanly for **hydro/immersion
fleets**. Each halving compresses BTC issued per unit of hashrate, so late-cycle
margin compresses structurally — the response is deliberate: redeploy or resell
machines to recover capital early, stepping toward early closure or the Recovery
Plan rather than mining at a degrading margin.

---

## 9. BTC holding rationale

A meaningful BTC sleeve (40–55%) is mandatory for three reasons. **Cycle upside:**
BTC's price cycle is the primary source of performance above principal — mining
produces income, BTC carries appreciation. **Collateral:** the BTC core is the
base against which USDC is borrowed at a maintained, risk-adjusted LTV, indirectly
financing mining without selling the asset. **Timing discipline:** holding through
the cycle avoids selling the core too early.

**Rule — BTC is not sold by default to pay electricity.** Operating costs are
funded first from net mining cash flow and the stable reserve; when collateral
runs warm, electricity is paid from the reserve rather than by adding debt or
liquidating BTC.

**BTC may be sold only under defined conditions:** target reached / harvest zone
(take-profit trims) · unsafe collateral ratio (pre-emptive de-lever well before
liquidation) · debt repayment to avoid liquidation · waterfall settlement at
closure/wind-down. Outside these triggers, the default posture is to **hold**.

---

## 10. Stable Funding Engine

The operation must pay electricity and operating costs every month, but the
**source** of that cash is a decision, not a default. The core rule is deliberate
and auditable: **the stable reserve does NOT automatically pay electricity.** At
each settlement point T, costs are financed from the **cheapest, least-risky
stable-liquidity source available at that moment**, selected by comparing each
candidate's all-in cost against the productive value it consumes — preserving the
BTC core (cycle upside) and the power runway (keeps machines hashing), subject to
collateral and coverage constraints.

Costs are computed from the coded model: energy **$0.06/kWh** (applied as
`(J/TH × 24 / 1000) × 0.06 × 0.98` uptime); borrow **6% APR** on USDC against BTC
collateral, with borrow drag (`borrowApr × avgLtv × btcWeight`) always subtracted.

### Candidate funding sources (ascending all-in cost)

1. **`USE_IDLE_STABLE`** — idle USDC above the power-runway floor; cheapest, idle slice only.
2. **`USE_STABLE_YIELD`** — spend the yield while leaving overlay principal deployed.
3. **`BORROW_AGAINST_BTC`** — draw USDC against BTC at 6% APR, subject to the LTV ladder (maintained 0.40–0.55; trim 0.55; pay-from-reserve 0.58; cap 0.60; lender liquidation 0.825, protocol de-levers ~37.5% before). Preferred when borrow cost is below the opportunity cost of what it replaces and the buffer is comfortable.
4. **`UNWIND_STABLE_YIELD`** — pull deployed overlay back to cash; stops income, no collateral impact.
5. **`UNWIND_BTC_YIELD`** — before selling core BTC.
6. **`SELL_BTC_LAST_RESORT`** — partial BTC sale, **harvest / protection / settlement only**. Selling the core to pay an electricity bill is the most expensive financing and is governed accordingly.

Plus protective outputs: **`PAUSE_DISTRIBUTION`** (coverage < 1.0) and
**`PROTECT_COLLATERAL`** (LTV/vol veto).

### Decision rules (encoded as a pure function)

- If **LTV ≥ 0.58** or **volatility index > 90** → **veto new borrowing**.
- If collateral comfortable and **borrow APR < opportunity cost of the productive stable it replaces** → borrow can be recommended.
- If **coverage < 1.0** → do **not** pay the monthly distribution.
- If **coverage < 0.8** → **suspend** distribution.
- **Never** pay distributions from principal erosion.
- **BTC sale** only on harvest / protection / settlement.
- Never let any source pull the stable reserve below its power-runway floor.

### Worked example 1 — cheap-borrow case

BTC core $5,000,000, LTV **0.45**. Monthly power+ops due **$120,000**. Stable
overlay $800,000 at the live best-pool USDC yield (**assume 9% at T — above the
4.5% conservative fallback, so this case requires a genuinely high-yield pool**).
Live borrow APR ≈ 6%. Coverage 1.18.

Borrowing $120k at 6% costs **~$600/mo**; consuming $120k of reserve foregoes
~9% × $120k ≈ **~$900/mo** of yield. Net of the ~$600/mo carry, **borrowing
preserves ~$300/mo (≈ the 9%−6% spread on $120k)**; the full $800k overlay keeps
earning regardless. **Decision: borrow.** **Caveat:** *if live stable yield is
at/below the borrow rate (near the 4.5% fallback), this case inverts — fund from
idle reserve instead of borrowing.*

### Worked example 2 — stressed case

LTV drifted to **0.57**, live borrow APR spiked to **~14%**, stable yield
compressed to ~4.5%, mining margin compressed (score ~46), vol_index ~93, coverage
**0.92**. Decision (in order): (1) **do NOT borrow**; (2) **unwind stable yield**
and **pay from reserve** per the 0.58 rule; (3) **de-lever** 0.57 → 0.50; (4)
**sell BTC only if required** (LIFO-logged for re-buy ≤ sale price); (5) at
coverage 0.92 the distribution is **not paid** (suspended below 0.8), never from
principal.

---

## 11. Monthly distribution

The vault carries an **8–12% annualized monthly distribution target**, paid
**monthly in USDC** — a **target, not a guarantee**: expected, risk-adjusted,
collateral-protected, and **coverage-gated**. The headline is always a **range**.

> **Basis (gross/net):** The 8–12% distribution and 20–24% total-performance
> targets are stated **NET of the management fee and the borrow drag, and BEFORE
> the performance fee** (which the operator earns only on performance above the
> client target band). The projection layer currently models a single
> **feePct = 2%** pending the ADR-008 per-class reconciliation (Class A 100/1000
> bps; Class B 75/800 bps).

Distributions are sourced strictly from realized cash, ranked **secondary** to the
structural priorities the vault protects, in order: (1) the 30% mining floor; (2)
the BTC core sleeve; (3) collateral safety + power-funding runway; (4) capital
recovery. **Yield is generated only on excess BTC/stable liquidity; the vault
never risks collateral safety or power funding to produce yield.**

**Coverage gating (canonical).** Coverage = net mining cash / target distribution.
Bands (`coverage.ts`): **healthy ≥ 1.25, adequate 1.0–1.25, stressed 0.8–1.0,
suspended < 0.8.** A distribution is **paid only when coverage ≥ 1.0** (adequate
or better), is **never labelled "healthy" below 1.25**, and is **suspended below
0.8 — never paid by principal erosion.** Under stress, governance may reduce,
defer, or suspend the distribution.

---

## 12. Total performance target

Above the income stream sits the **total performance target: ~20–24% over the
~24-month cycle**. The two figures describe **different layers of the same cycle,
never double-counted**:

- The **monthly distribution target (8–12% annualized)** is the **income stream** — net mining cash, coverage-gated, monthly USDC. Over ~24 months it compounds to roughly **16–24% paid in cash**.
- The **total performance target (~20–24%)** is the **full-cycle return on principal** — **inclusive of** those distributions **plus** captured BTC-core and mining performance above principal (take-profit, machine resale/redeploy residual, financing spread).

> **The bands are aligned, not additive: total performance is INCLUSIVE of
> distributions, so the two never sum.** At the top of the distribution band
> (≈ 12%/yr ≈ 25% cash over 24 months), the cash component alone can meet or
> slightly exceed the lower total-performance target; there, the target is
> realized **primarily through distributions**, with BTC/mining appreciation
> providing headroom toward the upper 24%. Distributions are paid from **mining
> cash**; the **BTC core** carries the cycle upside — the two never overlap.

**The UI must never imply `8–12% annualized + 20–24% final`.** It must say:
"8–12% annualized monthly distribution target" and "20–24% total target over
~24 months, inclusive of distributions".

---

## 13. Exit mechanics

**(a) Normal maturity exit.** Target cycle 24 months, with tranche exits at
**12 / 18 / 24 months**. At each, the client receives **principal + accrued target
performance** per the waterfall. The mining fleet is **not liquidated reflexively**.

**(b) Early target exit.** If the total performance target is hit before 24 months,
the cycle may close early: distributions confirmed, remaining target settled,
principal returned per the same waterfall. A target outcome, not a guarantee.

**(c) Phase exit.** **Stepped (MVP, recommended):** **25%** of the position
eligible to exit at **50% of target**; **50%** at **75%**; **100%** at **100%**.
A 4-phase waterfall (distribute accrued yield → return target performance →
return/settle principal → operator retains/recycles/sells) is the conceptual model
the stepped version approximates.

**(d) Protection exit.** On adverse conditions: pause expansion → reduce/suspend
the distribution (coverage-gated) → unwind the yield overlay first → repay debt →
sell BTC only if de-lever + reserve are insufficient → activate the Recovery Plan
if near maturity or target at risk. Collateral-protected, not guaranteed.

---

## 14. Recovery Plan

**Mandatory** and structural. Rationale: machines have a **~5-year life**;
**halving compression** can thin late-cycle margin; the target may not be reached,
and capital may not be fully recovered, within 24 months. The plan extends the
cycle by a **6–12 month recovery extension**, during which **net mining production
continues to be allocated toward the client** until capital and/or remaining
target is recovered.

> *Si le vault n'a pas récupéré le capital client à maturité, la production mining
> nette peut continuer à être allouée au client pendant 6 à 12 mois, ou jusqu'à
> récupération du capital selon le waterfall défini.*

**Modes:**

- **Mode A — Capital-only (default backstop).** Net production returns outstanding principal first; no yield component. Default. Operator performance fees suspended/reduced until the recovery waterfall is satisfied.
- **Mode B — Capital + minimum yield.** When residual coverage allows, returns principal **and** a minimum distribution.
- **Mode C — Shared split (governance election).** Net production split (e.g. 80/20 client early, stepping to 50/50 after capital recovery).

**MVP: Mode A only.** B/C deferred (need a recovery state machine + coverage-conditional
accounting not yet in code). Recovery maximizes the probability of full capital
return — it is **not a guarantee of recovery**.

---

## 15. Machine lifecycle

**Le client finance un cycle de performance ; l'opérateur construit et recycle une
base productive.**

- **0–24 months — Primary client performance.** Net production drives the monthly distribution + total performance target.
- **24–36 months — Recovery / continuation (if needed).** If target/capital not reached, the fleet runs under the 6–12 month recovery extension; if the cycle closed cleanly, this window belongs to the operator.
- **36–60 months — Residual operator upside.** Within the ~5-year life, the residual fleet is redeployed into a new vault, resold for residual value, or re-run. Amortization is cooling-dependent (air ~36mo, hydro/immersion ~60mo) — the "~5-year / recover early" narrative applies most precisely to **hydro/immersion-weighted fleets**.

---

## 16. Operator economics

The product delivers a **defined performance band** to the client; the operator is
remunerated **on the excess and on operational efficiency** — stated transparently,
because it aligns the operator's incentive with delivering and beating the client's
target. **Operator spread is kept strictly separate from the client distribution
and never increases the displayed client distribution.**

**How the operator earns:** performance spread above the client target band ·
structuring/management fee (Class A 100 bps / Class B 75 bps) · performance fee
(Class A 1000 bps / Class B 800 bps, *in addition to* the spread) · fee on the
yield overlay · spread between actual mining performance and target distribution
(surplus when coverage > 1.0) · 15% machine markup + 20% revenue-share on net
mining income (client keeps 80%) · machine resale · machine reuse in future vaults
· residual production after client exit · financing spread (between 6% borrow and
the deployed use).

**Why this is alignment, not extraction.** The client receives a defined,
collateral-protected, coverage-gated band sourced from net mining cash. The
operator only earns the upside by **beating** that band — through operational
efficiency, BTC-cycle timing, and asset recycling. **The client's floor is the
operator's hurdle.** All operator-side figures are CONFIGURED modeling assumptions
(§22), subject to the same conditions as client returns.

---

## 17. Waterfalls

### 17.1 Normal operating waterfall (24-month cycle)

1. Power, hosting, maintenance ($0.06/kWh at 0.98 uptime).
2. Financing and interest (6% APR on drawn USDC).
3. Maintain the minimum stable reserve (10–15% Balanced).
4. Monthly distribution target — released **only from net mining cash flow** and **only when coverage ≥ 1.0** (suspended < 0.8; never from principal).
5. Repay/manage stable debt (de-lever toward target average LTV).
6. Client target performance (toward 20–24% total, inclusive of distributions).
7. Operator performance spread (perf fee + spread above the client target) — only after the client band is delivered.
8. Machine recycle / resale / residual (seeds the next cycle).

### 17.2 Early-closure waterfall

1. Realize enough performance to meet the client target. 2. Pay accrued
distributions. 3. Pay target performance + return of principal per contract. 4.
Close the client vault. 5. Operator retains/reallocates/sells equipment. 6.
Residual production seeds the next vault.

### 17.3 Recovery waterfall (6–12 month extension)

1. Essential operating costs only. 2. **Suspend/reduce operator performance fees**
(operator served last). 3. Allocate net mining production to client recovery. 4.
Recover client capital (Mode A default). 5. Optionally recover minimum target yield
(Mode B; Mode C shared split by governance). 6. End at the recovery cap/threshold.
7. Residual machines to operator / next vault / sale.

---

## 18. Rebalancing rules

Simple, deterministic, **PTAI** (Projection → Trigger → Action → Impact). The
implemented engine (`rebalancing-rules.ts`, `allocator.ts`) is the backbone.

**Standing constraints.** Mining floor **30–40%** (35% center), never below 30%
except under protection/recovery governance · BTC core **40–55%** (core + tactical
combined) · stable reserve **10–15%** (15–25% Defensive, 5–10% Harvest) · yield
overlay **0–10%** on excess only.

**Implemented rule backbone (illustrative thresholds — verify against
`rebalancing-rules.ts` before treating as contractual):**

- **R1 — a sustained BTC drawdown (≈ −20% to −25% over 30 days) → step toward Defensive** and thicken the reserve. *Re-scoped as a protection/recovery-governance exception when it would drive mining below the 30% floor.*
- **R2 — mining margin score < 50 → reduce mining exposure toward the floor.** *Any reduction below 30% is a governance action, not routine.*
- **R3 — margin > 75 + BTC momentum → raise mining, cap 45%.**
- **R4 — hashprice −20% over 30 days → human/governance review.**
- **R5 — stable APY > mining net (risk-adjusted) → rotate excess to USDC/RWA** (switch only on positive net-of-fee gain; must not displace the 30% floor).
- **R-BTC** — accumulate +5pp tranches at −20% / −35% drawdown while margin ≥ 60; take-profit trims 25% at +30% / +60% into the reserve; vol guardrail at vol_index > 90.

**BTC-sale conditions:** target reached · harvest zone · collateral unsafe · debt
repayment · waterfall settlement. LIFO re-entry (re-buy ≤ sale price as LTV
normalizes 0.50 → 0.40).

**LTV thresholds** (target avg ~0.50): **0.55** trim → 0.50; **0.58** pay
electricity from reserve; **0.60** hard cap, forced de-lever; **0.50 → 0.40** LIFO
re-buy; **~0.825** lender liquidation (de-lever ~37.5% before).

---

## 19. Risk framework

| Risk | Impact | Control |
|---|---|---|
| BTC drawdown | Weakens BTC-core collateral, lifts LTV | LTV thresholds, de-lever before 0.825 |
| Hashprice compression | Thins net mining cash; coverage < 1.0 | Reserve buffer, distribution deferral |
| Halving | Cuts BTC/hashrate production late-cycle | Harvest regime, recover capital early |
| Difficulty increase | Reduces output at constant hashprice | Live feeds, conservative fallbacks |
| Energy / hosting cost ↑ | Reduces net margin, coverage | Reserve, redeploy/relocate fleet |
| Machine delivery | Postpones hashrate / cash flow | Freight/customs modeled, staged deploy |
| Machine failure / uptime | Lowers realized production | 0.98 uptime assumption, monitoring |
| Borrow cost spike | Raises borrow drag | Borrow caps, fund from reserve |
| Liquidation risk | Forced collateral sale | De-lever ~37.5% before 0.825 |
| Counterparty / custody | Lender/hosting/supplier/custodian default | Diversification, governance |
| Stablecoin risk | USDC de-peg disrupts coverage | Yield whitelist, freshness checks |
| Regulatory risk | Mining/securities/custody regime change | Compliance posture |
| Exit liquidity | Soft lock-up + illiquid base | Staged redemptions, recovery extension |
| Machine resale value | Weak secondary pricing | Residual-value discipline |

**Cross-cutting controls:** minimum stable reserve · graduated LTV thresholds ·
per-vault LTV/borrow caps · **human-in-the-loop approval for rebalancing** (engine
proposes, never auto-executes) · no-guaranteed-yield language (every projection a
≥ 50 bps range) · distribution deferral/suspension (coverage-gated) · 6–12 month
recovery extension · machine resale/redeploy · yield whitelist (excess-only) ·
data-freshness checks (flagged-stale fallbacks).

---

## 20. Scenario framework

All figures target/expected, risk-adjusted ranges. Mining yield ~5–14% depending
on live hashprice; borrow drag ~6% APR. Monthly distribution 8–12% annualized
(coverage-gated); total target ~20–24% over ~24 months (inclusive of distributions).

| Scenario | Allocation tilt | Distribution | BTC action | Mining action | Funding | Exit / recovery |
|---|---|---|---|---|---|---|
| Downside BTC (−20%) | Defensive; mining at floor | Reduced; suspend < 0.8 | Hold core; LIFO re-buy on de-lever | Hold at floor | Thicken reserve 15–25% | Recovery extension likely (Mode A) |
| Flat BTC (~0%) | Balanced 35/15/40/10 | At/near target if coverage ≥ 1.0 | Hold; no tactical add | Run at floor | Reserve 10–15% supports gap | On-schedule or modest extension |
| Base BTC (+40%) | Balanced | At target, coverage healthy | Modest appreciation accrues | Healthy margin | Reserve baseline | On-schedule toward 20–24% |
| Bull BTC (+120%) | Accumulation; BTC 50–55%+ | At/above target | Accumulate; trim 25% at +30%/+60% | Run at floor | Take-profit into reserve | Target likely hit early → closure |
| Fast Bull / Early Target | Harvest once hit | Continue to target | Trim core, realize upside | Resell/redeploy to recover early | Thicken reserve | **Early closure** |
| Hashprice Compression | Hold floor; defensive liquidity | Reduced; may suspend < 0.8 | Hold collateral | Hold; R4 review at −20%/30d | Draw reserve | Recovery if persistent |
| Borrow Cost Spike | Balanced → defensive | Pressured by drag | Hold; avoid leverage | Hold at floor | Use reserve, not borrow | On-schedule if margin absorbs |
| Halving Compression | Harvest; mining ≥ 30% floor | Defend via reserve | Trim core 40–50% | No new machines; redeploy/resell | Thicken reserve 15–25% | Early closure or recovery |
| Machine Price Discount | Balanced; opportunistic | Stable at target | Hold core | Add machines at discount | Fund from excess reserve | On-schedule or earlier |
| Hosting Cost Stress | Defensive liquidity | Reduced if margin compresses | Hold; no forced sale | Hold; relocate if persistent | Draw reserve | Recovery if structural |

---

## 21. Data model — inputs / outputs

**Inputs.** `capitalAmount` (user) · `targetDurationMonths` (config, ~24) ·
`targetAnnualDistribution` (config, 8–12%) · `targetTotalPerformance` (config,
20–24%, inclusive) · `minMiningAllocation` (config, 30% floor) ·
`btcHoldingAllocation` (config, 40–55%) · `stableReserveAllocation` (config,
10–15%) · `machinePrice` (config, ex-works before 15% markup) · `machineHashrate`
· `machineEfficiency` (J/TH → energy) · `machineLifeYears` (~5y; air 36mo / hydro
60mo) · `hostingCost` · `electricityCost` ($0.06/kWh) · `uptime` (0.98) ·
`hashprice` (**live**, fallback $0.055) · `btcPriceNow` (**live**, fallback $100k)
· `btcTargetPrice` (config, −20/+40/+120) · `borrowCost` (config, 6%) ·
`stableYield` (**live**, fallback 4.5%) · `btcYield` (overlay, excess only) ·
`collateralRatio` (config, 0.40/0.50/0.55) · `liquidationThreshold` (0.825).

**Outputs.** `monthlyDistributionTarget` (range, coverage-gated) ·
`expectedMiningProduction` · `expectedBTCUpside` · `stableFundingDecision` **[new]**
· `borrowDecision` · `rebalanceDecision` · `earlyExitTrigger` **[new]** ·
`recoveryTrigger` **[new]** · `operatorSpread` **[new]** · `machineResidualValue`
**[new]**.

---

## 22. CONFIGURED vs VALIDATED status model

Every model value carries a status. For this product, **most values are
CONFIGURED, not validated**.

| Status | Meaning |
|---|---|
| **CONFIGURED** | A code/admin default. Plausible, internally consistent, **not** validated by a business owner, DB, or audit. The default for this product's levers. |
| **VALIDATED** | Reviewed and signed off by a business owner / admin against a real source. |
| **CONTRACTUAL** | Bound into an executed client contract / term sheet. |
| **LIVE** | Fetched from a live external source this run (BTC price, hashprice, USDC yield). |
| **STALE** | A live fetch failed; a conservative fallback was substituted (flagged). |
| **UNKNOWN** | No value and no source. |

**Currently CONFIGURED (require validation before investor-facing use):** 15%
machine markup · 20% revenue-share · $0.06/kWh energy · 6% borrow APR · BTC
scenario band (−20 / +40 / +120) · fee model (per-class vs collapsed 2%) · all
allocation bands, distribution and total-performance targets.

**Rule:** the app **must not** display any CONFIGURED value as validated or
contractual. Investor-facing surfaces show a warning strip: *"Targets are not
guarantees. Configured assumptions require admin validation before investor-facing
use."*

---

## 23. Open questions

1. **Monthly-vs-total target — final numbers.** Lock the canonical pairing and how ranges are published so they never read as double-counted.
2. **Share-class structure + canonical fee.** ADR-008 (A 100/1000, B 75/800 bps) vs collapsed `feePct = 2%`. Pick one fee representation.
3. **Recovery mode default + scope.** Confirm Mode A default, B/C election conditions, 6–12mo bound. No code state machine yet.
4. **Who validates CONFIGURED levers.** Assign owner + validation path before any are shown live/contractual.
5. **BTC scenario band width.** Decide whether to narrow the displayed band or cap the headline width.
6. **Mining-floor vs coded mixes.** 30% floor matches balanced/opportunistic (35%) but not coded defensive (25%); R1/R2 can drive mining below 30% — re-scope as governance exceptions; resolve allocator's all-USDC degenerate case vs floor enforcement.
7. **Sleeve vocabulary.** State explicitly that 40–55% BTC = core + tactical combined.
8. **Custody / borrow venue.** Confirm BTC custody + USDC borrow venue (the 0.825 liquidation the de-lever ladder is calibrated against).
9. **Machine resale / redeploy assumptions.** Define residual-value + cooling/fleet-mix; no residual-value model in code yet.

---

## Final judgment

- **Best product form:** mining-first, BTC-cycle-aware performance vault with a coverage-gated monthly distribution + an inclusive total-performance target, early closure, and a capital-first recovery extension.
- **Target duration:** 24 months (tranche exits 12 / 18 / 24; early closure on target hit).
- **Monthly distribution:** 8–12% annualized, coverage-gated, net of mgmt fee + borrow drag, before perf fee.
- **Total target:** 20–24% over ~24 months, inclusive of distributions (never additive).
- **Minimum mining:** 30% structural floor (band 30–40%); sub-floor only under governance.
- **BTC holding:** 40–55% (core + tactical combined).
- **Recovery extension:** 6–12 months, Mode A (capital-only) default.
- **First MVP:** single tranche, single class (Class A defaults), single Balanced regime with a hard 30% mining-floor post-filter, Mode A recovery, simple stepped exit, distribution + total shown as ranges; reuse the existing Telegram/allocator/rebalancing/vault-APY/Monte-Carlo core, build only the stable-funding decision, exit/recovery state machine, and operator-spread accounting.
