# Workstream A — Sidebar / Menu IA  ·  STATUS: ✅ executed in PROMPT #072

## Scope
Investor rail becomes **Portfolio · Vault · Invest · Profile**; "Proofs" removed as a standalone.

## Delivered
- `src/components/nav/product-nav-items.ts` — `PRODUCT_NAV` = Portfolio (`/portfolio`, PieChart) ·
  Vault (`/my-vaults`, Vault) · Invest (`/vaults`, TrendingUp) · Profile (`/profile`, User).
  `proof-center` entry dropped.
- `src/components/nav/product-rail-intra.tsx` — added `PieChart` + `User` to the icon map.
- `src/app/(product)/my-vaults/page.tsx` — held-vaults index (real `loadPortfolio` data,
  row-clickable → `/portfolio/[positionId]`, honest empty state via `EmptySurface`, green
  "Invest in a vault" CTA).

## DS primitives used
`Table`, `EmptySurface`, `cockpitButtonVariants`. Token-only.

## Not done (deliberate)
- LLM nav whitelist (`src/lib/llm/*`) left untouched — `/proof-center` stays reachable there;
  `/my-vaults` is not yet chat-navigable (avoids the nav-corpus test minefield).
- Vault Details lives at `/portfolio/[positionId]`; being there lights the Portfolio rail entry.

## Validations
`product-nav-items.test.ts`, `product-rail-intra.test.tsx` (updated), `product-routes.test.ts`
(`/my-vaults` registered), typecheck.
