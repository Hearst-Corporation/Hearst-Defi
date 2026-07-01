# Strategy Builder — Persistence Proposal

Status: **Proposal** (no migration applied). Owner: Product / Backend.
Scope: persistence design for the strategy builder + 24-month scenario runner.

This document proposes a Prisma/Postgres schema for the strategy builder and the
scenario runner. **Nothing here is wired to the database yet.** The `.sql` and
Prisma blocks are a design target only — do not run a migration off this file
without the explicit level‑C checkpoint described in the migration plan below.

---

## 1. Current storage decision — config is the source of truth

The strategy builder and the 24‑month scenario runner ship as **typed config**,
not database rows:

- Strategy definitions: `src/lib/product-strategies/` — `ProductStrategy` and its
  sub‑types (`ProductStrategyScenario`, `ScenarioAllocation`, `ScenarioAssumptions`,
  `ScenarioConstraints`, `StrategySelectionRules`) in
  `src/lib/product-strategies/types.ts`.
- Scenario runner: `src/lib/scenario-runner/` — `CollateralConfig`,
  `RebalancingRule` / `RebalancingAction`, `ManualProjectionConfig`,
  `ScenarioReport`, `MonthlySnapshot`, `MonthlyEvent` in
  `src/lib/scenario-runner/types.ts`. The runner is a **pure, deterministic**
  function (no DB, no fetch, no I/O, no `Math.random` — a seeded PRNG is injected),
  consistent with the engine‑purity non‑negotiable.

**Decision:** the admin strategy editor operates on **local state + preview only**.
It reads the seeded strategies from `src/lib/product-strategies`, lets an admin
edit allocations, assumptions, constraints, and rebalancing rules in memory, and
runs the scenario runner against that in‑memory config to render a preview report.
**No row is written.** There is currently no Prisma model, no table, and no
Server Action that persists a strategy or a projection run.

Until the tables below exist, **the config in `src/lib/` IS the source of truth.**
Any strategy an admin "saves" today lives only for the lifetime of the editor
session; to make a strategy durable, edit the seed config in `src/lib/`.

Units carried by the config (must be preserved by the schema):

- Allocations, targets, ratios, LTVs, APRs → **basis points** (`Int`, 1% = 100 bps).
- Money → **USDC** amounts. BTC → whole coins.
- Volatility → plain fraction on the TS side (`btcAnnualVol`,
  `volatilityMultiplier`); persisted as bps to stay integer‑only in the DB.

---

## 2. Proposed Prisma / Postgres schema

The repo uses **Prisma + Supabase Postgres** in production and **SQLite** for local
dev; the Prisma `provider` is swapped at build time. The DDL below targets
Postgres (prod). For SQLite dev, `jsonb` degrades to `TEXT` and `numeric`/`Decimal`
to `REAL`/`TEXT` — Prisma handles this, so the **Prisma block is the portable
definition** and the raw SQL is the Postgres reference.

Conventions:

- Table + column names in **snake_case**; Prisma models use `@@map` / `@map`.
- Basis points → `Int` (`@db.Integer`). Money → `Decimal @db.Decimal(20,6)` for
  USDC amounts (6‑dp, matches USDC), BTC → `Decimal @db.Decimal(20,8)`.
  Counters that are always whole (`horizon_months`, `month`, `priority`) → `Int`.
- Timestamps → `DateTime @db.Timestamptz(6)`, `created_at` default `now()`.
- Free‑form structured fields (`narrative_bullets`, `input_json`, `report_json`)
  → `Json @db.Jsonb`.
- All FKs `onDelete: Cascade` from parent (a run's snapshots/events die with it;
  a strategy's scenarios/rules/collateral die with it).

### 2.1 `strategy_configs`

Top‑level strategy. Maps `ProductStrategy` (minus the nested scenario/rules/
collateral, which are their own tables).

```prisma
model StrategyConfig {
  id                   String   @id @default(cuid())
  slug                 String   @unique
  name                 String
  description          String
  status               String   // "draft" | "active" | "archived"
  productFamily        String   @map("product_family") // btc_mining | stable_income | btc_upside | defi_yield | generic
  defaultRiskProfile   String   @map("default_risk_profile") // safe | balanced | opportunistic
  defaultHorizonMonths Int      @map("default_horizon_months") // 12 | 24 | 36
  defaultPriority      String   @map("default_priority") // monthly_income | capital_protection | btc_upside | total_return | liquidity
  isFallback           Boolean  @default(false) @map("is_fallback")
  createdAt            DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt            DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  scenarios  StrategyScenario[]
  collateral StrategyCollateralConfig[]
  rules      StrategyRebalancingRule[]
  runs       StrategyProjectionRun[]

  @@index([status])
  @@index([productFamily])
  @@map("strategy_configs")
}
```

```sql
CREATE TABLE strategy_configs (
  id                     TEXT PRIMARY KEY,
  slug                   TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  description            TEXT NOT NULL,
  status                 TEXT NOT NULL,                      -- draft | active | archived
  product_family         TEXT NOT NULL,                      -- btc_mining | stable_income | btc_upside | defi_yield | generic
  default_risk_profile   TEXT NOT NULL,                      -- safe | balanced | opportunistic
  default_horizon_months INTEGER NOT NULL,                   -- 12 | 24 | 36
  default_priority       TEXT NOT NULL,                      -- monthly_income | capital_protection | btc_upside | total_return | liquidity
  is_fallback            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ(6) NOT NULL
);
CREATE INDEX strategy_configs_status_idx         ON strategy_configs (status);
CREATE INDEX strategy_configs_product_family_idx ON strategy_configs (product_family);
```

### 2.2 `strategy_scenarios`

One row per risk scenario (`safe` / `balanced` / `opportunistic`) of a strategy.
Flattens `ScenarioAllocation` + `ScenarioAssumptions`; `narrativeBullets` kept as
JSONB. Volatility fractions are stored as bps (`btc_annual_vol_bps`,
`vol_multiplier_bps`).

```prisma
model StrategyScenario {
  id                       String @id @default(cuid())
  strategyId               String @map("strategy_id")
  scenario                 String // safe | balanced | opportunistic
  miningBps                Int    @map("mining_bps")
  btcBps                   Int    @map("btc_bps")
  stableReserveBps         Int    @map("stable_reserve_bps")
  yieldOverlayBps          Int    @map("yield_overlay_bps")
  horizonMonths            Int    @map("horizon_months")
  btcAnnualVolBps          Int    @map("btc_annual_vol_bps")
  volMultiplierBps         Int    @map("vol_multiplier_bps")
  distributionTargetLowBps  Int?  @map("distribution_target_low_bps")
  distributionTargetHighBps Int?  @map("distribution_target_high_bps")
  totalPerformanceLowBps    Int?  @map("total_performance_low_bps")
  totalPerformanceHighBps   Int?  @map("total_performance_high_bps")
  floorBps                 Int?   @map("floor_bps")
  narrativeBullets         Json   @default("[]") @map("narrative_bullets") @db.Jsonb

  strategy StrategyConfig @relation(fields: [strategyId], references: [id], onDelete: Cascade)

  @@unique([strategyId, scenario])
  @@index([strategyId])
  @@map("strategy_scenarios")
}
```

```sql
CREATE TABLE strategy_scenarios (
  id                           TEXT PRIMARY KEY,
  strategy_id                  TEXT NOT NULL REFERENCES strategy_configs (id) ON DELETE CASCADE,
  scenario                     TEXT NOT NULL,                 -- safe | balanced | opportunistic
  mining_bps                   INTEGER NOT NULL,
  btc_bps                      INTEGER NOT NULL,
  stable_reserve_bps           INTEGER NOT NULL,
  yield_overlay_bps            INTEGER NOT NULL,
  horizon_months               INTEGER NOT NULL,
  btc_annual_vol_bps           INTEGER NOT NULL,
  vol_multiplier_bps           INTEGER NOT NULL,
  distribution_target_low_bps  INTEGER,
  distribution_target_high_bps INTEGER,
  total_performance_low_bps    INTEGER,
  total_performance_high_bps   INTEGER,
  floor_bps                    INTEGER,
  narrative_bullets            JSONB NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT strategy_scenarios_strategy_scenario_uq UNIQUE (strategy_id, scenario)
);
CREATE INDEX strategy_scenarios_strategy_id_idx ON strategy_scenarios (strategy_id);
```

### 2.3 `strategy_collateral_configs`

Maps `CollateralConfig`. `collateralAsset` / `borrowAsset` kept as text
(currently `"BTC"` / `"USDC"`) for forward flexibility. BTC amounts `Decimal(20,8)`,
USDC amounts `Decimal(20,6)`, ratios/LTVs/APR as bps `Int`.

```prisma
model StrategyCollateralConfig {
  id                        String  @id @default(cuid())
  strategyId                String  @map("strategy_id")
  collateralAsset           String  @default("BTC")  @map("collateral_asset")
  borrowAsset               String  @default("USDC") @map("borrow_asset")
  initialBtcCollateral      Decimal @map("initial_btc_collateral")   @db.Decimal(20, 8)
  initialDebtUsdc           Decimal @map("initial_debt_usdc")        @db.Decimal(20, 6)
  initialReserveUsdc        Decimal? @map("initial_reserve_usdc")    @db.Decimal(20, 6)
  liquidationLtvBps         Int     @map("liquidation_ltv_bps")
  targetSafetyBufferBps     Int     @map("target_safety_buffer_bps")
  targetRiskLtvBps          Int     @map("target_risk_ltv_bps")
  borrowAprBps              Int     @map("borrow_apr_bps")
  electricityMonthlyCostUsdc Decimal @map("electricity_monthly_cost_usdc") @db.Decimal(20, 6)
  minReserveUsdc            Decimal @map("min_reserve_usdc")         @db.Decimal(20, 6)
  maxBtcExposureBps         Int     @map("max_btc_exposure_bps")

  strategy StrategyConfig @relation(fields: [strategyId], references: [id], onDelete: Cascade)

  @@index([strategyId])
  @@map("strategy_collateral_configs")
}
```

```sql
CREATE TABLE strategy_collateral_configs (
  id                            TEXT PRIMARY KEY,
  strategy_id                   TEXT NOT NULL REFERENCES strategy_configs (id) ON DELETE CASCADE,
  collateral_asset              TEXT NOT NULL DEFAULT 'BTC',
  borrow_asset                  TEXT NOT NULL DEFAULT 'USDC',
  initial_btc_collateral        NUMERIC(20, 8) NOT NULL,
  initial_debt_usdc             NUMERIC(20, 6) NOT NULL,
  initial_reserve_usdc          NUMERIC(20, 6),
  liquidation_ltv_bps           INTEGER NOT NULL,
  target_safety_buffer_bps      INTEGER NOT NULL,
  target_risk_ltv_bps           INTEGER NOT NULL,
  borrow_apr_bps                INTEGER NOT NULL,
  electricity_monthly_cost_usdc NUMERIC(20, 6) NOT NULL,
  min_reserve_usdc              NUMERIC(20, 6) NOT NULL,
  max_btc_exposure_bps          INTEGER NOT NULL
);
CREATE INDEX strategy_collateral_configs_strategy_id_idx ON strategy_collateral_configs (strategy_id);
```

### 2.4 `strategy_rebalancing_rules`

Maps `RebalancingRule` + its nested `RebalancingAction` (flattened onto the row).
`type` ∈ `LIQUIDATE | REPURCHASE`; `action_side` ∈ `SELL_BTC | BUY_BTC | REPAY_DEBT | HOLD`;
`sizing_mode` ∈ `PERCENT_OF_BTC_COLLATERAL | PERCENT_OF_USDC_RESERVE | FIXED_BTC | FIXED_USDC`.
`value` (trigger threshold) and `sizing_value` are context‑dependent (bps for
PERCENT_* / ratio triggers, absolute for FIXED_* / price triggers) so they are
stored as `Decimal(20,8)` to hold both a bps integer and an absolute BTC/USDC
amount without loss.

```prisma
model StrategyRebalancingRule {
  id                   String  @id @default(cuid())
  strategyId           String  @map("strategy_id")
  scenario             String  // safe | balanced | opportunistic
  type                 String  // LIQUIDATE | REPURCHASE
  priority             Int
  triggerMetric        String  @map("trigger_metric") // BTC_PRICE | LTV | LIQUIDATION_DISTANCE | PORTFOLIO_DRAWDOWN | TARGET_ENTRY_PRICE | MONTH
  operator             String  // <= | >= | < | > | ==
  value                Decimal @db.Decimal(20, 8)
  actionSide           String  @map("action_side") // SELL_BTC | BUY_BTC | REPAY_DEBT | HOLD
  sizingMode           String  @map("sizing_mode")  // PERCENT_OF_BTC_COLLATERAL | PERCENT_OF_USDC_RESERVE | FIXED_BTC | FIXED_USDC
  sizingValue          Decimal @map("sizing_value") @db.Decimal(20, 8)
  repayDebtRatioBps    Int?    @map("repay_debt_ratio_bps")
  maxLtvAfterActionBps Int?    @map("max_ltv_after_action_bps")
  cooldownMonths       Int?    @map("cooldown_months")
  maxExecutions        Int?    @map("max_executions")
  enabled              Boolean @default(true)

  strategy StrategyConfig @relation(fields: [strategyId], references: [id], onDelete: Cascade)

  @@index([strategyId])
  @@index([strategyId, scenario])
  @@map("strategy_rebalancing_rules")
}
```

```sql
CREATE TABLE strategy_rebalancing_rules (
  id                        TEXT PRIMARY KEY,
  strategy_id               TEXT NOT NULL REFERENCES strategy_configs (id) ON DELETE CASCADE,
  scenario                  TEXT NOT NULL,                    -- safe | balanced | opportunistic
  type                      TEXT NOT NULL,                    -- LIQUIDATE | REPURCHASE
  priority                  INTEGER NOT NULL,
  trigger_metric            TEXT NOT NULL,                    -- BTC_PRICE | LTV | LIQUIDATION_DISTANCE | PORTFOLIO_DRAWDOWN | TARGET_ENTRY_PRICE | MONTH
  operator                  TEXT NOT NULL,                    -- <= | >= | < | > | ==
  value                     NUMERIC(20, 8) NOT NULL,
  action_side               TEXT NOT NULL,                    -- SELL_BTC | BUY_BTC | REPAY_DEBT | HOLD
  sizing_mode               TEXT NOT NULL,                    -- PERCENT_OF_BTC_COLLATERAL | PERCENT_OF_USDC_RESERVE | FIXED_BTC | FIXED_USDC
  sizing_value              NUMERIC(20, 8) NOT NULL,
  repay_debt_ratio_bps      INTEGER,
  max_ltv_after_action_bps  INTEGER,
  cooldown_months           INTEGER,
  max_executions            INTEGER,
  enabled                   BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX strategy_rebalancing_rules_strategy_id_idx          ON strategy_rebalancing_rules (strategy_id);
CREATE INDEX strategy_rebalancing_rules_strategy_scenario_idx    ON strategy_rebalancing_rules (strategy_id, scenario);
```

### 2.5 `strategy_projection_runs`

A persisted scenario‑runner execution. `input_json` captures the exact
`CollateralConfig` + `RebalancingRule[]` + `ManualProjectionConfig` that produced
the run (reproducibility — the runner is deterministic given a seed);
`report_json` captures the full `ScenarioReport`. The headline aggregates from
`ScenarioReport` are also columnised for querying.

```prisma
model StrategyProjectionRun {
  id                       String   @id @default(cuid())
  strategyId               String   @map("strategy_id")
  inputJson                Json     @map("input_json")  @db.Jsonb
  reportJson               Json     @map("report_json") @db.Jsonb
  finalRoiBps              Int      @map("final_roi_bps")
  minLiquidationDistanceBps Int     @map("min_liquidation_distance_bps")
  totalBtcSold             Decimal  @map("total_btc_sold")        @db.Decimal(20, 8)
  totalBtcBought           Decimal  @map("total_btc_bought")      @db.Decimal(20, 8)
  totalDebtRepaidUsdc      Decimal  @map("total_debt_repaid_usdc") @db.Decimal(20, 6)
  createdAt                DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  strategy  StrategyConfig               @relation(fields: [strategyId], references: [id], onDelete: Cascade)
  snapshots StrategyProjectionSnapshot[]
  events    StrategyProjectionEvent[]

  @@index([strategyId])
  @@index([createdAt])
  @@map("strategy_projection_runs")
}
```

```sql
CREATE TABLE strategy_projection_runs (
  id                           TEXT PRIMARY KEY,
  strategy_id                  TEXT NOT NULL REFERENCES strategy_configs (id) ON DELETE CASCADE,
  input_json                   JSONB NOT NULL,
  report_json                  JSONB NOT NULL,
  final_roi_bps                INTEGER NOT NULL,
  min_liquidation_distance_bps INTEGER NOT NULL,
  total_btc_sold               NUMERIC(20, 8) NOT NULL,
  total_btc_bought             NUMERIC(20, 8) NOT NULL,
  total_debt_repaid_usdc       NUMERIC(20, 6) NOT NULL,
  created_at                   TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);
CREATE INDEX strategy_projection_runs_strategy_id_idx ON strategy_projection_runs (strategy_id);
CREATE INDEX strategy_projection_runs_created_at_idx   ON strategy_projection_runs (created_at);
```

### 2.6 `strategy_projection_snapshots`

One row per `MonthlySnapshot` of a run (its `events[]` live in
`strategy_projection_events`). Money `Decimal`, LTV/distance bps `Int`, `month` `Int`.

```prisma
model StrategyProjectionSnapshot {
  id                     String  @id @default(cuid())
  runId                  String  @map("run_id")
  month                  Int
  btcPrice               Decimal @map("btc_price")             @db.Decimal(20, 6)
  btcCollateral          Decimal @map("btc_collateral")        @db.Decimal(20, 8)
  collateralValueUsdc    Decimal @map("collateral_value_usdc") @db.Decimal(20, 6)
  debtUsdc               Decimal @map("debt_usdc")             @db.Decimal(20, 6)
  reserveUsdc            Decimal @map("reserve_usdc")          @db.Decimal(20, 6)
  ltvBps                 Int     @map("ltv_bps")
  liquidationDistanceBps Int     @map("liquidation_distance_bps")
  netEquityUsdc          Decimal @map("net_equity_usdc")       @db.Decimal(20, 6)

  run StrategyProjectionRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@unique([runId, month])
  @@index([runId])
  @@map("strategy_projection_snapshots")
}
```

```sql
CREATE TABLE strategy_projection_snapshots (
  id                       TEXT PRIMARY KEY,
  run_id                   TEXT NOT NULL REFERENCES strategy_projection_runs (id) ON DELETE CASCADE,
  month                    INTEGER NOT NULL,
  btc_price                NUMERIC(20, 6) NOT NULL,
  btc_collateral           NUMERIC(20, 8) NOT NULL,
  collateral_value_usdc    NUMERIC(20, 6) NOT NULL,
  debt_usdc                NUMERIC(20, 6) NOT NULL,
  reserve_usdc             NUMERIC(20, 6) NOT NULL,
  ltv_bps                  INTEGER NOT NULL,
  liquidation_distance_bps INTEGER NOT NULL,
  net_equity_usdc          NUMERIC(20, 6) NOT NULL,
  CONSTRAINT strategy_projection_snapshots_run_month_uq UNIQUE (run_id, month)
);
CREATE INDEX strategy_projection_snapshots_run_id_idx ON strategy_projection_snapshots (run_id);
```

### 2.7 `strategy_projection_events`

One row per `MonthlyEvent` emitted in a run. `rule_id` references the originating
rule's identifier (stored as text — it may be a config‑seeded rule id or a
persisted `strategy_rebalancing_rules.id`; **not a hard FK** so that a run's
history survives a rule being edited or deleted).

```prisma
model StrategyProjectionEvent {
  id          String  @id @default(cuid())
  runId       String  @map("run_id")
  month       Int
  ruleId      String  @map("rule_id")
  type        String  // LIQUIDATE | REPURCHASE
  side        String  // SELL_BTC | BUY_BTC | REPAY_DEBT | HOLD
  btcDelta    Decimal @map("btc_delta")    @db.Decimal(20, 8)
  debtRepaid  Decimal @map("debt_repaid")  @db.Decimal(20, 6)
  reason      String

  run StrategyProjectionRun @relation(fields: [runId], references: [id], onDelete: Cascade)

  @@index([runId])
  @@index([runId, month])
  @@map("strategy_projection_events")
}
```

```sql
CREATE TABLE strategy_projection_events (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES strategy_projection_runs (id) ON DELETE CASCADE,
  month       INTEGER NOT NULL,
  rule_id     TEXT NOT NULL,
  type        TEXT NOT NULL,                                  -- LIQUIDATE | REPURCHASE
  side        TEXT NOT NULL,                                  -- SELL_BTC | BUY_BTC | REPAY_DEBT | HOLD
  btc_delta   NUMERIC(20, 8) NOT NULL,
  debt_repaid NUMERIC(20, 6) NOT NULL,
  reason      TEXT NOT NULL
);
CREATE INDEX strategy_projection_events_run_id_idx       ON strategy_projection_events (run_id);
CREATE INDEX strategy_projection_events_run_month_idx    ON strategy_projection_events (run_id, month);
```

---

## 3. Migration plan (do not break prod)

Prod DB is Supabase Postgres, deployed by Vercel on `push main`. These tables are
**purely additive** — new tables, no column drops, no renames, no changes to any
existing model — so introducing them cannot break an existing route or query.

1. **Additive only.** Add the seven models to `prisma/schema.prisma` in one
   named migration (`pnpm db:migrate --name strategy_builder_persistence`). No
   edit to any existing table. `prisma/schema.prisma` is a single‑owner file —
   the change goes through the integrator, not a worker.
2. **Dev first.** `pnpm db:push` against SQLite `dev.db`, regenerate the client
   (`pnpm db:generate`), run `pnpm typecheck` + `pnpm test`. Then apply the same
   migration to Supabase via the direct connection (port **5432**, not the 6543
   pooler — the pooler hangs on DDL).
3. **Backfill is optional.** The `src/lib/` seed strategies can be imported into
   `strategy_configs` (+ children) with an idempotent seed script keyed on `slug`.
   Until that runs, **the config in `src/lib/` remains the source of truth** and
   the reader falls back to it when a slug is absent from the DB.
4. **Reads follow the canonical mutation pattern.** No client‑side data fetching:
   static config / DB row → Server Component query. Writes go through the
   repo's canonical path (`docs/BACKEND_CONTEXT.md`):

   `Server Action → requireAdmin → rate-limit → Zod validate → mutate in $transaction → audit log → revalidatePath`.

   A strategy write touches parent + children, so the whole write is a single
   `$transaction` (strategy + scenarios + collateral + rules), then audited, then
   `revalidatePath` on the affected admin routes.
5. **No purity regression.** The scenario runner stays pure (`src/lib/scenario-runner`
   does no I/O). Persistence lives in the Server Action layer only: it *calls* the
   pure runner, then writes the returned `ScenarioReport` into
   `strategy_projection_runs` / `_snapshots` / `_events`. The engine never touches
   Prisma.
6. **Compliance guard unchanged.** `narrative_bullets`, `disclaimers`, and any
   human‑facing text persisted here stay subject to the existing output‑side
   compliance guard (forbidden words, APY‑as‑range). No guaranteed‑return wording
   enters these tables.

Rollback: because the change is additive, a revert is a `DROP TABLE` of the seven
tables (children first) with zero impact on existing prod data.

---

## 4. Server Actions to add later

To be added under the admin surface once the tables exist, each following the
canonical `requireAdmin → rate-limit → Zod → $transaction → audit → revalidatePath`
pattern:

- **`createStrategy`** — insert a `strategy_configs` row + its three
  `strategy_scenarios`, `strategy_collateral_configs`, and `strategy_rebalancing_rules`
  in one `$transaction`. `status` defaults to `"draft"`.
- **`updateStrategy`** — update a strategy and replace/patch its scenarios,
  collateral, and rules atomically; bumps `updated_at`.
- **`duplicateStrategy`** — deep‑copy an existing strategy (new `id` + new unique
  `slug`) with its children, as a fresh `"draft"`.
- **`archiveStrategy`** — set `status = "archived"` (soft‑delete; never a hard
  row delete, to preserve any linked projection‑run history).
- **`saveProjectionRun`** — run the pure scenario runner on a strategy's config,
  then persist the result: one `strategy_projection_runs` row + N
  `strategy_projection_snapshots` + M `strategy_projection_events` in a single
  `$transaction`.

---

*This is a design proposal. No `prisma/schema.prisma` change, no migration, and no
Server Action has been created. The config in `src/lib/product-strategies` and
`src/lib/scenario-runner` remains the source of truth until the plan above is
executed under an explicit checkpoint.*
