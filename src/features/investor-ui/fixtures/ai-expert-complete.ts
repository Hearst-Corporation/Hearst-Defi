// src/features/investor-ui/fixtures/ai-expert-complete.ts
//
// AI-experts advisory fixture — 4 read-only advisory roles surfaced on the
// Dashboard rail (Portfolio Strategist, BTC Reserve Analyst, Mining Operations
// Expert, Risk & Compliance Expert). ADVISORY ONLY: no write tool, no
// autonomous execution lives behind this fixture (CLAUDE.md non-negotiable #4,
// ADR-012/ADR-017). Mirrors the `AiExpertViewModel` aggregate shape from
// `types/ai-expert.ts`; the per-role breakdown below is Dashboard-page
// presentation, composed on top of that one aggregate signal.

import { fixtureBlock, fixtureUnresolved, FIXTURE_GENERATED_AT } from "./factories";
import type { AiExpertResolvedViewModel, AiExpertViewModel } from "../types/ai-expert";

export const aiExpertCompleteFixture: AiExpertResolvedViewModel = fixtureBlock<AiExpertViewModel>({
  activeExperts: 4,
  lastSignalAt: "2026-07-16T07:30:00.000Z",
  lastSignalSummary:
    "BTC reserve trajectory tracking within the take-profit band — no rebalancing signal this cycle.",
});

export const aiExpertUnavailableFixture: AiExpertResolvedViewModel =
  fixtureUnresolved<AiExpertViewModel>("UNAVAILABLE", {
    freshness: "unavailable",
  });

/** Per-role advisory rail rows — Dashboard-page-only shape, not part of the
 *  shared AiExpertViewModel aggregate (kept local until a second screen needs
 *  the same per-role breakdown). */
export interface AiExpertRoleFixture {
  readonly id: string;
  readonly role: string;
  readonly specialty: string;
  readonly lastInsight: string;
  readonly freshness: string;
  readonly state: "active" | "idle" | "unavailable";
}

export const AI_EXPERT_ROLES: readonly AiExpertRoleFixture[] = [
  {
    id: "portfolio-strategist",
    role: "Portfolio Strategist",
    specialty: "Position sizing & capital allocation",
    lastInsight: "Allocation sits within 1pp of target across all three pockets.",
    freshness: "as of a moment ago",
    state: "active",
  },
  {
    id: "btc-reserve-analyst",
    role: "BTC Reserve Analyst",
    specialty: "BTC pouch trajectory & take-profit tracking",
    lastInsight: "Accumulation on pace for the +24% take-profit band by month 24.",
    freshness: "as of a moment ago",
    state: "active",
  },
  {
    id: "mining-operations-expert",
    role: "Mining Operations Expert",
    specialty: "Fleet uptime, curtailment & hashrate efficiency",
    lastInsight: "Fleet active, no curtailment recorded this reporting period.",
    freshness: "as of yesterday",
    state: "active",
  },
  {
    id: "risk-compliance-expert",
    role: "Risk & Compliance Expert",
    specialty: "KYC/whitelist status & lock-up monitoring",
    lastInsight: "No open compliance flags on this position.",
    freshness: "as of yesterday",
    state: "idle",
  },
] as const;

export const FIXTURE_GENERATED_AT_AI_EXPERT = FIXTURE_GENERATED_AT;
