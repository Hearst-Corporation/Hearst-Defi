/**
 * Live-read swarm stage registry — the typed source of truth for the six
 * product-construction stages. Pure metadata; the runner logic lives in
 * `runners.ts`. Every stage carries the full floor forbidden-action set so the
 * safety assertion (assert-live-safe.ts) holds for each one.
 */

import {
  LIVE_READ_FORBIDDEN_ACTIONS,
  type LiveSwarmStageDef,
} from "./types";

/** Shared floor — spread into every stage so none can ever reach a write/deploy. */
const FLOOR = [...LIVE_READ_FORBIDDEN_ACTIONS];

export const LIVE_SWARM_STAGES: readonly LiveSwarmStageDef[] = [
  {
    id: "telegram_pricing",
    label: "Telegram Pricing Swarm",
    description:
      "Reads the latest mining-machine price list from the configured Telegram channel, parses it, and prices each model (landed CAPEX + energy at the configured 6¢/kWh). Read-only.",
    mode: "live_read",
    capabilities: ["read_telegram", "compute"],
    forbiddenActions: FLOOR,
    safetyNotes: [
      "Reads a Telegram channel only — no message is sent, no chat is joined.",
      "Energy cost is the configured company lever (6¢/kWh), provenance Manual.",
      "Degrades to an empty fleet (Stale) if Telegram is not configured.",
    ],
  },
  {
    id: "market_live",
    label: "Market Live Swarm",
    description:
      "Fetches the live BTC price, the live mining hashprice ($/TH/day), and the DeFi USDC yield reference. Read-only market reads; no order, no transaction.",
    mode: "live_read",
    capabilities: ["read_market", "compute"],
    forbiddenActions: FLOOR,
    safetyNotes: [
      "Market reads only — never places an order or signs a transaction.",
      "Each datum carries Live/Stale provenance based on fetch success.",
    ],
  },
  {
    id: "strategy_cross",
    label: "Strategy Cross Swarm",
    description:
      "Crosses the machine economics with live market data and the in-place strategy levers (markup, revenue-share, borrow drag, fees) to derive the central mining/USDC/BTC blended APY range. Read + compute only.",
    mode: "live_read",
    capabilities: ["compute"],
    forbiddenActions: FLOOR,
    safetyNotes: [
      "Composition only — reuses the existing loadVaultApy aggregator.",
      "APY is emitted as a range; no single point, no return promised (#1).",
      "Company levers are CONFIGURED (not validated/live); provenance Manual.",
    ],
  },
  {
    id: "quant_montecarlo",
    label: "Quant Monte-Carlo Swarm",
    description:
      "Runs a seeded Monte-Carlo around the central estimate (BTC GBM + difficulty + blended yield) to produce p5/p25/p50/p75/p95 percentiles and P(below floor). PRNG seed is explicit and reproducible (ADR-006). Read + compute only.",
    mode: "live_read",
    capabilities: ["compute"],
    forbiddenActions: FLOOR,
    safetyNotes: [
      "Seeded PRNG — no Math.random; same seed ⇒ identical output (#6/#7).",
      "Headline stays a range [p25,p75]; MC only adds p5/p50/p95 (#1).",
      "No state mutated — purely a projection artifact (ADR-006).",
    ],
  },
  {
    id: "charts",
    label: "Charts Swarm",
    description:
      "Maps the numeric artifacts into renderable HIS chart specs (projection fan p5/p50/p95, allocation, value lines). No business math — bands are pre-computed upstream.",
    mode: "live_read",
    capabilities: ["render_artifact"],
    forbiddenActions: FLOOR,
    safetyNotes: [
      "Pure mapping to chart specs — invents no number.",
      "The fan band is info-tinted and seed-stamped, never 'guaranteed'.",
    ],
  },
  {
    id: "writeup",
    label: "Write-up Swarm",
    description:
      "Composes a long-form, institutional framing brief from the numeric artifacts. Prose is LLM-authored and passed through the output compliance guard (APY range, forbidden words). Read + compose only; draft text, no action.",
    mode: "live_read",
    capabilities: ["compose_prose_guarded"],
    forbiddenActions: FLOOR,
    safetyNotes: [
      "Prose is output-guarded: APY stays a range; no guarantee/promise language.",
      "Degrades to a deterministic template if the LLM is unavailable.",
      "Draft text only — nothing is created, sent, or deployed.",
    ],
  },
] as const;

export const LIVE_SWARM_STAGE_IDS = LIVE_SWARM_STAGES.map((s) => s.id);

export function getLiveSwarmStage(id: string): LiveSwarmStageDef | undefined {
  return LIVE_SWARM_STAGES.find((s) => s.id === id);
}
