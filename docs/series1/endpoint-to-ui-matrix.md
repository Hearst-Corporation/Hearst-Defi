# Series 1 — Endpoint → UI Matrix

Status 2026-07-23. Companion to `investor-ui-map.md`. Two endpoint families:
**(A)** backend DTO reads consumed via `src/lib/backend/server-client.ts`
(the real data behind investor instruments), and **(B)** Next.js API routes
under `src/app/api/**` (mostly plumbing, webhooks, admin — **almost none are
investor destinations**).

Rule: **never map endpoint = page.** UI-exposure vocabulary:
`B2B visible | B2B derived only | admin only | internal plumbing | webhook only |
diagnostic only | do not expose | not ready`.

---

## A. Backend DTO reads (`server-client.ts`) — the investor data plane

| Function (endpoint) | Data returned | Audience | UI use | Derived visual | Do-not-expose reason |
|---------------------|---------------|----------|--------|----------------|----------------------|
| `getDashboardFromBackend` | `DashboardDTO` aggregate | B2B visible | Dashboard hero + tiles | composite of the below | — |
| `getVaultFromBackend` | `VaultDTO` (totalAssets, minimumDepositAtomic, cap) | B2B visible | Vaults, Subscription Ladder | ladder, reserve arc | — |
| `getVaultStrategiesFromBackend` | `VaultStrategy[]` (actualBps, driftBps) | B2B visible | Allocation Cockpit | B1/B2/B3 band + drift ring | — |
| `getProductFactsheetFromBackend` | `FactsheetTerms`, `FactsheetAllocation` (targetBps, term) | B2B visible | Constitution, Allocation, Reserve | policy diagram, target line | — |
| `getBtcFromBackend` | `BtcDTO` (btcProduced.totalSats, production.monthly[]) | B2B derived only | Reserve Progress | progress arc | monthly series **not ready** (no indexer decode) |
| `getSeries1EventsFromBackend` | `Series1EventSummary[]` (chainId, txHash, block, indexedAt) | B2B visible | Proof Rail | event stepper, provenance strip | — |
| `getProfileFromBackend` | `ProfileDTO` (identity, KYC, wallet state) | B2B visible | Profile | status chips | full internal email → admin only |
| `getMiningFromBackend` | `MiningDTO` telemetry | admin only | (Mining band, gated) | economics tiles | **not ready** — stale cron since 2026-07-07 |
| `getMiningElectricityFromBackend` | `MiningElectricityDTO` (monthlyCost) | B2B derived only | Reserve coverage | coverage months | raw telemetry admin only; monthly cost OK |
| `getMiningOnchainFromBackend` | `MiningOnchainDTO` | admin only | — | — | not investor-grade yet |
| `getRebalancingStatusFromBackend` | `RebalancingStatusDTO \| null` | admin only | — | — | operational internal |
| `getStrategyFromBackend(index)` | `StrategyDetailDTO` | B2B derived only | Allocation drill | per-pocket detail | — |
| `getRwaVaultFromBackend` | `RwaVaultDTO` | admin only | — | — | not part of Series 1 investor surface |
| `getBacktestHistoricalFromBackend` | `BacktestHistoricalDTO` | do not expose | — | — | backtest ≠ proof; never investor-facing as fact |

## B. Next.js API routes (`src/app/api/**`) — plumbing, not navigation

| Route | UI exposure | Reason |
|-------|-------------|--------|
| `health`, `health/deep` | diagnostic only | liveness probes |
| `inngest` | internal plumbing | job runtime |
| `sumsub/webhook`, `docusign/webhook`, `hubspot/webhook`, `resend/webhook`, `typeform/webhook` | webhook only | inbound provider callbacks — **never a page** |
| `outreach/inbound`, `outreach/unsubscribe` | webhook only | email plumbing |
| `auth/dev-login`, `auth/logout` | internal plumbing | auth callbacks |
| `admin/**` (chat-tools, diagnostics/*, review-*, product-construction/stream) | admin only / diagnostic only | admin console + dev harness |
| `agent-canvas/[canvasId]`, `chat-nav`, `cockpit-chat`, `cockpit-chats*` | B2B derived only | power the in-app assistant, not standalone destinations |
| `search` | B2B derived only | powers the top-bar search box, not a page |
| `dashboard` | B2B derived only | server route feeding the Dashboard page (not a separate nav item) |
| `btc-deposit/initiate`, `btc-deposit/complete` | B2B derived only | deposit flow actions inside Vaults, not a page |
| `document-vault/**` | admin only | document management console |
| `mining/metrics`, `mining/metrics/report`, `mining/electricity/pay` | admin only | mining ops — investor sees only *derived* economics when real |
| `rebalancing/execute` | do not expose | privileged mutation — admin/keeper only |

---

## C. The webhook/plumbing firewall (MISSION B rule)

These must **never** become navigation, never surface as investor pages, never
be linked from the shell:
`sumsub · docusign · hubspot · resend · typeform · inngest · outreach/* ·
health* · auth/* · admin/* · document-vault/* · rebalancing/execute`.

They are inbound callbacks, job runtime, provider integrations, and privileged
mutations. Their existence is correct; their exposure as UI would be a leak of
technical structure the investor has no reason to see.
