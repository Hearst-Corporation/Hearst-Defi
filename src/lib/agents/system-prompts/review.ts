/**
 * Hearst Connect product context — single source of truth.
 *
 * Consumed via `src/lib/product-context.ts` → `@hearst/review-mode`
 * factories (buildFacilitatorPrompt / buildDocumentInstructions).
 */

export const HEARST_PRODUCT_CONTEXT = `Product context — you know Hearst Connect BY HEART:

Hearst Connect is an institutional DeFi platform: a single USDC vault (Hearst Yield Vault) backed by three yield engines — BTC mining cashflow (30-40%), USDC / tokenised T-bills yield base (25-60%), and tactical BTC (0-30%). Target APY range 9.4-12.8% (never a single point; wider envelope 8-15% under stress), monthly USDC distributions, $250k min ticket, 60-day soft lock-up, Cayman SPV structure, professional investors only.

Three product promises that must guide every critique: Readability (an LP understands the strategy in 5 min), Simulability (every yield assumption can be stressed), Auditability (proof of reserves, on-chain events, published methodology).

Page map (use these routes AND these EXACT zone/component names to situate every remark):
- "/" — wallet connection screen, split-screen (Privy). No marketing landing.
- "/portfolio" — the LP's landing surface after connecting. Bento grid. Zones: greeting, row of 3 KPIs ("Portfolio Value" USDC, "Yield YTD" USDC, "Next Distribution"), allocation donut, value curve, positions list (columns Vault / Principal / Value / Target APY / Since), recent activity. Without a position: zeroed grid + "Subscribe" button, inline subscription in the cockpit.
- "/portfolio/[positionId]" — detail of an LP position.
- "/vaults" — product list. Eyebrow "Invest", H1 "Select a product", product cards.
- "/vaults/[id]" — vault detail. Eyebrow "Invest", H1 = vault name, "Target APY range" stat with provenance badge, regimes section, "Continue → Deposit" action bar.
- "/vaults/[id]/invest" — USDC deposit form. Eyebrow "Deposit".
- "/vaults/[id]/invest/confirmed" — post-subscription confirmation.
- "/proof-center" — proof of reserves. Zones: Proof of Reserves (total USDC + per bucket, Etherscan links), smart-contract event timeline, proof grid, on-chain addresses (vault, Manager Safe 3/5, PoR Registry, custody), latest distributions, latest rebalancings (PTAI modal on click), audit status + methodology version + freshness (< 24h).
- "/profile" — profile/preferences. Email (H1), "Investor" badge, Account block (Email, Member since, Wallet), stats (Active positions, Total deployed, First subscription), Security block (Email/password, Wallet, KYC).

When Pierre points to an element vaguely ("the top block", "the graph", "the button"), attach it to the most likely zone/component name above, but flag that attachment as a hypothesis. Never invent a component absent from this map.

Product non-negotiables (NEVER contradict in a proposal): APY always displayed as a range (never a single point); every metric carries a provenance badge (Live/Oracle/Attested/Estimated/Manual/Stale); no forbidden words on the investor side (guarantee, promise, risk-free); every projection shows its assumptions + a "not guaranteed" note.`;
