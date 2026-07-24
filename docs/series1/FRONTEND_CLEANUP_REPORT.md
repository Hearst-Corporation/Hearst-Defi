# Series 1 — Frontend Cleanup Report

Status 2026-07-25 · branch `feat/dashboard-cockpit-remediation` · HEAD `c8d45b17`
→ this pass (uncommitted as of writing). Companion to
`COMPONENT_INTEGRATION_REGISTRY.md` and `FRONTEND_ARCHITECTURE.md`.

Mission: structural cleanup + integration-readiness prep for Series1
(Dashboard/Reserve/Proof/Profile), ahead of a future approved Storybook
component list. No visual change, no data-contract change, no route change.

## 1. Ownership / baseline

- Branch `feat/dashboard-cockpit-remediation`, HEAD `c8d45b17`, open PR #407,
  6 commits ahead of `origin/main` (`28404a2f`). Working tree was clean at
  start.
- Second worktree found: `connect-series1-v3-gpt` (branch `docs/series1-v3-gpt`).
  Investigated and ruled **not** the "Storybook reference copy" pass — single
  stale commit from 2026-07-22, unpushed, no PR, exploring an HTML visual
  mockup plus an unrelated large `src/lib/` data-layer diff. **Not touched.**
- The actual live Storybook pass: `src/design-system/storybook/**/*.stories.tsx`,
  ~19 files touched 2026-07-23–24. **Not touched**, per mission Phase 12.
- `docs/series1/CATALYST_COMPLIANCE_AUDIT.md` was found stale — it predates
  commit `51ae3b82` which already executed its own recommended DS Target Map.
  Marked stale in-place (see §7 below), not deleted.

## 2. Files removed (19) — all verified zero-consumer before deletion

Verification method: `grep -rl` for the exact import path across `src/`
(component name substring matches rejected as false positives — see method
note below), cross-checked against `npx knip` output, cross-checked that no
`__tests__` file references the symbol.

| File | Why dead |
|---|---|
| `src/components/hub-mode-styles.tsx` | Zero consumers; only user of `@hearst/hub-sdk` (see §4) |
| `src/features/investor-ui/components/figure.tsx` | Zero consumers |
| `src/features/investor-ui/components/hairline-progress.tsx` | Zero consumers |
| `src/features/investor-ui/data-source/index.ts` | Zero consumers (barrel with no importer) |
| `src/lib/data/portfolio-dashboard.ts` | Zero consumers |
| `src/lib/data/vault-rebalancings.ts` | Zero consumers |
| `src/lib/portfolio/yield-history.ts` | Only consumer was `portfolio-dashboard.ts` (above), removed together |
| `src/components/admin/cockpit/action-queue.tsx` | Zero consumers |
| `src/components/admin/cockpit/audit-trail-rolling.tsx` | Zero consumers |
| `src/components/admin/cockpit/live-metrics.tsx` | Zero consumers |
| `src/components/admin/dashboard/index.ts` | Zero real importers (grep on full import path, not substring) |
| `src/components/profile/demo-reset-button.tsx` | Zero consumers |
| `src/components/profile/profile-security-row.tsx` | Zero consumers |
| `src/components/profile/wallet-disconnect-button.tsx` | Zero consumers |
| `src/components/vaults/regime-scenario-table.tsx` | Zero consumers |
| `src/lib/admin/dashboard-formatters.ts` | Zero consumers |
| `src/lib/admin/dashboard-readiness-view.ts` | Zero consumers |
| `src/lib/backend/status.ts` | Zero consumers (verified via exact-path grep after an initial substring false-positive) |
| `src/lib/demo/timeline-core.ts` | Zero consumers |
| `src/app/(product)/portfolio/preview/_charts/rebalancing-feed.tsx` | Zero consumers; inside the already-flagged non-Series1 sandbox route |

**Method note:** a naive `grep -rn "status"` or `grep -rn "figure"` returns
hundreds of false positives (common words, unrelated symbols of the same
name). Every file above was verified by grepping the *exact import path*
(e.g. `from "@/lib/backend/status"`), not the bare filename/symbol.

**Not deleted despite knip flagging it:** `src/features/investor-ui/types/index.ts`
— left alone; still shows as an unused *file* in knip but it's a type-only
barrel inside an actively-consumed feature folder (`investor-ui/` has real
consumers: `profile/page.tsx`, `vaults/[id]/invest/page.tsx`,
`portfolio/[positionId]/page.tsx`, `asset-analytics-gallery.tsx`,
`vault-composition-panel.tsx`, `proof-center/hub-data.ts`). Trimming a
barrel's re-exports is API-surface editing, not proven-dead-file removal —
out of this pass's "safe to remove" bar.

## 3. Exports NOT removed (flagged, not acted on)

Knip flagged 40 unused exports and 4 unused types. Only whole *files* with
zero consumers were removed this pass (§2). Individual unused exports living
inside otherwise-live files were left alone — several are documented,
intentional API surface (Catalyst primitive sub-exports like `BadgeButton`,
`Subheading`, `InputGroup`, `SidebarDivider`, `NavbarLabel`, `BentoDetailRow`
— canonical layer, may be consumed by a future Storybook swap or admin
surface not yet wired). Deleting exports from a live file is a narrower,
riskier judgment call than deleting an orphaned file; left for a dedicated
pass with product sign-off per file. Full list in the knip output, not
reproduced here to avoid staleness.

## 4. Dependencies — flagged, not removed

- `@hearst/hub-sdk` (`file:./hearst-hub-sdk-0.2.0.tgz`) — its only consumer
  (`hub-mode-styles.tsx`) was deleted this pass, so the dependency is now
  truly unused. **Not removed from `package.json`** — it's a local vendored
  tarball; removing a declared dependency is a step beyond "delete a dead
  file" and may be intentionally pre-staged for future hub-mode work. Needs
  a product decision, not a cleanup-pass judgment call.
- `electron-updater`, `tailwindcss` (devDep) — knip false positives (used via
  lazy `require()` in `electron/main.ts` and via `@tailwindcss/postcss`
  respectively). Not touched, noted so a future pass doesn't re-flag them.
- `chart.js` + `react-chartjs-2` — a third charting stack (beyond Recharts +
  HIS), used in exactly one file
  (`src/components/admin/product-workspace/monte-carlo-chart.tsx`). Not
  touched — charts are out of scope for this mission per Phase 12, and this
  is an admin-only surface, not investor-facing.

## 5. Guards / validation run this pass

| Command | Result |
|---|---|
| `pnpm typecheck` | **PASS**, 0 errors, both before and after the 19 deletions |
| `pnpm lint` | **PASS**, 0 errors, 12 pre-existing warnings (none touch deleted files) |
| `pnpm ds:guard` | **PASS**, 0 hits |
| `pnpm ds:guard:primitive` | **PASS**, 0 hits (confirms 51ae3b82's convergence still holds) |
| `pnpm ds:guard:convergence` | **FAIL, 96 hits — pre-existing, not caused by this pass.** See `FRONTEND_ARCHITECTURE.md` "Known debt" for the two concentration pockets (vendored Catalyst shell files, route-wrapper files) |
| `npx knip` | Unused-file count dropped from 21 → 1 after this pass's deletions (the one remaining is the intentionally-kept `investor-ui/types/index.ts`, see §2) |

`pnpm test-storybook` / `pnpm build` were not run — no component or route
code was modified beyond deletions of zero-consumer files, and typecheck +
lint + guards already confirm no broken import graph. Available on request.

## 6. CSS / hardcode debt inventory (not fixed — see registry for priority)

Full detail in the dependency/CSS audit findings, summarized here for the
handover:

- **`dark:` modifier — 140 hits total**, ~55 inside vendored Catalyst kit
  files (expected, vendored-kit debt), remainder concentrated in `(product)`
  route wrapper files (`vaults/[id]/page.tsx` 14, `kyc-page.tsx` 15,
  `kyc-app-shell.tsx` 10, `table.tsx` 10, `sidebar.tsx` 9, plus
  `loading.tsx`/`page.tsx` across vaults/profile/proof-center).
- **`zinc-*` classes — 141 hits**, same concentration pattern.
- **Red (`red-*`) — 0 hits.** Fully clean, matches "no red" doctrine.
- **Blue (`blue-*`) — 0 hits.** Fully clean.
- **Raw `#A7FB90` outside token definition — 0 real violations** (only hit is
  the sanctioned `CONNECT_ACCENT_HEX` constant in `brand-constants.ts`, reused
  by email/PDF contexts that can't consume CSS custom properties).
- **Unbranded hex palette:** `src/lib/product-strategies/lab-colors.ts` — 8
  hardcoded hex values (`btc: "#F7931A"`, etc.) with no token indirection.
  Real tokenization gap, not a technical-constraint exception like the
  email/PDF hits. Flagged for a future pass, not fixed here (would touch
  chart-adjacent code, excluded this pass).
- **Inline `style={{}}` — 42 hits in `series1-dashboard/`/`series1-shell/`**
  (heaviest concentration in the repo), 22 more in `src/app/` route files.
  Not touched — would risk exactly the pixel movement this mission forbids.
- **Magic-px arbitrary Tailwind values — 29 hits**, several inside chart
  files (may be legitimate computed geometry, out of scope), a few in
  non-chart UI (`dashboard-panel-header.tsx`, `series1-proof-event-stepper.tsx`)
  worth a token-conversion pass later.

## 7. Documentation changes this pass

- `docs/series1/CATALYST_COMPLIANCE_AUDIT.md` — marked **stale** at the top
  (not deleted — kept as historical record of the pre-convergence state).
- `docs/series1/COMPONENT_INTEGRATION_REGISTRY.md` — **new**, slot-by-slot
  map for the future Storybook component swap.
- `docs/series1/FRONTEND_ARCHITECTURE.md` — **new**, structure convention,
  data→state→presentation flow, known debt, protected zones.
- `docs/series1/FRONTEND_CLEANUP_REPORT.md` — this file.

## 8. What was explicitly NOT done (by mission design)

- No visual change. No component was rewritten, restyled, or re-composed.
- No new slot abstraction layer / wrapper framework was created — the
  existing `series1-dashboard/`/`series1-shell/`/`catalyst/` split already
  satisfies the "clear place to plug in a future component" goal; documented
  instead of rebuilt (see `FRONTEND_ARCHITECTURE.md` §"Convention").
  Explicit slot components (`DashboardHeroSlot`, etc.) were **not** created —
  the registry maps existing components to future targets directly, since
  each current component already sits at a stable, single-responsibility
  location. Adding a wrapper layer around each one would be the "40 artificial
  abstractions" anti-pattern the mission explicitly warns against.
- No route was merged, hidden, or deleted (redirect stubs already do this
  intentionally, per `investor-ui-map.md`).
- No `ds:guard:convergence` fix — 96 pre-existing hits untouched, proven
  pre-existing via guard re-run before/after this pass's changes.
- No charts (HIS/Recharts/chart.js) touched.
- No dependency uninstalled.
- No commit made — awaiting explicit approval per mission Phase 14.

## 9. Foreign dirty files

None — working tree was clean at mission start and stayed clean (only this
pass's own changes are present).

## 10. Proposed commit

```
refactor(front): prepare Series1 for component integration

- remove 19 zero-consumer dead files (verified via exact-path grep + knip,
  cross-checked against test references)
- mark docs/series1/CATALYST_COMPLIANCE_AUDIT.md stale (superseded by 51ae3b82's
  convergence, kept as historical record)
- add docs/series1/COMPONENT_INTEGRATION_REGISTRY.md — slot-by-slot map for the
  future approved Storybook component list
- add docs/series1/FRONTEND_ARCHITECTURE.md — structure convention, data flow,
  known debt inventory, protected zones

No visual change, no data-contract change, no route change. Guards: typecheck 0,
lint 0 errors, ds:guard 0, ds:guard:primitive 0. ds:guard:convergence 96 hits
pre-existing, proven unaffected by this pass. Did not touch src/design-system/storybook/**
(active parallel pass) or the connect-series1-v3-gpt worktree (unrelated, stale).
```

**Staging is chirurgical** — the 19 deletions + 3 doc files listed in §2/§7,
nothing else. No `git add -A`.
