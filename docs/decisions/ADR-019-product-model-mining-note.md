# ADR-019 — Product model replacement: monthly-distribution yield vault → BTC mining note (PermissionedDynaVault v2.1)

**Status**: Accepted
**Date**: 2026-07-15
**Deciders**: Founder (Adrien) + Eng
**Supersedes / amends** (append-only — the referenced ADRs are not rewritten):
- **Supersedes ADR-010** (`HearstYieldVault` ERC-4626 testnet contract) as the product's
  underlying contract — replaced by `PermissionedDynaVault v2.1`.
- **Amends the product-model portion of ADR-006** — the guardrails it set stay in force; the
  yield-distribution product definition is replaced by the mining note.
- **Amends ADR-003** — mining exposure via revenue-share stays; the "distributed in USDC
  monthly" settlement to LPs is removed.
- **Amends ADR-008** — the on-chain lock-up claim and per-class monthly-distribution amounts no
  longer apply; lock-up becomes applicative.
- **Does NOT touch ADR-011** (OpenAI GPT-4.1 LLM provider) — unrelated to the product model.

## Context

The platform's public and opposable documents describe a product that will no longer exist. The
underlying contract changes from **`HearstYieldVault`** (ERC-4626; "mining-backed structured
yield, monthly USDC distributions, target APY 8–15%"; ADR-010) to **`PermissionedDynaVault
v2.1`** — a **BTC-accumulation mining note**.

Several of these claims are **opposable** (the investor-memo PDF, the README pitch, the product
specs) and several were already untrue before v2: v2 exposes **no distribution function**
(`Distribution` / `DistributionLedgerEntry` / `Pcap` had zero rows; execution was `0xMOCK_`),
and the demo AUM overstated the real on-chain balance. The full mapping is in
[`docs/UI_V2_GAP_REPORT_2026-07-15.md`](../UI_V2_GAP_REPORT_2026-07-15.md),
[`docs/CONTRACT_REPLACEMENT_CARTOGRAPHY_2026-07-15.md`](../CONTRACT_REPLACEMENT_CARTOGRAPHY_2026-07-15.md),
and [`docs/DYNAVAULT_V2_WIRING.md`](../DYNAVAULT_V2_WIRING.md).

The contract adapter (`src/lib/chain/dynavault.ts`) is written; the contract itself is **not yet
deployed** (Base Sepolia; mainnet remains gated on the Spearbit audit per ADR-006). Aligning the
documents is possible **now** and does not wait on deployment.

## Decision

**Replace the product model with the mining note.** Concretely:

1. **Nature** — a BTC-accumulation mining note backed by real Bitcoin mining, running on
   `PermissionedDynaVault v2.1` (**not** an ERC-4626 — the `Deposit` / `Redeem` event
   signatures and the read surface diverge from the standard). Asset is **USDC** (the spec's
   "USDT" is a typo; USDC is canonical).
2. **Structure** — **3 on-chain pockets, fixed allocation**: B1 Mining Power **40%**,
   B2 BTC Pouch **27%**, B3 Reserve USDC **33%** (bps 4000 / 2700 / 3300).
3. **Return** — the note **accumulates BTC over a 24-month term** with **rule-based take-profit**
   and **delivers BTC at maturity**. **No periodic cash distribution. No fixed APY.** Estimated
   return stays a **range** (non-negotiable #1), relabelled as **accumulated BTC — not
   distributed, not guaranteed**, `Estimated` provenance.
4. **Mechanisms** — curtailment (`isCurtailed` / `curtail` / `setCurtailmentThresholds` /
   `setHalvingMonth`), vending curve (`vendingCurveBps` over `productDurationMonths`),
   take-profit (`setTakeProfitTier` / `executeTakeProfit`), electricity account
   (`payElectricity` / `elecStatus`). Parameters are configured contract values, never promised
   performance.
5. **Terms** — the **$250k minimum ticket** and the **60-day soft lock-up** are **contractual /
   applicative**, **not enforced on-chain**. The on-chain gates are `tvlCap` + `whitelist`.
6. **Access** — KYC approval flows into the **on-chain whitelist** (`addToWhitelist` /
   `removeFromWhitelist`) as a **human-in-the-loop** write.
7. **Methodology** — a new [`docs/methodology/v3.0.md`](../methodology/v3.0.md) is published for
   this product (MAJOR bump: the model is non-comparable with the distributed-yield v1.0/v2.0).
   v1.0 and v2.0 stay immutable and on-file; the unratified v2.1-draft is not built upon.

## Explicitly preserved

- Non-negotiables **#1 (return as range), #2 (provenance), #3 (PTAI), #5 (forbidden words),
  #6 (engine purity), #10 (assumptions + "not guaranteed"), #11 (no cross-project imports)**.
- The **mainnet deploy stays gated** on the completed Spearbit audit + remediation (ADR-006).
  This ADR changes the product model, not the audit gate.
- **No financial or custodial action from the chat**, ever (ADR-012 / ADR-017 / ADR-018).

## Keeper-signing arbitration (resolving the tension flagged in DYNAVAULT_V2_WIRING §6)

The v2 note introduces privileged monthly operations that move value (`rebalance()`,
`payElectricity()`, `reportMiningMetrics()`). ADR-018's red line states that agents/crews
**prepare, simulate, verify and draft — humans sign**. These two facts are reconciled as
follows, and this is the position of record:

- The keeper is a **deterministic operational signer**, **not** a crew and **not** an agent. It
  is **never** exposed to the chat, the LLM, or the agent/crew layer — so ADR-018's red line is
  **preserved**, not breached.
- The keeper is **kill-switched OFF by default** (`KEEPER_ENABLED` ≠ `1` → refusal before any
  chain access), its key (`KEEPER_PRIVATE_KEY`) is **server-only**, and every keeper route is
  `requireAdmin` + Zod-validated + rate-limited, fail-closed.
- Any move to a **fully autonomous** keeper (unattended signing on a schedule) is **out of scope
  here** and requires a **dedicated SC / ops ADR**; until then the keeper stays gated as above.

## Consequences

- **The distribution layer is retired**: `Distribution` / `DistributionLedgerEntry` / `Pcap`,
  the monthly distribution cron, "next distribution" / `.ics` calendar, and payout copy all die.
- **Documents realigned (this lot)**: README pitch, `docs/spec/00-vision`, `04-investor-memo`,
  `05-mining-model`, `07-rebalancing-rules`, and methodology v3.0 now describe the mining note.
  The investor-memo **PDF** pages and the runtime source strings (`src/lib/engine/vaults.ts`,
  `src/lib/pdf/memo-pages/*`, product/strategies config) are aligned by the engine/UI lots.
- **APY → BTC accumulation** relabel across UI; **allocations → 40/27/33**; **lock-up / min
  ticket → applicative**; tax treatment shifts from interest income to capital gain.
- **New on-chain reads to add** (adapters exist or are to be written against the ABI): vending
  curve, curtailment, take-profit history, `tvlCap`, `whitelist`, keeper status — live at deploy.
- **Naming tension**: the legacy brand "Hearst Yield Vault" carries a "Yield" name that no
  longer matches an accumulation note. A brand rename is **out of scope** here and is left to a
  product decision; this ADR does not mandate one.

## Alternatives considered

- **Keep the distribution model.** Rejected: the v2 contract exposes no distribution function;
  continuing to assert monthly USDC distributions in opposable documents would be false.
- **Relabel wording only, no methodology bump.** Rejected: the model is non-comparable with the
  distributed-yield methodology; a MAJOR methodology version + an ADR are required for an
  opposable, auditable record.
- **Overwrite `methodology/v2.0.md` in place.** Rejected: v2.0 is a published, immutable
  methodology (Monte Carlo, ADR-006) referenced elsewhere; overwriting it would destroy an
  opposable record. v3.0 is the correct forward version.

## References

- [`docs/methodology/v3.0.md`](../methodology/v3.0.md)
- [`docs/DYNAVAULT_V2_WIRING.md`](../DYNAVAULT_V2_WIRING.md)
- [`docs/CONTRACT_REPLACEMENT_CARTOGRAPHY_2026-07-15.md`](../CONTRACT_REPLACEMENT_CARTOGRAPHY_2026-07-15.md)
- [`docs/UI_V2_GAP_REPORT_2026-07-15.md`](../UI_V2_GAP_REPORT_2026-07-15.md)
