# Series 1 — Component Integration Registry

Status 2026-07-25 · HEAD `c8d45b17` on `feat/dashboard-cockpit-remediation` (PR #407).
Companion to `FRONTEND_ARCHITECTURE.md` and `FRONTEND_CLEANUP_REPORT.md`.

Purpose: when the Storybook reference-component pass (currently in flight under
`src/design-system/storybook/**`) delivers an approved component list, this
registry says exactly where each one plugs in, what data it receives, which
states it must render, and how risky the swap is. **No component is replaced
by this document — it is the map for a future pass.**

Ground truth verified 2026-07-25: `pnpm ds:guard:primitive` → 0 hits,
`pnpm ds:guard` → 0 hits, `pnpm ds:guard:convergence` → 96 hits (pre-existing,
see `FRONTEND_ARCHITECTURE.md` §Known debt). `docs/series1/CATALYST_COMPLIANCE_AUDIT.md`
is now marked stale — its NEEDS_CATALYST_REFACTOR table predates the 51ae3b82
convergence and no longer reflects current code.

---

## How to read this table

- **Current component** — the file rendering this slot today.
- **Data contract** — the DTO/adapter feeding it (see `endpoint-to-ui-matrix.md`
  for the full backend map).
- **States** — the honest states it must preserve (`LIVE | STALE | PARTIAL |
  UNAVAILABLE | NOT_CONFIGURED | loading | empty`, per `kpi-catalog.md`).
- **Status** — `READY` (Catalyst-compliant, clean swap candidate) · `WAITING`
  (no Storybook component named yet) · `ADAPTER-NEEDED` (data shape needs a
  translation layer first) · `DATA-MISSING` (backend gap, see kpi-catalog.md
  "Explicit gaps") · `DESIGN-DECISION` (needs Adrien's call before touching).
- **Replacement mode** — `DIRECT` (swap the import, same props) ·
  `WRAPPER` (new component wraps old, keeps call sites stable) ·
  `ADAPTER` (needs a data-shape translator) · `COMPOSITION` (assembled from
  multiple future components) · `DO-NOT-REPLACE` (intentional, e.g. honesty
  logic, not a visual component).

---

## Dashboard (`/dashboard`)

| Slot | Current component | Data contract | States | Future Storybook component | Status | Replacement mode |
|---|---|---|---|---|---|---|
| Composition root | `series1-dashboard/Series1Dashboard.tsx` | `dashboard/_view.ts` view-model over `getDashboardFromBackend` | all | — (page composition, not a single swap) | WAITING | COMPOSITION |
| Hero / headline | `series1-dashboard/Series1DashboardHero.tsx` | `DashboardDTO` aggregate | LIVE/PARTIAL/UNAVAILABLE | `Series1DashboardHero` (story exists: `05-pages/Series1DashboardHero.stories.tsx`) | READY | DIRECT |
| Allocation Cockpit | `series1-dashboard/Series1AllocationCockpit.tsx` | `getVaultStrategiesFromBackend` (actualBps/driftBps) + `getProductFactsheetFromBackend` (targetBps) | LIVE/drift/UNAVAILABLE | `Series1AllocationCockpit` (story exists) | READY | DIRECT |
| Reserve accumulation | `series1-dashboard/Series1BitcoinAccumulation.tsx` | `getBtcFromBackend` (totalSats) | LIVE / **NOT_CONFIGURED (permanent — no monthly series producer, see kpi-catalog.md)** | `Series1BitcoinAccumulation` (story exists) | DATA-MISSING for the monthly-series variant; empty-state itself is READY | DIRECT for empty-state; do not build a fake curve |
| Capital architecture | `series1-dashboard/Series1CapitalArchitecture.tsx` | `FactsheetAllocation` pockets | static/live hybrid | `Series1CapitalArchitecture` (2 stories exist) | READY | DIRECT |
| Mining register (gated) | `series1-dashboard/Series1MiningRegister.tsx` | `getMiningFromBackend` (admin-grade, stale cron since 2026-07-07) | NOT_CONFIGURED/STALE — gated by design | `Series1MiningRegister` (story exists) | DATA-MISSING (cron dead) | DIRECT once cron restored; keep gated until then |
| Section shell | `series1-dashboard/Series1DashboardSection.tsx` | n/a (layout) | n/a | delegates to `Series1RowBase` (`series1-shell/Series1Panel.tsx`) already | READY | already Catalyst-derived, low churn expected |
| Honesty/state mapping | `series1-dashboard/Series1DataState.tsx` | per-field `Envelope.meta.status` | all | — | DO-NOT-REPLACE | this is logic, not a visual primitive — keep as the honesty layer under any future presentational swap |

## Reserve (`/vaults`, `/vaults/[id]`)

| Slot | Current component | Data contract | States | Future Storybook component | Status | Replacement mode |
|---|---|---|---|---|---|---|
| Page shell / rows | `series1-shell/Series1Page.tsx`, `Series1Panel.tsx` (`Series1Row`, `Series1RowList`) | `vaults/_data/vault-loader.ts` | all | — | READY (already scoped Catalyst preset) | DIRECT for individual rows if a Storybook `Table`/`Metric` replacement lands |
| KPI band | `series1-shell/Series1KpiBand.tsx` | vault snapshot (cap, minimum, committed) | LIVE/PARTIAL | `Series1KpiBand` or Catalyst `Metric` | READY | DIRECT |
| Timeline / process steps | `series1-shell/Series1Timeline.tsx` | factsheet terms | static | **no Catalyst timeline primitive exists yet** (per stale audit §9 — still true, verify before building) | WAITING | first confirm whether Storybook list includes a timeline primitive; if not, this stays local |
| Chart shell (non-HIS) | `series1-shell/Series1ChartPlaceholder.tsx` | n/a (placeholder/empty) | empty/gated | `HcChartCard` (HIS, already exists) — out of scope for this pass, charts excluded | READY but OUT OF SCOPE | charts are excluded from this cleanup mission entirely |
| Status badge (non-compliant leak) | `catalyst/badge.tsx` `<Badge color={statusColor}>` in `portfolio/[positionId]/page.tsx` | position status | n/a | `BentoBadge` (already canonical, 20 consumers elsewhere) | **NEEDS_CATALYST_REFACTOR** — flagged, not touched this pass (visual-diff risk) | DIRECT once verified pixel-stable |

## Proof (`/proof-center`)

| Slot | Current component | Data contract | States | Future Storybook component | Status | Replacement mode |
|---|---|---|---|---|---|---|
| Event stepper | `src/components/proof-center/series1-proof-event-stepper.tsx` | `getSeries1EventsFromBackend` | LIVE/empty/mismatch | `Series1ProofEventStepper` (story exists) | READY, but has 4 magic-px hits (see `FRONTEND_CLEANUP_REPORT.md` CSS section) | DIRECT — clean up spacing tokens first for a smaller diff |
| Provenance chip | `series1-shell/Series1Wired.tsx` | per-event provenance | n/a | `WiredChip`/`ProvenanceBadge` (already canonical) | READY | DIRECT |
| Route wrapper | `src/app/(product)/proof-center/page.tsx`, `loading.tsx` | n/a | n/a | — | **convergence-guard debt** (2 + 5 hits, `dark:`/`zinc-`) — route-wrapper file, not component tree | ADAPTER-NEEDED (needs its own small pass, not a component swap) |

## Profile (`/profile`)

| Slot | Current component | Data contract | States | Future Storybook component | Status | Replacement mode |
|---|---|---|---|---|---|---|
| Identity / KYC status | `series1-shell/Series1Panel.tsx` rows + `Series1Wired.tsx` | `getProfileFromBackend` | LIVE/PARTIAL | `Card` + `Table`/`Metric` (stale audit's target, still applicable) | READY | DIRECT |
| Wallet | `profile/_data/profile-loader.ts` → same row primitives | wallet DTO | connected/not-connected | — | READY | DIRECT |
| Route wrapper | `src/app/(product)/profile/page.tsx`, `loading.tsx` | n/a | n/a | — | convergence-guard debt (5 + 3 hits) | ADAPTER-NEEDED, route-wrapper pass |
| Onboarding shell (feeds Profile) | `catalyst/kyc-page.tsx`, `kyc-app-shell.tsx` (vendored Tailwind Catalyst kit) | n/a | n/a | — | **highest-value convergence target** — 15+10 `dark:`/`zinc` hits, guest-visible | ADAPTER-NEEDED — these are vendored kit files, not Series1-authored; re-skinning is a dedicated pass |

## Shared / cross-cutting

| Slot | Current component | Data contract | States | Future Storybook component | Status | Replacement mode |
|---|---|---|---|---|---|---|
| Nav shell (4-item rail) | `series1-shell/Series1Nav.tsx`, `Series1Shell.tsx` | static nav config (`product-nav-items.ts`) | n/a | `Series1InvestorNavShell` (story exists) | READY, critical path — verify nav contract test before swap | DIRECT with regression test (`investor-nav-snapshot.test.ts`) |
| Status/provenance chip | `catalyst/bento-badge.tsx`, `catalyst/wired-chip.tsx`(if present)/`provenance-badge.tsx` | per-field envelope status | all | already canonical | READY | n/a — this IS the target, not a source |
| Duplicate badge | `catalyst/badge.tsx` (raw zinc default) | n/a | n/a | superseded by `BentoBadge` | NEEDS_CATALYST_REFACTOR (11 consumers: 10 admin, 1 investor — see Reserve row above) | DIRECT per call site, low batch |

---

## Explicitly out of scope for any replacement pass

Per mission doctrine — do not touch when wiring future components:

- `src/components/dataviz/his/**` (HIS SVG charts) and Recharts consumers —
  charts are excluded from this entire cleanup/integration effort.
- `src/design-system/storybook/**/*.stories.tsx` — actively authored by the
  parallel Storybook pass as of 2026-07-25.
- Any route in `src/app/admin/**` — admin console, not investor surface.
- `src/app/(product)/portfolio/preview/**` — explicitly marked internal
  sandbox, not a Series1 investor destination (see `investor-ui-map.md` §2).
- Redirect-stub routes (`/btc`, `/mining`, `/my-vaults`, `/bitcoin`,
  `/portfolio/activity|distributions|positions|yield`) — intentional
  link-preservation shims, not dead code to "replace."

## Data gaps that block a visual swap regardless of component readiness

Per `kpi-catalog.md` "Explicit gaps" — do not let a new component silently
paper over these by rendering a fabricated value:

- Monthly BTC accumulation series — no producer. Blocks any richer
  `Series1BitcoinAccumulation` variant beyond the current honest empty-state.
- Mining telemetry (hashprice/difficulty/uptime) — stale cron since
  2026-07-07. Any future Mining Economics component stays gated.
- Mainnet events — today only fork chainId `31337`. Proof components must
  keep the fork/mainnet/mismatch state, not assume mainnet.
