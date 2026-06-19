# UI Data Coverage Map

> Generated 2026-06-19. Read-only reference — maps every page/widget to its real data source,
> placeholder strategy, empty state, and next action. Update when wiring changes.

## Legend

| Column | Meaning |
|---|---|
| Source | Server loader / API route / server action that feeds this surface |
| Auth | Who can see this |
| Placeholder | What shows while data is loading |
| Empty state | What shows when source returns zero rows |
| Error state | What shows on fetch/DB failure |
| Demo fallback | Mock builder used when `canRunDemoProvider()` or `isDemoInvestor()` |
| Status | `LIVE` = real data wired · `DEMO` = mock only · `PARTIAL` = mixed · `UNKNOWN` |
| Next action | What still needs to be done |

---

## PRODUCT — Investor surfaces

| Page / Widget | Data needed | Source | Auth | Placeholder | Empty state | Error state | Demo fallback | Status | Next action |
|---|---|---|---|---|---|---|---|---|---|
| `/portfolio` hub | Positions, NAV, yield YTD, next distribution | `loadPortfolioView()` → Prisma | Investor | Skeleton (force-dynamic) | `previewZeros` mode (ghost chart, no CTA) | Graceful empty / stale badge | `buildDemoPortfolio()` (demo identity) | LIVE | Plug yield aggregator upstream when available |
| `/portfolio/positions` | Positions list | `loadPortfolioView()` → Prisma | Investor | Skeleton | Empty positions list | Stale badge | Same | LIVE | — |
| `/portfolio/yield` | Yield stack by bucket | `loadYieldStackProps()` → Prisma | Investor | Skeleton | Zero-value donut | Stale badge | Same | LIVE | — |
| `/portfolio/distributions` | Distribution calendar entries | `loadDistribCalendarProps()` → Prisma | Investor | Skeleton | "No distributions yet" | Stale badge | Same | LIVE | — |
| `/portfolio/activity` | InvestorTransactions | `loadPortfolioView()` → Prisma | Investor | Skeleton | Empty activity log | Stale badge | Same | LIVE | — |
| Lock Meter widget | First active position lockup dates | `loadLockMeterProps()` → Prisma | Investor | Skeleton | N/A (hidden if no position) | Stale badge | Demo lockup dates | LIVE | — |
| Risk Pulse widget | Risk scores by dimension | `loadRiskPulseProps()` → Prisma (1h cache) | Investor | Skeleton | Zero scores | Stale badge | Demo risk scores | LIVE | — |
| Proof Pulse widget | Recent attestations | `loadProofPulseProps()` → Prisma | Investor | Skeleton | "No attestations" | Stale badge | Demo proofs | LIVE | — |
| Time-to-Cash widget | Soft lock expiry + pending distributions | `loadTimeToCashProps()` → Prisma | Investor | Skeleton | Zero waterfall | Stale badge | Demo waterfall | LIVE | — |
| PDF Statement | Full position P&L | `GET /api/statements/[id]/pdf` → Prisma | Investor (owner) | N/A (download only) | 404 if investor not found | 500 logged | N/A | LIVE | — |
| `/vaults` | Live vault list | `listVaults()` → Prisma | Investor | Skeleton | "No vaults available" | Graceful empty | `buildDemoVaults()` | LIVE | — |
| `/vaults/[id]` | Vault detail / term sheet | `getVault(id)` → Prisma | Investor | Skeleton | `notFound()` | `notFound()` | `buildDemoVaultDetail(id)` | LIVE | Legal doc PDF generation |
| `/vaults/[id]/invest` | Vault detail + capacity | `getVault(id)` + `subscribe()` | Investor (KYC approved + attested) | Form disabled | N/A | Form error | Demo no-op sentinel | LIVE | — |
| `/proof-center` | On-chain events, attestations, custody, distributions, coverage | `fetchOnChainEvents()`, `fetchOnChainAttestations()`, `loadCustody()`, `loadRecentDistributions()`, `loadCoverageForVault()` | Investor | Skeleton | `EmptySurface` per widget | Demo banner if empty | Demo banner only (on-chain stays real) | LIVE | IPFS proof URI pinning |
| `/proof-center/full` | 100 on-chain events, 12 attestations, proofs, custody, timelocks | Multi-loaders + `getProofs()` | Investor | Skeleton | Empty tables | EmptySurface | `buildDemoProofs()` | LIVE | Timelock countdown UI completion |

---

## ADMIN — Operator surfaces

| Page / Widget | Data needed | Source | Auth | Placeholder | Empty state | Error state | Demo fallback | Status | Next action |
|---|---|---|---|---|---|---|---|---|---|
| `/admin/dashboard` | Vault KPIs, mining metrics, BTC price, distributions, risk | `loadDashboardData()` → Prisma + ext APIs (CoinGecko, Mempool.space) | Admin | Skeleton / revalidate 30s | Zero-value KPIs with "No data" label | Stale badge | `buildDemoDashboardData()` | PARTIAL | Ensure `mining-health-daily` Inngest cron has run ≥1x to populate MiningMetric |
| Admin cockpit payload | Action queue, live metrics, ops | `loadCockpitPayload()` → Prisma | Admin | Skeleton | Empty queue | Stale badge | `buildDemoCockpitPayload()` | PARTIAL | Same as above |
| Admin overview KPIs | TVL, investors, distributions | `loadAdminOverview()` → Prisma | Admin | Skeleton | Zero values | Stale badge | `buildDemoAdminOverview()` | LIVE | — |
| `/admin/vaults` | All vault deployments | Prisma `vaultDeployment.findMany()` | Admin | Skeleton | "No vaults yet" | Graceful empty | None | LIVE | — |
| `/admin/vaults/[id]` | Vault detail + approvals + positions | Prisma `vaultDeployment.findFirst()` | Admin | Skeleton | `notFound()` | `notFound()` | None | LIVE | — |
| `/admin/vaults/new` | Wizard draft + clone source | `loadWizardDraft()` + optional `getVault()` | Admin | Draft resume banner | Empty wizard | Error toast | None | LIVE | — |
| `/admin/proof-center` | Same as investor proof center | Multi-loaders + `resolveAdminDemoMode()` | Admin | Skeleton | EmptySurface | EmptySurface | Demo mode toggle available | LIVE | — |
| `/admin/proof-center/full` | 100 events, attestations, proofs, timelocks | Multi-loaders | Admin | Skeleton | Empty tables | EmptySurface | None | LIVE | — |
| `/admin/proofs` | Off-chain proof list | `getProofs()` → Prisma | Admin | Skeleton | "No proofs yet" | Graceful empty | `buildDemoProofRows()` | LIVE | — |
| `/admin/customers` | Paginated investor list + KYC + principal | `loadCustomers()` → Prisma | Admin | Skeleton | "No customers yet" | Graceful empty | None | LIVE | — |
| `/admin/customers/[id]` | Investor profile + positions + agent memory + KYC | `loadCustomerDetail()` → Prisma | Admin | Skeleton | `notFound()` | `notFound()` | None | LIVE | — |
| `/admin/governance` | Proposal queue | `loadProposalQueue()` → Prisma | Admin | Skeleton | "No proposals" | Graceful empty | `buildDemoGovernanceQueue()` | LIVE | Tenderly simulation (stub → live) |
| `/admin/governance/allowlist` | Allowlist entries | `getActiveAllowlistEntries()` → Prisma | Admin | Skeleton | "No entries" | Graceful empty | None | LIVE | — |
| `/admin/audit` | Admin audit log | `getAdminAuditLog()` → Prisma | Admin | Skeleton | "No events yet" | Graceful empty | None | LIVE | — |
| `/admin/monitoring` | LLM run stats | `getMonitoringStats()` → Prisma | Admin | Skeleton | Zero stats | Graceful empty | None | LIVE | — |
| `/admin/distributions` | Distribution list | Prisma `distribution.findMany()` | Admin | Skeleton | "No distributions" | Graceful empty | `buildDemoDistributions()` | LIVE | — |
| `/admin/signals` | Rebalance events | Prisma `rebalanceEvent.findMany()` | Admin | Skeleton | "No signals" | Graceful empty | None | LIVE | — |
| `/admin/outreach` | Prospects + campaigns | `loadProspects()`, `loadCampaigns()` → Prisma | Admin | Skeleton | Empty lists | Graceful empty | None | LIVE | — |
| `/admin/feedback` | Feedback list | Prisma `feedback.findMany()` | Admin | Skeleton | "No feedback" | Graceful empty | None | LIVE | — |
| `/admin/scenario-lab` | Scenario runs | `runScenarioAction()` → engine + Prisma | Admin | Form idle | No prior runs shown | Error toast | None | LIVE | Monte Carlo (feature flag `ENABLE_MONTE_CARLO`) |
| `/admin/agents` | Agent graph topology | `GET /api/admin/agents/graph` → Prisma (LlmRun) | Admin | Skeleton canvas | Empty graph | "Graph unavailable" | None | LIVE | — |
| `/admin/investor-memo` | Vault data for memo generation | `generateMemoAction()` → `loadMemoInput()` | Admin | Loading spinner | N/A (generate on demand) | Error toast | None | LIVE | — |

---

## GLOBAL FEATURES

| Feature | Source | Auth | Trigger | States | Demo fallback | Status | Next action |
|---|---|---|---|---|---|---|---|---|
| **Admin Search ⌘K** | `GET /api/search?q=` (10 entity types, fuzzy + direct-jump) | Admin only | `CommandPalette` — ⌘K shortcut or trigger button in admin layout | idle · loading · results · empty · error | None (admin-only, no demo) | **LIVE — wired 2026-06-19** | — |
| **Chat (Section 3)** | `POST /api/cockpit-chat` → OpenAI GPT-4.1 | Investor or Admin | Chat rail (Section 3) | loading · streaming · error · compliance-blocked | None | LIVE (shell mode default; Master Agent = `CHAT_MASTER_AGENT=1`) | Enable Master Agent flag for tool-capable mode |
| **Notifications bell** | Prisma `notification.findMany()` | Admin | Admin layout bell icon | unread count · panel open · mark-read | None | BUILT, NOT RENDERED — wire to admin layout | Render `NotificationsBell` in `AdminRailIntra` or admin header |
| **Shortcuts overlay** | Static shortcut list | Any | `?` key | open · close | None | BUILT, NOT RENDERED — wire shortcut key `?` in CommandPalette | Add `?` handler to CommandPalette to show shortcuts |
| **Saved views picker** | `loadUserViews()` → Prisma | Any | Table header | loading · empty · selected | None | BUILT, NOT RENDERED — wire to admin customer/vault tables | Render in appropriate admin tables |
| **Chart time selector** | Props-driven (no endpoint) | Any | Chart header | selected range | None | BUILT, NOT RENDERED — wire to dashboard charts | Render in admin dashboard value chart |

---

## KNOWN GAPS (priority order)

| Gap | Impact | Fix | Effort |
|---|---|---|---|
| `mining-health-daily` Inngest cron not run → empty MiningMetric table | Admin dashboard shows demo data even in production | Trigger cron manually once in prod, then it runs daily | Low (ops) |
| `NotificationsBell` not rendered | Admin has no notification awareness | Render in `AdminRailIntra` below existing rail items | Low |
| Shortcuts overlay not wired | `?` key does nothing | Add handler in `CommandPalette` or admin layout | Low |
| Yield aggregator upstream | Portfolio accrued yield not computed | Clarify source: engine vs external oracle | UNKNOWN |
| IPFS pinning service | Proof URIs stored as `#demo` or local | Add Pinata/NFT.storage integration to `ingestProof()` | Medium |
| Tenderly simulation | Governance `simulateProposal()` is a stub | Provision Tenderly account + replace stub | Medium |
| Legal doc PDF | Vault term sheet PDF not generated | Design PDF template with @react-pdf/renderer | Medium |

---

## MOCK / DEMO GUARD REFERENCE

| Guard | Scope | Builder called | Real loader |
|---|---|---|---|
| `isDemoInvestor(investor)` | Portfolio, Vault, Proof pages | `buildDemoPortfolio()`, `buildDemoVaults()`, etc. | `loadPortfolioView()`, `listVaults()`, etc. |
| `canRunDemoProvider()` | Admin pages | `buildDemoDashboardData()`, `buildDemoCustomers()`, etc. | `loadDashboardData()`, `loadCustomers()`, etc. |
| `databaseHasDemoProofs()` | Proof center banner | Demo banner shown | Real proofs from DB |
| `DEMO_PROVIDER_ENABLED` env | All guards above | Enabled when set; absent in prod | — |

**Rule:** Never show "Live" provenance badge on demo data. Demo builder outputs are stamped `"simulated"` by default.

---

## ENDPOINT CONTRACT QUICK-REF

| Endpoint | Auth | Response | Notes |
|---|---|---|---|
| `GET /api/search?q=` | Admin | `{ results[], query, directJump, directHref? }` | q ≤200 chars; 10 entity types; admin-only (PII) |
| `POST /api/cockpit-chat` | Investor | SSE stream text/plain | Rate 20/60s; compliance guard on output |
| `GET /api/statements/[id]/pdf` | Investor (owner) | Binary PDF | Rate 5/60s; owner-scoped |
| `GET /api/health` | Public | `{ status: "ok" }` | No DB |
| `GET /api/health/deep` | Public | `{ status, checks }` | DB + Redis |
| `GET /api/admin/agents/graph` | Admin | `{ graph }` | LlmRun topology |
| `GET/POST /api/admin/chat-tools` | Admin | Tool list / exec result | 30/60s rate limit |
