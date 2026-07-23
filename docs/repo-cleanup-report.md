# Repo Cleanup Report

Status 2026-07-23.

## Executed this pass (commit `c4de8935`, Décision 009)

78 docs + 1 public HTML sandbox retired from the tree (user-intentional
deletions, actioned by a dedicated cleanup commit — not stash, not blind reset).
All 78 were docs or a public HTML sandbox; **zero code/config**, none referenced
from `src/`. Two canonical, dated-2026-07-23 sources were **restored** and kept:
`docs/series1/backend-ecosystem-map.md`, `docs/series1/kpi-catalog.md`.
`docs/investor-navigation-decision.md` was removed here but is preserved on the
independent worktree branch `docs/series1-v3-gpt` — no content loss. The
third-party worktree `connect-series1-v3-gpt` was left untouched.

---

## Navigation / Endpoint cleanup candidates (MISSION F — proposals, not executed)

Each candidate carries: File/Route | Reason | Category | Safe because.
**Nothing below is deleted in this pass** (MISSION H forbids mass route removal).
These are staged for a later implementation pass, after nav consolidation.

### Routes — merge into Portfolio (do NOT delete; consolidate)
| Route | Reason | Category | Safe because |
|-------|--------|----------|--------------|
| `/portfolio/activity` | endpoint=page symptom | duplicate | content becomes a Portfolio module; no data lost |
| `/portfolio/positions` | endpoint=page symptom | duplicate | same |
| `/portfolio/distributions` | "distributions" is yield-adjacent vocab off-canon | contradictory | reframe as capital movements inside Portfolio |
| `/portfolio/tax` | secondary export, not a destination | duplicate | fold behind actions menu |
| `/portfolio/yield` | **"yield" contradicts "Not yield. Bitcoin inventory."** | contradictory | reframe or hide; no yield figure for Series 1 |
| `/portfolio/preview` | dev sandbox | dead route | not an investor destination |

### Routes — reconcile / hide
| Route | Reason | Category | Safe because |
|-------|--------|----------|--------------|
| `/my-vaults` vs `/vaults` | two vault lists | duplicate | reconcile to one before either is linked in nav |
| `/mining` | admin-grade telemetry (stale cron) | agent noise | expose only *derived* economics in Dashboard when real |
| `/proof-center/full` | firehose, not the primary read | duplicate | secondary or admin |

### Docs already retired that entrenched endpoint=page or off-canon vocab
| File (retired in c4de8935) | Reason | Category |
|----------------------------|--------|----------|
| `docs/PROMPT-MINING-YIELD-TELEGRAM-PIPELINE.md` | "yield" in the name, off-canon | contradictory |
| `docs/PORTFOLIO_REBUILD_METHOD.md`, `PORTFOLIO_LAYOUT_REFERENCE.md`, `PORTFOLIO_ZERO_CONTRACT.md` | superseded by the one-page Portfolio plan | replaced by canon |
| `docs/UI_V2_GAP_REPORT_2026-07-15.md`, `UI_DATA_COVERAGE.md`, `UI_CONTEXT.md` | pre-consolidation UI maps | replaced by canon |
| `docs/gpu1-*.md` (8 files) | stale backend topology (monorepo-era, port 3900 confusion) | obsolete |
| `docs/frontend-api-only-policy.md`, `backend-integration.md` | said backend "not consumed" — stale, it IS consumed now | contradictory |
| `docs/*.html` canvases (platform, master-chat, myswarms, catalyst-cartography, ambient-tester, calculator, audit-report) | non-canonical HTML scratch | agent noise |

### Docs kept as canon (source of the new plan)
- `docs/series1/backend-ecosystem-map.md`
- `docs/series1/kpi-catalog.md`
- `docs/series1/investor-ui-map.md` (new, this pass)
- `docs/series1/endpoint-to-ui-matrix.md` (new, this pass)
- `docs/series1/series1-navigation-proposal.md` (new, this pass)
- `docs/visuals/series1-backend-ecosystem-canvas.html` (present, not deleted)
