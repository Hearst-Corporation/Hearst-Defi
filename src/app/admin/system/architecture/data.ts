// DECLARATIVE map of the strategy platform (strategy.hearst.app) — every
// `declared` value below is a HAND-MAINTAINED assertion, last verified
// 2026-07-22. Nothing in this file is probed at runtime; the page banner says
// so, and the badges render as "Declared …" so a declaration can never be
// read as a measured system status.
//
// `probePath` is the ONE exception: for nodes that name a route of THIS repo
// (/admin/*, /api/health) it carries the repo-relative path the page checks
// with fs.existsSync at render time. Existence is NOT health — the probe badge
// says "Present on disk" / "Missing", never "Live".
export type NodeStatus = "Live" | "Partial" | "Planned" | "Blocked" | "Not configured";

export interface ArchNode {
  id: string;
  name: string;
  description?: string;
  /** Hand-maintained assertion (see file header) — a declaration, not a probe. */
  declared: NodeStatus;
  /** Repo-relative path in THIS repo probed with fs.existsSync (existence ≠ health). */
  probePath?: string;
}

export interface ArchZone {
  id: string;
  letter: string;
  name: string;
  description?: string;
  nodes: ArchNode[];
}

export const ARCHITECTURE_DATA: ArchZone[] = [
  {
    id: "interfaces",
    letter: "A",
    name: "Interfaces & Operators",
    nodes: [
      { id: "admin-team", name: "Admin / Strategy Team", description: "human operators", declared: "Live" },
      { id: "investor-surface", name: "Investor surface", description: "future surface — nothing built", declared: "Planned" },
      { id: "browser", name: "Browser", description: "https://strategy.hearst.app", declared: "Live" },
    ],
  },
  {
    id: "product-modules",
    letter: "B",
    name: "Product Modules — Next.js UI",
    nodes: [
      { id: "overview", name: "Overview", description: "/admin", declared: "Live", probePath: "src/app/admin" },
      // The five nodes below were declared Live/Partial for routes that do not
      // exist on disk (verified 2026-07-22: no src/app/admin/{cockpit,market,
      // yields,strategy-vision,vault-lab}). A system-status map that reports
      // "Live" for a route returning 404 is worse than no map — an operator
      // reads it to decide whether something is up. They are now "Planned",
      // which is what a route with no code is, and each carries a probePath so
      // the page shows the on-disk fact next to the declaration.
      { id: "vault-cockpit", name: "Vault Cockpit", description: "/admin/cockpit — no route on disk", declared: "Planned", probePath: "src/app/admin/cockpit" },
      { id: "strategy-vision", name: "Strategy Vision", description: "/admin/strategy-vision — no route on disk", declared: "Planned", probePath: "src/app/admin/strategy-vision" },
      { id: "market", name: "Market", description: "/admin/market — no route on disk", declared: "Planned", probePath: "src/app/admin/market" },
      { id: "yields", name: "Protocol rates", description: "planned protocol-rates module — no route on disk", declared: "Planned", probePath: "src/app/admin/yields" },
      { id: "vault-lab", name: "Vault Lab", description: "/admin/vault-lab — no route on disk", declared: "Planned", probePath: "src/app/admin/vault-lab" },
      { id: "system", name: "System", description: "/admin/system", declared: "Live", probePath: "src/app/admin/system" },
      { id: "architecture-map", name: "Architecture map", description: "/admin/system/architecture — this page", declared: "Live", probePath: "src/app/admin/system/architecture" },
      { id: "strategy-builder", name: "Strategy Builder", description: "no UI exists — DB schema only", declared: "Planned" },
    ],
  },
  {
    id: "api-layer",
    letter: "C",
    name: "API Layer — Next.js routes",
    nodes: [
      // Same verification as zone B: of the eight API paths these three nodes
      // named, only /api/health exists. /api/vault/* was deleted with the
      // frontend's duplicate read path; /api/market, /api/protocol-rates,
      // /api/rates, /api/machines, /api/db/health and /api/workers/status have
      // never existed in this repo. Declarations now match the filesystem.
      { id: "vault-api", name: "Vault API", description: "/api/vault/* — removed (backend serves these)", declared: "Planned" },
      { id: "data-apis", name: "Data APIs", description: "/api/market · /api/protocol-rates · /api/rates · /api/machines — none on disk", declared: "Planned" },
      { id: "status-apis", name: "Status APIs", description: "/api/health only — /api/db/health and /api/workers/status do not exist", declared: "Partial", probePath: "src/app/api/health" },
    ],
  },
  {
    id: "engines",
    letter: "D",
    name: "Engines — pure, deterministic, in-process",
    nodes: [
      { id: "vault-engine-core", name: "Vault engine core", description: "simulate + allocation — pure, deterministic", declared: "Live" },
      { id: "backtest-fold", name: "Backtest fold", description: "replays real candles + real rates", declared: "Live" },
      { id: "monte-carlo", name: "Monte Carlo", description: "seeded · 50–2000 paths · in-process · not persisted", declared: "Live" },
      { id: "optimizer", name: "Optimizer", description: "grid-search policy · in-process · not persisted", declared: "Live" },
      { id: "stress-sensitivity", name: "Stress / sensitivity", description: "scenario shocks on the core", declared: "Live" },
      { id: "mining-economics", name: "Mining economics", description: "hashprice + cost model", declared: "Live" },
      { id: "strategy-vision-spec", name: "Strategy Vision spec", description: "authoritative document — not a compute engine", declared: "Partial" },
      { id: "approval-gate", name: "Approval gate", description: "data-coverage gate real · formal workflow not wired", declared: "Partial" },
    ],
  },
  {
    id: "execution-workers",
    letter: "E",
    name: "Execution / Workers — GPU1, systemd",
    nodes: [
      { id: "strategy-binance-worker", name: "strategy-binance-worker", description: "WS ingest · persist 5s/30s · heartbeat 15s", declared: "Live" },
      { id: "strategy-web", name: "strategy-web", description: "Next.js · port 3100 · systemd", declared: "Live" },
      { id: "strategy-rates-refresh", name: "strategy-rates-refresh.timer", description: "hourly Morpho/Aave/Compound refresh", declared: "Live" },
      { id: "strategy-backtest-worker", name: "strategy-backtest-worker", description: "unit disabled on GPU1 · worker code removed from repo", declared: "Blocked" },
      { id: "backtest-job-queue", name: "Backtest job queue", description: "backtest_jobs — DDL only · no producer · no consumer", declared: "Planned" },
    ],
  },
  {
    id: "persistence",
    letter: "F",
    name: "Persistence — Postgres (Docker :5433, GPU1)",
    nodes: [
      { id: "market-data", name: "Market data", description: "market_prices · market_price_ticks · market_candles", declared: "Live" },
      { id: "yield-data", name: "Protocol rate data", description: "protocol_rates_latest · ticks · candles · rate_import_runs", declared: "Live" },
      { id: "vault-runs", name: "Vault runs", description: "vault_runs — the only run table actually written", declared: "Live" },
      { id: "ops", name: "Ops", description: "worker_heartbeats · data_sources", declared: "Live" },
      { id: "machines", name: "Machines", description: "machine_snapshots · machine_prices", declared: "Live" },
      { id: "vision", name: "Vision", description: "strategy_visions", declared: "Live" },
      { id: "strategy-lifecycle", name: "Strategy lifecycle foundation", description: "strategy_candidates · candidate_runs · decisions · backtest_runs/points/jobs/data_windows · monte_carlo_runs/trials · optimizer_runs/candidates · strategies · buckets · rules · admin_decisions — DDL only · 0 consumers", declared: "Planned" },
    ],
  },
  {
    id: "external-sources",
    letter: "G",
    name: "External Sources",
    nodes: [
      { id: "binance-ws", name: "Binance WS", description: "!ticker stream", declared: "Live" },
      { id: "binance-rest", name: "Binance REST", description: "klines / backfill", declared: "Live" },
      { id: "mempool", name: "mempool.space", description: "BTC difficulty", declared: "Live" },
      { id: "coingecko", name: "CoinGecko", description: "BTC spot", declared: "Live" },
      { id: "telegram", name: "Telegram @LetineSidonia", description: "machine prices via MTProto", declared: "Not configured" },
      { id: "morpho-graphql", name: "Morpho GraphQL", description: "blue-api — key-free by default", declared: "Live" },
      { id: "defillama", name: "DefiLlama", description: "pool-rates API (llama.fi) — key-free · daily history", declared: "Live" },
      { id: "graph-aave", name: "The Graph → Aave v3", description: "gateway — needs GRAPH_API_KEY", declared: "Partial" },
      { id: "graph-compound", name: "The Graph → Compound v3", description: "subgraph id unverified", declared: "Planned" },
      { id: "historical-hourly", name: "Historical hourly rate source", description: "planned", declared: "Planned" },
    ],
  },
  {
    id: "protocol-asset",
    letter: "H",
    name: "Protocol / Asset Layer",
    nodes: [
      { id: "tracked-assets", name: "Tracked assets", description: "BTC ETH SOL BNB AVAX + USDC — via market feed", declared: "Live" },
      { id: "morpho-lending", name: "Morpho lending market", description: "rates observed via blue-api", declared: "Live" },
      { id: "aave-v3", name: "Aave v3", description: "not configured", declared: "Not configured" },
      { id: "compound-v3", name: "Compound v3", description: "not configured", declared: "Not configured" },
      { id: "vault-collateral", name: "Vault / collateral model", description: "wBTC collateral · USDC debt — modeled in engine, NOT on-chain", declared: "Live" },
      { id: "mining-fleet", name: "Mining fleet", description: "machine pricing live · cockpit module modeled — no live ops", declared: "Partial" },
    ],
  },
  {
    id: "deployment-infra",
    letter: "I",
    name: "Deployment Infra — GPU1",
    nodes: [
      { id: "gpu1-server", name: "GPU1 server", description: "WSL2 Ubuntu · Tailscale", declared: "Live" },
      { id: "systemd-units", name: "systemd units", description: "web · workers · timers", declared: "Live" },
      { id: "docker", name: "Docker", description: "strategy-postgres:5433 on GPU1", declared: "Live" },
      { id: "cloudflare-tunnel", name: "Cloudflare Tunnel", description: "→ strategy.hearst.app", declared: "Live" },
      { id: "deploy-path", name: "Deploy path", description: "git push → pull ff-only → Node 20 build → restart", declared: "Live" },
    ],
  },
];
