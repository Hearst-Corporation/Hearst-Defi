# Series 1 — Frontend Architecture

Status 2026-07-25 · HEAD `c8d45b17` on `feat/dashboard-cockpit-remediation`.
Companion to `COMPONENT_INTEGRATION_REGISTRY.md` and `FRONTEND_CLEANUP_REPORT.md`.

## Convention: keep the existing tree, don't reorganize it

The mission brief offered an optional `src/components/series1/{dashboard,reserve,
proof,profile,shared,states,adapters,composition}/` structure. **Decision: keep
the existing tree.** It already separates concerns along the same lines that
structure would enforce, and a mechanical move of ~16 files plus every import
site would be a large, zero-functional-value diff carrying real regression
risk for no integration-readiness gain. Document the convention instead:

```
src/components/series1-dashboard/   Dashboard-only composition (Hero, Allocation
                                     Cockpit, Bitcoin Accumulation, Capital
                                     Architecture, Mining Register, DataState)
src/components/series1-shell/       Cross-page shell + presets shared by
                                     Reserve/Proof/Profile (Nav, Page, Panel/Row,
                                     KpiBand, Timeline, Wired chip, ChartPlaceholder)
src/components/catalyst/            Canonical primitive layer (Button, Card, Badge,
                                     Table, Metric, Field, Select, Stepper, …)
src/components/ui/                  Deprecated compatibility shims only
                                     (chart.tsx, client-toaster.tsx, toaster.tsx,
                                     provenance-badge.tsx) — no new primitives
src/app/(product)/{dashboard,vaults,
  proof-center,profile,portfolio}/  Route + data-loading layer:
    page.tsx                          composition root for the route
    loading.tsx / error.tsx           route-level state boundaries
    _data/*-loader.ts                 server-side fetch + adapt (Backend DTO → view model)
    _view.ts                          honest-state view-model (where present, e.g. dashboard)
```

This mirrors the data flow described in §"Data → state → presentation" below.
A future component-swap pass replaces files inside `series1-dashboard/` and
`series1-shell/` — it does not need to relocate them first.

## Nav / route ownership (confirmed live, 2026-07-25)

| Nav item | Route | Owner components |
|---|---|---|
| Dashboard | `/dashboard` | `series1-dashboard/Series1Dashboard.tsx` (root) |
| Reserve | `/vaults`, `/vaults/[id]` | `series1-shell/Series1Page.tsx` + `Series1Panel.tsx` presets |
| Proof | `/proof-center` | `src/components/proof-center/series1-proof-event-stepper.tsx` + `series1-shell/Series1Wired.tsx` |
| Profile | `/profile` | `series1-shell/Series1Panel.tsx` presets + `Series1Wired.tsx` |

`Series1Nav.tsx` + `Series1Shell.tsx` render the 4-item rail for all of the
above; `Series1Shell` mounts under `ConnectShell` → `app-chrome.tsx` →
`src/app/layout.tsx` (root layout, critical path — do not touch without the
nav snapshot test `investor-nav-snapshot.test.ts`).

**Routes live but outside the 4-item nav** (intentional per
`investor-ui-map.md`, not a bug to "fix" in this pass): `/portfolio` (My
Position — doctrine recommends folding into Dashboard, not yet done),
`/bitcoin-constitution` (doctrine recommends folding into Reserve, not yet
done). Both are reachable, both render real data — they are deferred product
decisions, not orphaned code.

**Redirect-stub routes** (intentional link-preservation, not dead code):
`/btc`, `/btc/ledger`, `/bitcoin`, `/mining`, `/my-vaults`,
`/portfolio/activity`, `/portfolio/distributions`, `/portfolio/positions`,
`/portfolio/yield` — all thin redirects to their consolidated destination.

## Data → state → presentation (already the working pattern)

```
Backend DTO (server-client.ts)
  → route loader (_data/*-loader.ts)         — fetch + shape
  → view model (_view.ts, where present)      — honest-state mapping
  → Series1DataState.tsx                      — per-field envelope status → UI state
  → series1-dashboard/* or series1-shell/*    — presentation (props only)
  → Catalyst primitives (Card, Metric, Table, BentoBadge, WiredChip, …)
```

`Series1DataState.tsx` is the honesty layer: it maps backend `EnvelopeStatus`
(`LIVE | SNAPSHOT | STALE | SIMULATED | NOT_CONFIGURED | UNAVAILABLE`, see
`kpi-catalog.md`) to what a component is allowed to render. **A future
Storybook component must receive the output of this layer, never the raw
DTO** — this is the contract that keeps a replacement presentational-only.
Do not delete or bypass `Series1DataState.tsx` when swapping a visual
component; the honesty mapping and the presentation are already separated —
preserve that boundary.

## Unified transversal states

Current vocabulary, already consistent across the four investor surfaces
(source: `Series1DataState.tsx`, `kpi-catalog.md` `DataStatus`/`EnvelopeStatus`):

`LIVE | STALE | PARTIAL | UNAVAILABLE | NOT_CONFIGURED | loading | empty`

No merging needed — `rpc_error` stays distinct from `not_deployed`; `stale`
stays distinct from `empty`; `not_configured` never renders as `0`. This is
already enforced by the honesty layer described above; this pass found no
violation of it in the four investor surfaces.

## Design system authority (unchanged, restated for this doc's audience)

Catalyst (`src/components/catalyst/`) is canon. `src/components/ui/` is a
shrinking compatibility layer — 4 files remain (`chart.tsx`,
`client-toaster.tsx`, `toaster.tsx`, `provenance-badge.tsx`), all documented
exceptions. Full rules: `README_DESIGN_SYSTEM.md`. Guards:
`pnpm ds:guard` (hardcode), `pnpm ds:guard:primitive` (hand-rolled
chip/stepper/row), `pnpm ds:guard:convergence` (raw Tailwind color / px /
accent-hex, wider scope). All three exist and run in CI already — this pass
added no new guard.

## Known debt (not fixed this pass — tracked, not silent)

See `FRONTEND_CLEANUP_REPORT.md` for the full inventory. Headline items:

1. **`ds:guard:convergence` — 96 hits**, concentrated in two pockets: vendored
   Catalyst shell/onboarding files (`sidebar.tsx`, `navbar.tsx`, `kyc-page.tsx`,
   `kyc-app-shell.tsx`, `sidebar-layout.tsx`) and `(product)` route-wrapper
   files (`page.tsx`/`loading.tsx`) that the prior Catalyst-convergence commit
   didn't touch because it scoped to the component tree, not route wrappers.
2. **`catalyst/badge.tsx` vs `catalyst/bento-badge.tsx`** — duplicate badge
   primitive, one investor-facing leak (`portfolio/[positionId]/page.tsx`).
3. **42 inline `style={{}}` hits** across `series1-dashboard/`/`series1-shell/`
   — heaviest concentration in the repo, not touched (would risk a pixel diff).
4. **`src/features/investor-ui/`** — a live tree (real consumers: profile,
   vaults invest, portfolio position, asset-analytics-gallery,
   vault-composition-panel) but carries unused internal exports (`format-btc.ts`
   7 exports, `data-states.tsx` 5 exports) — left as-is; API-surface trimming
   inside an otherwise-live module is out of scope for a "delete proven-dead
   files" pass.
5. **Series1Timeline has no Catalyst equivalent yet** — confirmed still true
   2026-07-25 (was already noted in the now-stale compliance audit). If the
   Storybook list doesn't include a timeline primitive, this stays local.

## What NOT to touch (protected zones)

- `src/design-system/storybook/**` — active parallel Storybook authoring pass.
- `src/components/dataviz/his/**`, Recharts consumers — charts excluded from
  this mission entirely.
- Backend, contracts, indexer, auth, deploy config, secrets — out of scope.
- `docs/series1/CATALYST_COMPLIANCE_AUDIT.md` — kept as historical record,
  now marked stale at the top; do not delete (git history + doctrine trail).
