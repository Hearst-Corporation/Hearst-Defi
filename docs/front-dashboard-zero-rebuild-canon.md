# Dashboard zero-rebuild canon

> **Created:** 2026-07-22 · **Baseline:** `8191772d` · **Status:** canon accepted, code pass NOT started.
> **Scope:** `/dashboard` (investor) and `/admin/dashboard` (operator). Nothing else.
> **Companion docs:** [`frontend-kyc-reference-canon.md`](./frontend-kyc-reference-canon.md) ·
> [`orchestration/HASHVAULT-REALIGNMENT/README.md`](./orchestration/HASHVAULT-REALIGNMENT/README.md) ·
> [`DS_SINGLE_SOURCE_OF_TRUTH.md`](./DS_SINGLE_SOURCE_OF_TRUTH.md) ·
> [`DS_SHELL_CONTRACT.md`](./DS_SHELL_CONTRACT.md) · [`frontend-api-only-policy.md`](./frontend-api-only-policy.md)

Both dashboards are visually unusable and are rebuilt from zero. This document exists so
the rebuild converges instead of producing a third bad dashboard. It records **why** the
current screens fail — a measured, verifiable defect, not a matter of taste — and the
rules the replacement must satisfy.

Brand rule: **Earth is Hearst.** No separate Earth brand exists.

---

## 0. Root cause — the depth model is inverted

This is the single defect that produces "tableau noir", "blocs noirs agressifs",
"cage-in-cage" and "cards trop dures" on both screens.

Measured token values:

| Token | Value | Intended role | Source |
|---|---|---|---|
| `--ct-bg-deep` | `#060708` | app canvas | `cockpit-shell/tokens.css:22` |
| `--ct-surface-page` | `#18181b` | page panel | `src/app/cockpit.css:117` |
| `--ct-surface-card` | `#000000` | card | `src/app/cockpit.css:118` |
| `--ct-surface-inset` | `#15191C` | inset / well | `src/app/cockpit.css:119` |

`--ct-surface-page` `#18181b` is **byte-identical to Tailwind `zinc-900`**, which is
exactly what the Catalyst shell already paints (`sidebar-layout.tsx:93`,
`dark:lg:bg-zinc-900`). The two vocabularies of this repo therefore already agree at page
level — there is no conflict to arbitrate there.

They break one tier down:

- a card (`#000000`) is **darker than the page that contains it**;
- the inset that should read *recessed* (`#15191C`) is **lighter than the card that
  contains it**.

Depth is inverted twice. `.ct-glass-panel` resolves to `background: var(--ct-surface-card)`
(`src/app/cockpit.css:3402`), and every admin `BentoPanel` renders `.ct-glass-panel` — so
every admin panel is a pure-black slab punched into a graphite page. The investor side
repeats the same inversion more mildly: `Series1Panel` is `dark:bg-zinc-950/40`
(`Series1Panel.tsx:15`) ≈ `#131316` over `#18181b`, again darker than its parent.

**A surface that recedes as it comes toward the viewer reads as a hole, not as a card.**
That is the whole bug.

---

## 1. Findings (F1–F9)

These are the facts the rebuild must respect. Each is verifiable at the cited location.

### F1 — Inverted depth model
See §0. Applies to both screens.

### F2 — The investor KPI band is literally a spreadsheet
`Series1KpiBand.tsx:21-36` renders `grid gap-px bg-white/10` with 7 opaque cells: the grid
*gap* is the 1px rule. Seven technical cells separated by hairlines is a table, not a
KPI band. This is the source of "KPI en cellules techniques" and "effet tableau noir".

### F3 — `/dashboard` repeats the unavailable motive ~12 times
`wiredMetric()` (`src/app/(product)/dashboard/_view.ts:60`) returns `reasonLabel(reason)`
**as the KPI value**, and `Series1WiredRow` (`Series1Wired.tsx:107`) repeats it in every
row hint. With the contract undeployed, "Not exposed in legacy mode" renders about a dozen
times, in the largest type on the page. **The honesty is correct; the dosage is the bug.**

### F4 — `/admin/dashboard` fabricates data (hard honesty violation)
- `99.98%` uptime is a hardcoded literal — `system-readiness.tsx:88`.
- "Last scan" renders `new Date().toLocaleTimeString()` — i.e. render time, not scan time.
- Status pills are hardcoded green regardless of data: `status="Active"` / `"Monitoring"` /
  `"Live"` with `statusTone="ok"` — `assets-board.tsx:326-360`. This is simultaneously the
  fabrication and the "vert trop présent".

### F5 — `/admin/dashboard` still runs the retired yield-era product model
The page is scoped to `DASHBOARD_FIXTURE_VAULTS` (yield / defensive / btc-plus,
`src/lib/vaults/dashboard-scope.ts:10`) and surfaces `headlineApy`, `yieldPosture` and
`risk.band` — vocabulary the Series 1 product boundary explicitly excludes
(`frontend-kyc-reference-canon.md`, "Non-negotiable Series 1 copy").

### F6 — Double shell on admin
`SidebarLayout` already raises content into a rounded `zinc-900` card. `AdminPageShell`
then renders **another** `rounded-2xl border bg-surface-page` box inside it
(`admin-page-shell.tsx:96`) — same colour, second frame. Cage-in-cage, forbidden by
`DS_SHELL_CONTRACT.md` §4.

### F7 — Two live vocabularies; the guards bless only one
- Catalyst/KYC grammar: zinc ramp + `dark:` modifiers + raw `#a7fb90`.
- Cockpit grammar: `--ct-*` tokens, dark-only.

`node scripts/ds-layout-audit.mjs` flags the Series 1 shell for `hardcoded-brand-green`
and `raw-hex` in `Series1ChartPlaceholder.tsx:25,29`, `Series1Nav.tsx:61`,
`Series1Timeline.tsx:20` and `dashboard/page.tsx:214`.
`src/lib/ds/__tests__/visual-direction-ds-contract.test.ts` bans `text-zinc-*`,
`border-white/N` and `dark:` on every surface in its scope. **The rebuild must not extend
an already-flagged vocabulary.**

### F8 — Assets already built that the rebuild must reuse, not re-create
`src/features/investor-ui/components/reserve-cockpit/` holds the **8 preserved Hearst
modules** named in the KYC canon — `CapitalFlowRail`, `BtcAccumulationCurve`,
`AllInCostVsSpot`, `ReserveRunwayChart`, `MiningActivityTimeline`, `PocketAllocationVisual`,
`SmartContractStateCard`, `DeliveryRailSelector`. All are token-only, all carry honest
empty states via `ReserveBlockFrame` + `DataUnavailable`. **Only `CapitalFlowRail` is
wired** (portfolio detail); the other 7 are built and orphaned.

Also available and unused by the dashboards: `src/components/dataviz/his/` (10 HIS chart
primitives), `src/features/investor-ui/components/widgets/` (3 panels),
`src/features/investor-ui/components/states/data-states.tsx`.

### F9 — Hard constraints the rebuild inherits
- `src/app/(product)/dashboard/**` **must never import `@/lib/data/*`**, Prisma, `viem`
  or `ethers` — `src/features/investor-ui/__tests__/architecture-guard.test.ts:59-71`.
  Chain reads go through `@/lib/chain/dynavault.ts` only (server-only passage point,
  `frontend-api-only-policy.md`).
- `src/app/admin/dashboard/page.tsx` is in the **PRIMARY_ALLOWLIST** of
  `src/app/admin/__tests__/admin-canon-start-pattern.test.ts:64-71` — the rebuild is
  structurally free, and may opt back into the canon by removing that entry.
- `admin-visual-frame.test.ts` requires `min-w-0` on the page frame and every section card.
- Tests to update: `src/components/admin/__tests__/dashboard-assets-board.test.tsx`,
  `src/components/admin/dashboard/__tests__/risk-summary-card.test.tsx`.

---

## 2. Vision

### Series 1 investor — premium Bitcoin reserve cockpit
One register for a single investor: capital deployed, Bitcoin accumulated, reserve
coverage, mining operations, proof readiness. The dominant read is **accumulated BTC
delivered at maturity**. Market price is contextual, never a return projection. The page
must read as an institutional instrument statement, not as an analytics console.

### Admin — operational command cockpit
One supervision surface for the operator: is the system ready, where is the capital, who
are the clients, what is pending in governance, what is the exposure. The dominant read is
**posture and pending action**. It must read institutional and calm, not alarmist.

Two different audiences, **one surface discipline**. Same ladder, same accent restraint,
same honesty rules. Different density and different vocabulary.

---

## 3. Data honesty rule

1. **Never fake.** No fabricated uptime, no fabricated scan time, no status pill whose
   tone is not computed from data. (F4 is the named violation this rule deletes.)
2. **Never turn `unavailable` into a zero**, and never turn a `not_configured` contract
   into a fixture. The `Wired<T>` envelope's motive is preserved end to end.
3. **`legacy` / `not_configured` stay honest.** They are the truthful state of the product
   today and are shown as such.
4. **Reasons are preserved but dosed.** See §5 — a motive belongs in a compact state or a
   sub-text, never as the headline value of every KPI (F3).
5. **No Series 1 product boundary violation.** APY, fixed yield, periodic distribution,
   borrowing, LTV, liquidation, Morpho, collateral and leverage are excluded from investor
   framing, and the fixture-vault yield model is dropped from admin (F5).
6. **Provenance travels with the number.** Every surface fed by a read carries its own
   provenance; an empty or preview state is never presented as Live or Verified.

---

## 4. Surface rule — the ladder

The ladder, stated as the fix to §0. **Content surfaces rise as they nest toward the
viewer; only wells and insets recede.**

| Tier | Token | Rule |
|---|---|---|
| L0 — canvas | `--ct-bg-deep` | the shell gutter. Owns the ambient light. Nothing else does. |
| L1 — shell panel | `--ct-surface-page` | the raised content card `SidebarLayout` already renders. One per document. |
| L2 — card | **`--ct-surface-raised`** | rises above L1. Derived token, already defined (`cockpit.css:124`), zero new hex. |
| L3 — inset / well | `--ct-surface-inset` | recesses below L2. KPI wells, chart wells, nested evidence. |
| status | `--ct-accent` / `--ct-status-*` | **signal only**, never a surface. |

Non-negotiable:

- **No hard black panels.** `--ct-surface-card: #000000` is not used by new dashboard
  code. Cards use `--ct-surface-raised`.
- **No green as material.** Accent and emerald are never a fill, never a large surface,
  never a panel background. One accent only (`--ct-accent`, `#A7FB90`), used as a rare
  signal: an active state, a single datum bar, a live dot.
- **No zinc, no `dark:` modifiers, no raw hex** in new dashboard code. The app is
  dark-only; colour comes from `--ct-*` tokens. This closes F7.
- **No local mini design-system.** Catalyst / DS primitives first, then HIS charts, then
  the preserved reserve-cockpit modules (F8). Reuse before create; never a homemade
  component that duplicates an existing primitive.
- **No cage-in-cage.** One material per logical block (`DS_SHELL_CONTRACT.md` §2). The
  admin double frame (F6) is resolved, not layered over.
- **No glow on content panels.** Ambient light lives at shell level only
  (`DS_SHELL_CONTRACT.md` §5).

### Global `--ct-surface-card` retune — deferred, on purpose

Retuning `--ct-surface-card` from `#000000` to a rising graphite would fix ~20 admin pages
in one token. **It is not done in the rebuild pass**: the blast radius is the whole admin
surface, which is not a dashboard mission. Recorded here as an explicit follow-up decision
for Adrien. Until then, new dashboard cards consume `--ct-surface-raised` and the rest of
admin is untouched.

---

## 5. Unavailable-state rule

The current screens are honest and unreadable at the same time. The rule that fixes it:

- **One compact state per surface**, not per cell.
- **Clear label** — what is missing, in investor/operator words.
- **Reason as sub-text or detail**, at the smallest text tier, once.
- **Never the headline value.** A KPI whose read is unavailable shows an empty value slot
  (em dash) plus a single quiet motive — it does not print the motive in display type.
- **Never repeated identically** across a band. If every KPI in a group shares one motive,
  the group carries the motive once, at group level.
- The adapter's ops vocabulary (env vars, deploy steps) stays off investor surfaces.

`Series1Wired`'s reason vocabulary (`REASON_LABELS`) is correct and is kept. Its
*rendering* is what changes.

---

## 6. Delete map

Decisions: **DELETE** · **REPLACE** · **KEEP DATA ONLY** · **KEEP SHELL ONLY** ·
**KEEP DS PRIMITIVE** · **REWRITE**.

### `/dashboard` — investor

| File / component | Current role | Problem | Decision |
|---|---|---|---|
| `src/app/(product)/dashboard/page.tsx` | route, composes everything | zinc grammar, raw hex `#a7fb90:214`, motive as headline (F3) | **REWRITE** |
| `src/app/(product)/dashboard/_view.ts` | pocket labels, policy bps, `wiredMetric` | pure helpers, correct; only `wiredMetric`'s dosage changes | **KEEP DATA ONLY** |
| `src/app/(product)/dashboard/layout.tsx` | `w-full min-w-0` wrapper | trivial, still needed | **KEEP SHELL ONLY** |
| `Series1KpiBand.tsx` | hero + 6 KPI cells | **spreadsheet grid (F2)** — `gap-px bg-white/10` | **DELETE** |
| `Series1ChartPlaceholder.tsx` | empty chart well | raw hex (F7), never renders a real series while HIS charts exist (F8) | **REPLACE** |
| `Series1Panel.tsx` / `Series1Page.tsx` | panel + section grammar | zinc + `dark:`, panel darker than page (F1) | **REPLACE** |
| `Series1Wired.tsx` | `Wired<T>` → pixels | vocabulary right, rendering wrong (F3) | **KEEP DATA ONLY** |
| `Series1Timeline.tsx` | capital-flow steps | raw hex `:20`; `StepTimeline` primitive exists | **REPLACE** |
| `Series1Shell.tsx` / `Series1Nav.tsx` | investor shell + rail | structurally canon (KYC `SidebarLayout`); rail carries raw hex `:61` | **KEEP SHELL ONLY** (de-hex) |
| `series1-tokens.css` | `.s1-row-list`, `.s1-chart-well` | bespoke namespace outside `--ct-*` | **DELETE** |
| `reserve-cockpit/*` (8 modules) | preserved Hearst viz | built, token-only, honest states — 7 of 8 unused (F8) | **KEEP DS PRIMITIVE** |
| `components/dataviz/his/*` (10 charts) | HIS chart primitives | canon data-viz layer | **KEEP DS PRIMITIVE** |
| `investor-ui/components/states/data-states.tsx` | honest empty states | already the right pattern | **KEEP DS PRIMITIVE** |
| `src/lib/chain/dynavault.ts`, `wired-view.ts` | server-only chain reads | the single passage point (F9) | **KEEP DATA ONLY** |

### `/admin/dashboard` — operator

| File / component | Current role | Problem | Decision |
|---|---|---|---|
| `src/app/admin/dashboard/page.tsx` | route, 6 parallel loaders | fixture-vault scope (F5), passes APY/yield props | **REWRITE** |
| `src/app/admin/dashboard/dashboard.css` | 264 lines page-scoped CSS | mostly dead selectors of a retired cockpit grid | **DELETE** |
| `dashboard/assets-board.tsx` | the whole board | hardcoded green status pills (F4), fixture model (F5) | **DELETE** |
| `dashboard/system-readiness.tsx` | readiness module | **fabricated `99.98%` uptime + render-time "last scan" (F4)** | **REWRITE** |
| `dashboard/platform-overview-band.tsx` | Capital / Clients / Governance / Exposure | content survives, surface and grammar do not | **REWRITE** |
| `dashboard/distribution-strip.tsx` | exposure sub-strip | bound to the overview band | **REWRITE** |
| `dashboard/allocation-orbit.tsx` | allocation donut | fixture-model bound; `HcCompositionRing` exists | **REPLACE** |
| `dashboard/nav-slot.tsx` | NAV 30d bars | fixture-model bound; HIS charts exist | **REPLACE** |
| `dashboard/risk-summary-card.tsx` | 5-factor risk | `risk.band` = retired yield model (F5) | **REPLACE** |
| `dashboard/dashboard-recent-events.tsx` | rebalance log | rebalance vocabulary, fixture-bound | **REPLACE** |
| `dashboard/market-prices-panel.tsx` | BTC/ETH spot, real Binance read | honest, live, reusable | **KEEP** |
| `dashboard/admin-kpi-strip-panel.tsx`, `kpi-strip.tsx` | canon KPI strip | shared by 10+ admin pages | **KEEP DS PRIMITIVE** |
| `dashboard/admin-leaf-link.tsx` | "View full →" | shared by proofs / proof-center | **KEEP DS PRIMITIVE** |
| `admin/admin-page-shell.tsx`, `admin-page-header.tsx` | admin shell + H1 | double frame vs `SidebarLayout` (F6) — resolve, do not layer | **KEEP SHELL ONLY** |
| `src/lib/admin/dashboard-*.ts` | view resolvers (pure) | correct seam; inputs change, shape stays | **KEEP DATA ONLY** |
| `src/lib/data/*` loaders (`cockpit`, `platform-totals`, `overview-clusters`, `admin-overview`) | real Prisma aggregates | honest, reusable | **KEEP DATA ONLY** |
| `src/lib/vaults/dashboard-scope.ts` | fixture vault pills | the retired yield model (F5) | **REPLACE** |

---

## 7. Target architecture

### Investor — `src/components/series1-dashboard/` (new)

```
Series1Dashboard.tsx            composition root
Series1DashboardHero.tsx        dominant read: accumulated BTC + term
Series1MetricDeck.tsx           replaces the spreadsheet KPI band (F2)
Series1DataState.tsx            the one compact unavailable state (§5)
Series1BitcoinAccumulation.tsx  wraps BtcAccumulationCurve (F8)
Series1MiningRegister.tsx       wraps MiningActivityTimeline (F8)
Series1CapitalArchitecture.tsx  wraps CapitalFlowRail + PocketAllocationVisual (F8)
Series1DashboardSection.tsx     section grammar
```

`series1-shell/` stays what its name says: shell + rail only. The dashboard body moves out
of it.

### Admin — `src/components/admin/dashboard/` (existing path, rewritten)

```
AdminDashboard.tsx              composition root
AdminDashboardHero.tsx          posture as the dominant read
AdminReadinessPanel.tsx         readiness WITHOUT fabricated stats (F4)
AdminOperatingGrid.tsx          Capital | Clients | Governance | Exposure
AdminDomainCard.tsx             one domain cluster
AdminRiskStrip.tsx              exposure/risk, Series-1 vocabulary
AdminDashboardSection.tsx       section grammar
```

**Deviation from the mission's proposed `src/components/admin-dashboard/`, justified:**
`src/components/admin/` is the established admin grouping, referenced by `admin-crm.css`,
by the admin canon guards and by 20 other admin pages. A top-level `admin-dashboard/`
would be the only admin component folder outside `admin/`. Keeping the path costs nothing
and preserves every existing reference.

---

## 8. Layout rule

- **One shell** (`SidebarLayout`), **one rail**, one `<main>` per document.
- Pages are composed of **sections**, not of a grid of equal technical cells.
- **No spreadsheet grids** (F2): no `gap-px` divider grids, no 1px rules standing in for
  layout.
- **No horizontal scroll** at page level; wide content scrolls locally inside its own
  container.
- `min-w-0` on every flex/grid child that can hold wide content (enforced by
  `admin-visual-frame.test.ts`).
- **Content max-width is a canon/token decision, never an isolated utility class.**
  `sidebar-layout.tsx` must NOT receive a magic `max-w-[1600px]`. If the shell needs a
  content cap, it is introduced as a `--ct-*` token, applied at shell level, and recorded
  here — not as a one-off class on a shared primitive. *(A `mx-auto w-full max-w-[1600px]`
  edit was proposed on 2026-07-22 and deliberately reverted for this reason. The need may
  be real; the form was not.)*
- **Hero KPI typography is fixed and token-driven, not fluid.** The hero number uses
  `--ct-text-display-fixed` (32px) or `--ct-text-hero` (40px), never a fluid
  `text-4xl sm:text-5xl` ramp. *(This intent was captured from a 2026-07-22 edit to
  `Series1KpiBand.tsx` that was reverted because that component is DELETE — the rule
  survives here, the churn does not.)*

---

## 9. Next mission prompt (copy-paste ready)

```
MISSION MAIN — RECODE /dashboard AND /admin/dashboard FROM ZERO USING CANON

RÈGLE ABSOLUE : Earth = Hearst.
MAIN ONLY. NO BRANCH. NO WORKTREE. NO STASH.

Repo : /Users/adrienbeyondcrypto/Dev/Hearst Corporation/connect — Hearst Defi
Canon : docs/front-dashboard-zero-rebuild-canon.md — le lire ENTIÈREMENT d'abord.

PHASE 0 — SAFETY
git status --short · git rev-parse --short HEAD origin/main
Tree dirty → STOP, rapporter, ne rien stash/reset/restore.

PHASE 1 — INVESTOR /dashboard
Créer src/components/series1-dashboard/ :
  Series1Dashboard · Series1DashboardHero · Series1MetricDeck · Series1DataState
  Series1BitcoinAccumulation · Series1MiningRegister · Series1CapitalArchitecture
  Series1DashboardSection
Réécrire src/app/(product)/dashboard/page.tsx pour les composer.
Supprimer : Series1KpiBand.tsx · series1-tokens.css
Remplacer : Series1ChartPlaceholder · Series1Panel · Series1Page · Series1Timeline
Garder : _view.ts · Series1Wired (vocabulaire) · Series1Shell · Series1Nav (dé-hexer)
Réutiliser : reserve-cockpit (8 modules) · dataviz/his (10 charts) · data-states.tsx

PHASE 2 — ADMIN /admin/dashboard
Réécrire src/components/admin/dashboard/ :
  AdminDashboard · AdminDashboardHero · AdminReadinessPanel · AdminOperatingGrid
  AdminDomainCard · AdminRiskStrip · AdminDashboardSection
Réécrire src/app/admin/dashboard/page.tsx.
Supprimer : assets-board.tsx · dashboard.css
Garder : market-prices-panel · admin-kpi-strip-panel · kpi-strip · admin-leaf-link
Garder les loaders réels (cockpit, platform-totals, overview-clusters, admin-overview).
Abandonner le modèle fixture-vault (APY / yieldPosture / risk.band).
Résoudre le double cadre AdminPageShell vs SidebarLayout (F6) — sans empiler.

INTERDITS (non négociables)
- pas de zinc-*, pas de dark:, pas de hex brut (#a7fb90 inclus)
- pas de --ct-surface-card / #000 sur une card
- pas de vert/emerald comme matière ou fond
- pas de valeur fabriquée (uptime, last scan, pastille verte non calculée)
- pas de vocabulaire APY / yield / LTV / collateral / Morpho / leverage
- pas d'import @/lib/data/* , Prisma, viem ou ethers dans src/app/(product)/dashboard/**
- pas de max-w magique sur sidebar-layout.tsx
- pas de grille gap-px façon tableur
- pas de nouveau mini design-system local

ROUTES À VÉRIFIER
http://localhost:4105/dashboard
http://localhost:4105/admin/dashboard

SEARCHS
grep -rn "#a7fb90\|text-zinc-\|dark:\|surface-card" src/components/series1-dashboard src/components/admin/dashboard
grep -rn "lib/data\|@prisma\|viem\|ethers" "src/app/(product)/dashboard"
grep -rn "99.98\|statusTone=\"ok\"" src/components/admin/dashboard

GATES
pnpm typecheck
pnpm lint
pnpm test
node scripts/ds-layout-audit.mjs   (aucune nouvelle entrée sur les dossiers dashboard)

TESTS À METTRE À JOUR
src/components/admin/__tests__/dashboard-assets-board.test.tsx
src/components/admin/dashboard/__tests__/risk-summary-card.test.tsx

COMMIT ATTENDU
feat(front): rebuild investor and admin dashboards from canon
Push origin main, tree clean, local running sur :4105.
```

---

## 10. Open decisions for Adrien

1. **Global `--ct-surface-card` retune** (`#000000` → rising graphite). Fixes ~20 admin
   pages in one token; deliberately out of the rebuild's scope. §4.
2. **Shell content max-width.** Is a cap wanted at all? If yes, it becomes a `--ct-*`
   token applied at shell level, recorded in §8 — not a class on `sidebar-layout.tsx`.
3. **`/admin/dashboard` canon opt-in.** The route is currently allowlisted out of
   `admin-canon-start-pattern.test.ts`. The rebuild may remove that exemption and mount
   the canon shell like every other admin page.
