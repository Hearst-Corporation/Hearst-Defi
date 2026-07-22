# HashVault frontend realignment

Status: active frontend recomposition for **Hearst Bitcoin Reserve Vault — Series 1**.

## Frontend authority

- KYC components and page patterns are the frontend reference canon.
- Hearst-Defi uses its existing Catalyst primitives and does not create a parallel
  shell or design-system library.
- Navigation is sourced only from
  `src/components/nav/product-nav-items.ts`.
- Investor pages use the canonical Series 1 navigation and product wording.
- Existing Hearst charts and evidence modules are retained and integrated into
  the canonical shell/page grammar.
- Earth is Hearst; no separate Earth brand is allowed.

## Product boundary

Investor-facing copy covers BTC accumulation, delivery at maturity, B1 Mining
Power, B2 BTC Pouch, B3 Reserve USDC, acquisition cost, reserve runway, mining
state and proof evidence. APY, fixed yield, periodic distribution, borrowing,
LTV, liquidation, Morpho, collateral and leverage are excluded from the active
investor product framing.

## Runtime

- Frontend: `http://localhost:4105`
- Backend: `http://localhost:3900`

Detailed component mapping:
[`docs/frontend-kyc-reference-canon.md`](../../frontend-kyc-reference-canon.md).
