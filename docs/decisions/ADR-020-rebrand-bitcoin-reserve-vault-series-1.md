# ADR-020 — Rebrand: "Hearst Yield Vault" (legacy) → "Hearst Bitcoin Reserve Vault — Series 1"

**Status**: Accepted
**Date**: 2026-07-18
**Deciders**: Founder (Adrien) + Eng
**Extends**: ADR-019 (product-model replacement — mining note). This ADR takes up the rebrand that
ADR-019 §99-101 explicitly **left to a product decision** and did not mandate.
**Does NOT touch**: the product model (ADR-019 / methodology v3.0), the engine-purity and
no-autonomous-write non-negotiables, or the mainnet audit gate (ADR-006). This is a **brand /
wording** change, not an architecture or model change.

## Context

The product model is the BTC-accumulation mining note (ADR-019). The legacy brand **"Hearst Yield
Vault" / "HYV"** carries a "Yield" name that no longer matches an accumulation instrument that makes
**no periodic cash distribution and carries no fixed APY**. ADR-019 §99-101 flagged this naming
tension and deferred it. The name **"Bitcoin Reserve Vault" / "Series 1"** did not exist anywhere in
the repo at decision time (`grep -i "reserve vault | series 1 | bitcoin reserve"` = 0 hits; the only
matches were "Reserve USDC", pocket B3, and `USDCReserveAdapter`).

## Decision

**Adopt the product name "Hearst Bitcoin Reserve Vault — Series 1"** for the shipped mining note.

1. **Scope = wordmarks only.** The rename touches display strings, labels, tickers, titles,
   glossary, memo cover/disclaimer wordmarks. **No logic, calculation, allocation, or on-chain
   identifier changes.**
2. **The on-chain contract keeps its name `PermissionedDynaVault`.** The rebrand is
   product/marketing-facing. Any change to `VAULT_DEPLOYMENT_ID` (`hearst-yield-vault`) or vault
   keys is a **data migration**, sequenced with the data lot — not done as a blind string swap.
3. **"Series 1"** signals a product series: this is the first issuance. It carries **strictly**:
   no borrow, no LTV, no liquidation, no periodic cash distribution, no fixed APY (see ADR-019 +
   the Option-B product-separation decision recorded in the orchestration pack
   `docs/orchestration/HASHVAULT-RESERVE-VAULT-001/00-decisions-required.md`).
4. **Sequencing.** The rebrand runs **last** (orchestration Vague 3, mission M9), **after** the
   model has converged (engine, data, contract, cockpit, chat, proof, docs). Renaming a moving
   target is forbidden — the name is applied to a stabilized product.

## Explicitly preserved

- The product model, methodology v3.0, and all non-negotiables (#1 range, #2 provenance, #3 PTAI,
  #5 forbidden words, #6 engine purity, #10 assumptions/"not guaranteed", #11 no cross-project
  imports).
- Legacy wordmarks remain valid on **historical** artefacts (memos already generated keep their
  original branding + `methodology_version` — append-only, never retroactively rewritten).
- The mainnet deploy stays gated on the Spearbit audit (ADR-006).

## Consequences

- Mission **M9** propagates the name across legacy wordmarks: PDF `cover.tsx` / `disclaimer.tsx`,
  glossary, cockpit vault labels, engine `vaults.ts` label/ticker, data `vaults.ts`. Each string
  change ships with its matching test-string update in the same diff.
- The legacy leverage product ("BTC Mining Performance Vault") is a **distinct product** and is
  **not** rebranded to Series 1 — Series 1 is the no-leverage accumulation note only.
- "Reserve USDC" (pocket B3) and `USDCReserveAdapter` are **not** the product name and must not be
  conflated or renamed.

## Alternatives considered

- **Keep "Hearst Yield Vault".** Rejected: "Yield" is actively misleading for a no-distribution,
  no-APY accumulation note — a compliance and clarity liability on opposable documents.
- **Rebrand now, before model convergence.** Rejected: renaming a product still being pivoted
  churns strings and tests against a moving target; the name is applied last, to a stable product.
- **Rename the on-chain contract too.** Rejected here: on-chain identity change is a data migration,
  out of scope for a wordmark ADR; sequenced separately if ever needed.

## References

- [ADR-019](./ADR-019-product-model-mining-note.md) — product-model replacement (defers the rebrand).
- [methodology v3.0](../methodology/v3.0.md) — the mining note methodology.
- [orchestration pack](../orchestration/HASHVAULT-RESERVE-VAULT-001/) — Option-B product separation,
  mission M9 sequencing.
