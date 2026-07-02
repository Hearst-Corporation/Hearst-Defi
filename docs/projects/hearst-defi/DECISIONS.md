# DECISIONS — Truth Audit Report

> Role: batch 2 / auditor  
> Date: 2026-07-02  
> Method: static code analysis (read-only — no code was modified)  
> Source refs: `src/`, `docs/UI_DATA_COVERAGE.md`, `docs/PROJECTION_SOURCE_TRUTH.md`

---

## Audit scope

Checked for:
- Hardcoded financial values (APY, prices, addresses) that should come from DB/env
- Mocked/demo data active in non-demo production code paths
- Stubbed or unimplemented functions in active hot paths
- Unconnected UI actions (empty onClick, disabled with no alternative)
- `Math.random()` / `Date.now()` in engine or agent code (purity violation)
- Forbidden output words: "guarantee", "promise", "certain", "will deliver", "risk-free"
- `console.log` in production code paths

---

## Findings

### HIGH — Must fix before next production deploy

---

#### H-001 · Hardcoded testnet contract address as go-live fallback

- **File:** `src/app/admin/vaults/actions.ts:543-545`
- **Code:**
  ```ts
  const defaultContractAddress =
    process.env.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS ||
    "0x2bd14d52518a04f4c12949c51df03a161a9e329e";
  ```
- **Risk:** If `NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS` is absent from the production environment (e.g. during a deploy with a missing secret), a vault goes live pointing to the Base Sepolia testnet address. Investors would interact with the wrong contract.
- **Context:** The guard `liveGate.canGoLive` is checked before this code; however the fallback itself is the risk — it silently succeeds with a testnet address instead of failing loudly.
- **Recommendation:** Remove the hardcoded fallback entirely. If the env var is missing, `throw new Error("NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS is required to go live")`. Alternatively add it to the Zod env schema in `src/lib/env.ts` as a required field (with `OPT` wrapper only for local dev contexts).
- **Effort:** Low (1-line fix + env.ts update)

---

### MEDIUM — Fix in next sprint

---

#### M-001 · Hardcoded APY defaults in PDF statement generation

- **File:** `src/app/api/statements/[id]/pdf/route.tsx:747-748`
- **Code:**
  ```ts
  const apyLowBps = p.vaultDeployment?.targetApyLowBps ?? 940;  // 9.40%
  const apyHighBps = p.vaultDeployment?.targetApyHighBps ?? 1280; // 12.80%
  ```
- **Risk:** If a position's `vaultDeployment` relation is null (e.g. soft-deleted vault, or orphaned position row), investor-facing PDF statements silently use hardcoded APY values. This is a provenance lie — the displayed 9.4–12.8% range has no DB source.
- **Context:** This is the PDF download path (`GET /api/statements/[id]/pdf`). Also: vault name and ticker have similar fallbacks (`"Hearst Yield Vault"`, `"HYV-A"`).
- **Recommendation:** Instead of numeric fallbacks, render a `"—"` or `"N/A"` for missing vault data and surface an `"Estimated"` provenance badge on the PDF. Or query the vault explicitly and return a 404 with a clear error if it's missing.
- **Effort:** Low-Medium

---

#### M-002 · Mining engine confidence formula is a simplified placeholder

- **File:** `src/lib/engine/mining.ts:50`
- **Comment:** `(Simplified placeholder; the full spec-05 formula folds in uptime_30d, attestation freshness and energy-cost stability once those feeds exist.)`
- **Risk:** The `operationalConfidence` metric used in risk scoring and dashboard KPIs does not implement the Methodology v1.0 formula. Investors and admins see a confidence value that doesn't match the published spec.
- **Context:** The field is displayed in the admin dashboard's mining section and in the Risk Pulse widget. No disclaimer is shown that the formula is approximate.
- **Recommendation:** Either implement the full spec-05 formula, or add a `"Estimated"` provenance badge to any metric derived from `operationalConfidence`, with a tooltip explaining the simplification. Update Methodology v1.0 if the simplification is intentional.
- **Effort:** Medium

---

#### M-003 · BTC tactical liquidity guardrail marked as MVP placeholder

- **File:** `src/lib/engine/btc-tactical.ts:145`
- **Code:** `detail: "MVP placeholder; on-chain depth feed wired in V1",`
- **Risk:** The `liquidityGuardrail` function returns a guardrail object with a placeholder detail string. Any admin UI or agent output that surfaces this guardrail's `detail` field shows "MVP placeholder" to users.
- **Context:** This detail text is surfaced in the admin governance proposal view at `src/app/admin/governance/proposal/[id]/page.tsx`.
- **Recommendation:** Replace placeholder detail string with a real description of the guardrail. Track the on-chain depth feed wiring as a separate ticket (V1 scope).
- **Effort:** Low

---

#### M-004 · Notifications bell unread count is hardcoded to 0

- **File:** `src/components/notifications/notifications-bell-wrapper.tsx:15`
- **Code:** `<NotificationsBell unreadCount={0} onClick={() => setOpen((v) => !v)} />`
- **Note in code:** `"Drawer placeholder — wired once notification persistence is added"`
- **Risk:** The admin notifications bell always shows 0 unread notifications. There are 50+ Prisma tables; the `Notification` table exists but is not queried here. Admins are unaware of real system notifications.
- **Context:** The `docs/UI_DATA_COVERAGE.md` (generated 2026-06-19) said "BUILT, NOT RENDERED". The bell IS now rendered in `admin/layout.tsx`, but with hardcoded state.
- **Recommendation:** Add a server action or loader to fetch unread notification count from `prisma.notification.findMany({ where: { read: false } })` and pass it as a prop to `NotificationsBellWrapper`. Wire the drawer to show real notifications.
- **Effort:** Low-Medium

---

#### M-005 · INNGEST_JOB_STUBS — all 4 Inngest jobs default to "unknown" status

- **File:** `src/lib/data/cockpit.ts:150-155`
- **Code:**
  ```ts
  const INNGEST_JOB_STUBS: InngestJob[] = [
    { id: "rebalance", name: "Rebalance signal", status: "unknown" },
    { id: "distrib", name: "Distribution", status: "unknown" },
    { id: "oracle", name: "Oracle sync", status: "unknown" },
    { id: "proof-sync", name: "Proof sync", status: "unknown" },
  ];
  ```
- **Risk:** The admin cockpit job health panel always shows "unknown" for Inngest jobs unless there's a recent LlmRun in the DB. In a production instance that hasn't had agent runs in the last 2 hours, every job shows "unknown" — indistinguishable from a real outage.
- **Context:** `inferInngestJobs()` uses LlmRun history as a proxy heuristic. The comment says "Replace with a real Inngest API call" when available.
- **Recommendation:** Add a tooltip or legend explaining "unknown = no LlmRun in last 2h, not necessarily an error." This is a provenance issue. Alternatively expose the Inngest webhook endpoint to update job status on completion.
- **Effort:** Low (UX fix) / Medium (webhook wiring)

---

#### M-006 · `lp.redemption` and `memo.publish` cockpit actions are permanently missing

- **File:** `src/lib/data/cockpit.ts:405-406`
- **Code:**
  ```ts
  // ── TODO: lp.redemption — no Redemption model exists yet (out of scope) ──
  // ── TODO: memo.publish  — no clear "ready to publish" data source yet    ──
  ```
- **Risk:** The cockpit `ActionQueueItem` type includes `"lp.redemption"` and `"memo.publish"` as valid action types (they appear in `action-queue.tsx` label map as "Review redemption" and "Publish memo") but the data loader never emits them. Admins can configure expectations around these buttons that will never appear.
- **Recommendation:** Either remove these types from the TypeScript union and UI label map, or add a data source and implement the loaders. Document the out-of-scope status in an ADR if they're intentionally deferred.
- **Effort:** Low (remove types) / High (implement)

---

#### M-007 · `Math.random()` used in production rate-limit and swarm ID generation

- **Files:**
  - `src/lib/rate-limit.ts:137` — member uniqueness key in Redis sorted set
  - `src/lib/agents/swarms/outreach-swarm-orchestrator.ts:155` — swarm run ID
  - `src/proxy.ts:57` — request ID fallback (secondary issue)
- **Risk:** Non-deterministic IDs in outreach swarm runs make deduplication, replay, and audit difficult. The rate-limit usage is intentional (collision prevention) but violates the global purity rule.
- **Recommendation:**
  - `rate-limit.ts`: Acceptable pragmatic use — add a comment noting the intentional non-determinism for collision avoidance.
  - `outreach-swarm-orchestrator.ts`: Pass an injected `runId` from the caller (Inngest job context provides a deterministic event ID). Remove internal `Math.random()`.
  - `proxy.ts`: Acceptable fallback — crypto.randomUUID is available in all supported runtimes.
- **Effort:** Low (proxy, rate-limit comments) / Medium (swarm refactor)

---

#### M-008 · Hardcoded BTC price fallback of $60,000 in Strategy Workspace

- **File:** `src/app/admin/strategies/[slug]/page.tsx:40`
- **Code:**
  ```ts
  let btcPriceUsd = 60_000;
  let btcPriceProvenance = "stale";
  ```
- **Risk:** If `fetchBtcPrice()` fails (network outage, API limit), the admin Strategy Workspace silently shows projection outputs computed from a $60,000 BTC price. The `btcPriceProvenance = "stale"` is properly set, so a badge should appear — but verify the badge is rendered on every metric that uses this value.
- **Context:** The $60,000 value may be significantly wrong in a live market. It was last a plausible estimate in mid-2024; BTC has since moved materially.
- **Recommendation:** Update the fallback to source from the latest `MiningMetric.btcPriceUsd` in the DB (last known good price), rather than a hardcoded constant. The "stale" badge is correct UX but the value should be the last DB-read price, not a constant.
- **Effort:** Low-Medium

---

### LOW — Track and fix opportunistically

---

#### L-001 · Shortcuts overlay (`?` key) not wired to CommandPalette

- **Status in `UI_DATA_COVERAGE.md`:** "BUILT, NOT RENDERED — wire shortcut key `?` in CommandPalette"
- **File:** `src/components/power/command-palette.tsx` — `useCommandPaletteShortcut` only handles `Cmd+K`
- **Impact:** `?` key does nothing in admin. The `ShortcutsOverlay` component exists but has no trigger.
- **Effort:** Low

---

#### L-002 · Saved views picker not rendered in admin tables

- **Status in `UI_DATA_COVERAGE.md`:** "BUILT, NOT RENDERED — wire to admin customer/vault tables"
- **Source:** `src/lib/views/actions.ts` — `loadUserViews()` loader exists
- **Impact:** Admin cannot save or restore table filter/sort configurations.
- **Effort:** Low-Medium

---

#### L-003 · Chart time selector not wired to admin dashboard

- **Status in `UI_DATA_COVERAGE.md`:** "BUILT, NOT RENDERED — wire to dashboard charts"
- **Component:** `src/components/catalyst/chart-time-selector.tsx` — component exists but unused in dashboard
- **Impact:** Admin dashboard value chart has no time range picker.
- **Effort:** Low-Medium

---

#### L-004 · `mining-health-daily` Inngest cron may never have run in production

- **Source:** `UI_DATA_COVERAGE.md` — "Trigger cron manually once in prod, then it runs daily"
- **Impact:** If `MiningMetric` table is empty (cron never triggered), admin dashboard shows demo data instead of real mining metrics. No visual distinction in prod.
- **Risk:** Ops gap, not a code gap. But it means production may be serving `buildDemoDashboardData()` to admins.
- **Recommendation:** Verify via Supabase that `MiningMetric` table has at least one row dated within 48h. If empty, trigger the Inngest cron manually.
- **Effort:** Low (ops)

---

#### L-005 · IPFS proof URIs are not pinned — stored as local HTTP or testnet CIDs

- **Source:** `UI_DATA_COVERAGE.md` — "IPFS proof URI pinning — Add Pinata/NFT.storage integration to `ingestProof()`"
- **Context:** `src/lib/attestation/mock.ts` generates deterministic-looking but fake CIDs for test attestations. Real attestations from the smart contract use `payloadCid` and `evidenceCid` fields, but no pinning service is wired.
- **Impact:** "View on IPFS" links in the proof center point to CIDs that may not be pinned and will 404 on a public gateway.
- **Effort:** Medium (Pinata integration)

---

#### L-006 · Governance `simulateProposal()` is not implemented (Tenderly stub)

- **Source:** `UI_DATA_COVERAGE.md` — "Tenderly simulation (stub → live)"
- **Context:** No `simulateProposal` function was found in the codebase — the reference from the docs suggests this was planned but never implemented. The governance proposal page shows "Conditional projection — not guaranteed" without an actual on-chain simulation.
- **Recommendation:** Either implement Tenderly simulation or explicitly label the projection as "Off-chain estimate — no on-chain simulation" in the UI.
- **Effort:** Medium

---

#### L-007 · Legal doc PDF (vault term sheet) is not generated

- **Source:** `UI_DATA_COVERAGE.md` — "Legal doc PDF generation (next action)"
- **Impact:** Vault detail page (`/vaults/[id]`) cannot produce a PDF term sheet for investors.
- **Effort:** Medium

---

#### L-008 · Per-vault dashboard snapshots not yet scoped

- **File:** `src/lib/data/dashboard.ts:260`
- **Comment:** `// TODO (Phase 3): per-vault snapshots when the DB schema lands`
- **Impact:** Non-yield vaults (Defensive, BTC Plus) show Yield Vault live KPIs in their dashboard view, labeled `livePreview = true`. A banner may or may not communicate this to admins.
- **Recommendation:** Verify that the `livePreview` flag causes a visible "Yield Vault data — preview" label in the admin vault dashboard UI. If not, add it.
- **Effort:** Low (UI label check) / High (DB schema addition)

---

## Summary table

| ID | Category | File | Severity | Status |
|----|----------|------|----------|--------|
| H-001 | HARDCODE — contract address | `admin/vaults/actions.ts:543` | HIGH | Open |
| M-001 | HARDCODE — APY fallback in PDF | `api/statements/[id]/pdf/route.tsx:747` | MEDIUM | Open |
| M-002 | STUB — mining confidence formula | `lib/engine/mining.ts:50` | MEDIUM | Open |
| M-003 | STUB — BTC tactical guardrail | `lib/engine/btc-tactical.ts:145` | MEDIUM | Open |
| M-004 | UNCONNECTED — notifications count | `components/notifications/notifications-bell-wrapper.tsx:15` | MEDIUM | Open |
| M-005 | MOCK — Inngest job stubs | `lib/data/cockpit.ts:150` | MEDIUM | Open |
| M-006 | STUB — lp.redemption / memo.publish | `lib/data/cockpit.ts:405` | MEDIUM | Open |
| M-007 | MATH.RANDOM — purity violation | `lib/rate-limit.ts:137`, `outreach-swarm-orchestrator.ts:155` | MEDIUM | Open |
| M-008 | HARDCODE — BTC price fallback | `admin/strategies/[slug]/page.tsx:40` | MEDIUM | Open |
| L-001 | UNCONNECTED — shortcuts overlay | `components/power/command-palette.tsx` | LOW | Open |
| L-002 | UNCONNECTED — saved views picker | `lib/views/actions.ts` | LOW | Open |
| L-003 | UNCONNECTED — chart time selector | `components/catalyst/chart-time-selector.tsx` | LOW | Open |
| L-004 | OPS — mining cron may not have run | Inngest / Supabase | LOW | Verify |
| L-005 | OPS — IPFS proofs not pinned | `lib/attestation/` | LOW | Open |
| L-006 | STUB — Tenderly simulation | admin/governance | LOW | Open |
| L-007 | MISSING — legal term sheet PDF | `app/(product)/vaults/[id]` | LOW | Open |
| L-008 | STUB — per-vault snapshot scoping | `lib/data/dashboard.ts:260` | LOW | Open |

---

## Non-findings (explicitly checked, no issue)

| Check | Result |
|-------|--------|
| Forbidden words in agent outputs | CLEAN — no violations; `forbidden-words.ts` + `semantic-guard.ts` guard all output paths |
| `console.log` in production code | CLEAN — only in comments/generation instructions |
| Empty `onClick={() => {}}` handlers | CLEAN — all event handlers are wired or disabled with explanations |
| APY shown as single point (not range) | CLEAN — `ApyRange` component enforced; no single-point APY displays found |
| Demo data with "Live" provenance badge | CLEAN — demo builders stamp `"simulated"`, never "Live" |
| `buildMockAttestation` in production paths | CLEAN — only in `src/lib/attestation/mock.ts` (test/fixture file), not imported in production loaders |

---

## Recommended fix order

1. **H-001** — remove testnet address hardcode (1 hour, no migration needed)
2. **M-001** — fix APY fallback in PDF route (2 hours)
3. **M-004** — wire notifications unread count (2 hours)
4. **M-007** — remove Math.random from swarm orchestrator (2 hours)
5. **M-008** — fix BTC price fallback to use last DB value (3 hours)
6. **M-002** / **M-003** — document placeholder formulas with explicit provenance badges (2 hours)
7. **M-005** — add UX tooltip explaining "unknown" Inngest status (1 hour)
8. **M-006** — remove `lp.redemption` / `memo.publish` from type union or implement (1 hour)
9. **L-001** / **L-002** / **L-003** — wire UI components (2–4 hours each)
10. **L-004** — ops: verify and trigger mining cron (30 min)
