export type NodeStatus = "Live" | "Partial" | "Planned" | "Blocked" | "Not configured";

export interface ArchNode {
  id: string;
  name: string;
  description?: string;
  status: NodeStatus;
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
      { id: "admin-team", name: "Admin / Strategy Team", description: "human operators", status: "Live" },
      { id: "investor-surface", name: "Investor surface", description: "future surface — nothing built", status: "Planned" },
      { id: "browser", name: "Browser", description: "https://strategy.hearst.app", status: "Live" },
    ],
  },
  {
    id: "product-modules",
    letter: "B",
    name: "Product Modules — Next.js UI",
    nodes: [
      { id: "overview", name: "Overview", description: "/admin", status: "Live" },
      // The five nodes below were declared Live/Partial for routes that do not
      // exist on disk (verified 2026-07-22: no src/app/admin/{cockpit,market,
      // yields,strategy-vision,vault-lab}). A system-status map that reports
      // "Live" for a route returning 404 is worse than no map — an operator
      // reads it to decide whether something is up. They are now "Planned",
      // which is what a route with no code is.
      { id: "vault-cockpit", name: "Vault Cockpit", description: "/admin/cockpit — no route on disk", status: "Planned" },
      { id: "strategy-vision", name: "Strategy Vision", description: "/admin/strategy-vision — no route on disk", status: "Planned" },
      { id: "market", name: "Market", description: "/admin/market — no route on disk", status: "Planned" },
      { id: "yields", name: "Yields", description: "/admin/yields — no route on disk", status: "Planned" },
      { id: "vault-lab", name: "Vault Lab", description: "/admin/vault-lab — no route on disk", status: "Planned" },
      { id: "system", name: "System", description: "/admin/system", status: "Live" },
      { id: "architecture-map", name: "Architecture map", description: "/admin/system/architecture — this page", status: "Live" },
      { id: "strategy-builder", name: "Strategy Builder", description: "no UI exists — DB schema only", status: "Planned" },
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
      // never existed in this repo. Statuses now match the filesystem.
      { id: "vault-api", name: "Vault API", description: "/api/vault/* — removed (backend serves these)", status: "Planned" },
      { id: "data-apis", name: "Data APIs", description: "/api/market · /api/protocol-rates · /api/rates · /api/machines — none on disk", status: "Planned" },
      { id: "status-apis", name: "Status APIs", description: "/api/health only — /api/db/health and /api/workers/status do not exist", status: "Partial" },
    ],
  },
  {
    id: "engines",
    letter: "D",
    name: "Engines — pure, deterministic, in-process",
    nodes: [
      { id: "vault-engine-core", name: "Vault engine core", description: "simulate + allocation — pure, deterministic", status: "Live" },
      { id: "backtest-fold", name: "Backtest fold", description: "replays real candles + real rates", status: "Live" },
      { id: "monte-carlo", name: "Monte Carlo", description: "seeded · 50–2000 paths · in-process · not persisted", status: "Live" },
      { id: "optimizer", name: "Optimizer", description: "grid-search policy · in-process · not persisted", status: "Live" },
      { id: "stress-sensitivity", name: "Stress / sensitivity", description: "scenario shocks on the core", status: "Live" },
      { id: "mining-economics", name: "Mining economics", description: "hashprice + cost model", status: "Live" },
      { id: "strategy-vision-spec", name: "Strategy Vision spec", description: "authoritative document — not a compute engine", status: "Partial" },
      { id: "approval-gate", name: "Approval gate", description: "data-coverage gate real · formal workflow not wired", status: "Partial" },
    ],
  },
  {
    id: "execution-workers",
    letter: "E",
    name: "Execution / Workers — GPU1, systemd",
    nodes: [
      { id: "strategy-binance-worker", name: "strategy-binance-worker", description: "WS ingest · persist 5s/30s · heartbeat 15s", status: "Live" },
      { id: "strategy-web", name: "strategy-web", description: "Next.js · port 3100 · systemd", status: "Live" },
      { id: "strategy-rates-refresh", name: "strategy-rates-refresh.timer", description: "hourly Morpho/Aave/Compound refresh", status: "Live" },
      { id: "strategy-backtest-worker", name: "strategy-backtest-worker", description: "unit disabled on GPU1 · worker code removed from repo", status: "Blocked" },
      { id: "backtest-job-queue", name: "Backtest job queue", description: "backtest_jobs — DDL only · no producer · no consumer", status: "Planned" },
    ],
  },
  {
    id: "persistence",
    letter: "F",
    name: "Persistence — Postgres (Docker :5433, GPU1)",
    nodes: [
      { id: "market-data", name: "Market data", description: "market_prices · market_price_ticks · market_candles", status: "Live" },
      { id: "yield-data", name: "Yield data", description: "protocol_rates_latest · ticks · candles · rate_import_runs", status: "Live" },
      { id: "vault-runs", name: "Vault runs", description: "vault_runs — the only run table actually written", status: "Live" },
      { id: "ops", name: "Ops", description: "worker_heartbeats · data_sources", status: "Live" },
      { id: "machines", name: "Machines", description: "machine_snapshots · machine_prices", status: "Live" },
      { id: "vision", name: "Vision", description: "strategy_visions", status: "Live" },
      { id: "strategy-lifecycle", name: "Strategy lifecycle foundation", description: "strategy_candidates · candidate_runs · decisions · backtest_runs/points/jobs/data_windows · monte_carlo_runs/trials · optimizer_runs/candidates · strategies · buckets · rules · admin_decisions — DDL only · 0 consumers", status: "Planned" },
    ],
  },
  {
    id: "external-sources",
    letter: "G",
    name: "External Sources",
    nodes: [
      { id: "binance-ws", name: "Binance WS", description: "!ticker stream", status: "Live" },
      { id: "binance-rest", name: "Binance REST", description: "klines / backfill", status: "Live" },
      { id: "mempool", name: "mempool.space", description: "BTC difficulty", status: "Live" },
      { id: "coingecko", name: "CoinGecko", description: "BTC spot", status: "Live" },
      { id: "telegram", name: "Telegram @LetineSidonia", description: "machine prices via MTProto", status: "Not configured" },
      { id: "morpho-graphql", name: "Morpho GraphQL", description: "blue-api — key-free by default", status: "Live" },
      { id: "defillama", name: "DefiLlama", description: "yields.llama.fi — key-free · daily history", status: "Live" },
      { id: "graph-aave", name: "The Graph → Aave v3", description: "gateway — needs GRAPH_API_KEY", status: "Partial" },
      { id: "graph-compound", name: "The Graph → Compound v3", description: "subgraph id unverified", status: "Planned" },
      { id: "historical-hourly", name: "Historical hourly rate source", description: "planned", status: "Planned" },
    ],
  },
  {
    id: "protocol-asset",
    letter: "H",
    name: "Protocol / Asset Layer",
    nodes: [
      { id: "tracked-assets", name: "Tracked assets", description: "BTC ETH SOL BNB AVAX + USDC — via market feed", status: "Live" },
      { id: "morpho-lending", name: "Morpho lending market", description: "rates observed via blue-api", status: "Live" },
      { id: "aave-v3", name: "Aave v3", description: "not configured", status: "Not configured" },
      { id: "compound-v3", name: "Compound v3", description: "not configured", status: "Not configured" },
      { id: "vault-collateral", name: "Vault / collateral model", description: "wBTC collateral · USDC debt — modeled in engine, NOT on-chain", status: "Live" },
      { id: "mining-fleet", name: "Mining fleet", description: "machine pricing live · cockpit module modeled — no live ops", status: "Partial" },
    ],
  },
  {
    id: "deployment-infra",
    letter: "I",
    name: "Deployment Infra — GPU1",
    nodes: [
      { id: "gpu1-server", name: "GPU1 server", description: "WSL2 Ubuntu · Tailscale", status: "Live" },
      { id: "systemd-units", name: "systemd units", description: "web · workers · timers", status: "Live" },
      { id: "docker", name: "Docker", description: "strategy-postgres:5433 on GPU1", status: "Live" },
      { id: "cloudflare-tunnel", name: "Cloudflare Tunnel", description: "→ strategy.hearst.app", status: "Live" },
      { id: "deploy-path", name: "Deploy path", description: "git push → pull ff-only → Node 20 build → restart", status: "Live" },
    ],
  },
];
