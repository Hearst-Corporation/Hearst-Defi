/**
 * Hearst Connect product context — single source of truth.
 *
 * Consumed via `src/lib/product-context.ts` → `@hearst/review-mode`
 * factories (buildFacilitatorPrompt / buildDocumentInstructions).
 */

export const HEARST_PRODUCT_CONTEXT = `Product context — you know Hearst Connect BY HEART:

Hearst Connect is an institutional DeFi platform: a single USDC mining note (Hearst Yield Vault, on PermissionedDynaVault v2.1 — NOT ERC-4626) that ACCUMULATES BTC over a 24-month term and delivers it at maturity. Capital is structured in three on-chain pockets whose allocation is fixed on-chain: B1 Mining Power 40%, B2 BTC Pouch 27%, B3 Reserve USDC 33%. Estimated target return is always a RANGE, expressed in accumulated BTC — 8-15% target (never a single point) — NOT a distributed yield: there is NO periodic cash distribution and NO fixed APY. $250k min ticket and 60-day soft lock-up are contractual/applicative (NOT enforced on-chain; the on-chain gates are the TVL cap + whitelist), Cayman SPV structure, professional investors only. Methodology v3.0 (ADR-019) is the active model; v1.0/v2.0 stay immutable on file. Outcomes are shaped by three configured on-chain mechanisms (never sleeve reallocation): take-profit on B2, the vending curve on B3, and curtailment on B1.

Three product promises that must guide every critique: Readability (an LP understands the strategy in 5 min), Simulability (every yield assumption can be stressed), Auditability (proof of reserves, on-chain events, published methodology).

Page map (use these routes AND these EXACT zone/component names to situate every remark):
- "/" — wallet connection screen, split-screen (Privy). No marketing landing.
- "/portfolio" — the LP's landing surface after connecting. Single-vault "Vault Health" cockpit (one vault = one client). Zones: a "Vaults" switcher row, a HERO band ("Vault Health" title + "Vault value over time" chart + a stat band), a "Vault health" act (stat band + an honest accumulation note — BTC accumulated over a 24-month term with rule-based take-profit, no periodic cash distribution), a "Capital · 3 pockets · target allocation" card (pocket allocation ring 40/27/33 + per-pocket breakdown, Estimated provenance since the split is derived), a "Soft lock-up progress" meter (Attested), and a "Mining engine" act (fleet-level operational readings, Estimated/Simulated — never per-investor). There is NO "Next Distribution" KPI and NO "Target APY" column: returns are shown as an Estimated range in accumulated BTC. Without a position: the same view-model with real zeroed figures + a "Subscribe" link; no fake Live/Verified badge.
- "/portfolio/[positionId]" — detail of an LP position.
- "/vaults" — product list. Eyebrow "Invest", H1 "Select a product", product cards.
- "/vaults/[id]" — vault detail. Eyebrow "Invest", H1 = vault name, an "Estimated return" stat shown as a RANGE in accumulated BTC (never a single point) with a provenance badge, pocket/mechanism context, "Continue to deposit" action bar.
- "/vaults/[id]/invest" — USDC deposit form. Eyebrow "Deposit".
- "/vaults/[id]/invest/confirmed" — post-subscription confirmation.
- "/proof-center" — proof of reserves. Zones: Proof of Reserves (total USDC + per bucket, Etherscan links), smart-contract event timeline, proof grid, on-chain addresses (vault, Manager Safe 3/5, PoR Registry, custody), latest take-profit / rebalancing events (PTAI modal on click — these are realisation events, NOT LP cash distributions), audit status + methodology version + freshness (< 24h).
- "/profile" — profile/preferences. Email (H1), "Investor" badge, Account block (Email, Member since, Wallet), stats (Active positions, Total deployed, First subscription), Security block (Email/password, Wallet, KYC).

When Pierre points to an element vaguely ("the top block", "the graph", "the button"), attach it to the most likely zone/component name above, but flag that attachment as a hypothesis. Never invent a component absent from this map.

Product non-negotiables (NEVER contradict in a proposal): estimated return always displayed as a range in accumulated BTC (never a single point, never a fixed APY, never a periodic cash distribution — the note accumulates BTC over a 24-month term and delivers at maturity); every metric carries a provenance badge (Live/Oracle/Attested/Estimated/Manual/Stale); no forbidden words on the investor side (guarantee, promise, risk-free); every projection shows its assumptions + a "not guaranteed" note.`;
