# Frontend KYC reference canon

## Reference

- Repository: `https://github.com/adrien-debug/Kyc`
- Audited commit: `565f9799ed0d68dcada857bdca798a4921111ae0`
- Local read-only checkout used for the audit: `/tmp/hearst-kyc-reference`
- Product adaptation: **Hearst Bitcoin Reserve Vault — Series 1**
- Brand rule: Earth is Hearst; no separate Earth brand exists.

The KYC repository is a read-only architectural reference. Hearst-Defi reuses its
page and navigation patterns through this repository's existing Catalyst layer;
it does not import, copy or vendor source files from the reference repository.

## Canonical KYC patterns

| KYC reference | Canonical pattern in Hearst-Defi |
|---|---|
| `components/ui/sidebar-layout.tsx` | Stable desktop sidebar, fluid main panel, dedicated mobile navigation |
| `components/dashboard/app-sidebar.tsx` | One navigation registry, exact/nested active states, role-aware destinations |
| `components/ui/sidebar.tsx` | Full-row links, 44px touch targets, visible labels, restrained active indicator |
| `components/ui/navbar.tsx` | Compact mobile topbar with account/context controls |
| `components/dossier/registry.tsx` | One page header grammar, compact section hierarchy, aligned metrics |
| `components/ui/surface.tsx` | Raised, inset and hero surfaces composed from shared primitives |
| `components/ui/table.tsx` | Responsive overflow wrapper, semantic table markup, clickable rows |
| `components/ui/fieldset.tsx` | Headless/Catalyst fields with labels, descriptions and error states |
| `components/dossier/empty-state.tsx` | Honest, bounded empty state; no fake live content |
| `app/(app)/layout.tsx` | Authentication gate at layout level; pages remain presentation-focused |
| `lib/navigation.ts` | Route labels and hierarchy defined once, then consumed by desktop/mobile chrome |

## Hearst-Defi implementation

- Shell: existing `src/components/ConnectShell.tsx` and local `cockpit-shell/`.
- Navigation registry: `src/components/nav/product-nav-items.ts`.
- Desktop/mobile navigation: `src/components/nav/product-rail-intra.tsx`.
- Page headers: `src/components/connect/product-page-header.tsx`.
- Page and surface primitives: `src/components/catalyst/bento.tsx`,
  `src/components/catalyst/card.tsx`, `src/components/catalyst/table.tsx`,
  `src/components/catalyst/empty-surface.tsx`.
- Auth gate: existing `src/app/(product)/layout.tsx`; auth/session behavior is not
  reimplemented by pages.

Investor navigation:

1. Overview
2. Bitcoin Reserve
3. Portfolio
4. Vaults
5. Proof Center
6. Mining
7. Documents & KYC

Admin navigation:

1. Admin
2. Data
3. Proofs
4. Operations
5. Settings

`Documents & KYC` resolves to `/profile`, the existing canonical account,
verification and document surface. No duplicate documents route is introduced.

## Preserved Hearst visual modules

The following modules remain product-owned and are composed inside the KYC page
grammar rather than replaced:

- `CapitalFlowRail`
- `BtcAccumulationCurve`
- `AllInCostVsSpot`
- `ReserveRunwayChart`
- `MiningActivityTimeline`
- `PocketAllocationVisual`
- `SmartContractStateCard`
- `DeliveryRailSelector`
- Proof Center evidence blocks
- Position summary and value trajectory
- Vault detail and investment flow

## Replacement map

- Narrow icon-only primary navigation → readable desktop rows plus mobile topbar
  and focus-trapped Catalyst navigation modal.
- Three-item investor rail → complete Series 1 route catalog.
- Legacy admin labels → five canonical operator groups.
- Page-specific ad hoc titles → `ProductPageHeader` where a route header is needed.
- HYV/yield-era visible labels → Series 1 product wording.
- Duplicate route lists → `product-nav-items.ts` only.

## Non-negotiable Series 1 copy

Investor surfaces describe BTC accumulation, delivery at maturity, B1 Mining
Power, B2 BTC Pouch, B3 Reserve USDC, all-in BTC acquisition cost, reserve runway,
mining state, custody and delivery evidence. They do not present APY, fixed yield,
periodic distributions, borrowing, LTV, liquidation, Morpho, collateral or
leverage as investor product features.

Every projection keeps its assumptions, provenance and “not guaranteed”
disclosure. Empty and preview states must never be presented as Live or Verified.

## Local runtime

- Frontend: `http://localhost:4105`
- Backend: `http://localhost:3900`
