/**
 * Advisory-signal types for the /portfolio/preview sandbox.
 *
 * Shape of one read-only advisory signal: observe → signal → recommend a human review. It NEVER
 * executes (no approve/reject/execute affordance exists). Evidence numbers carry a provenance kind
 * and come from loaders/engine — agent prose can never populate the Evidence slot. Consumed by
 * AdvisoryFeed (the one-line activity feed) and the mock data. Types only, no runtime, no tokens.
 */
import type { Provenance } from "@/components/ui/provenance-badge";

export type SignalSeverity = "green" | "amber" | "red" | "info";
export type SignalStatus =
  | "observed"
  | "review-suggested"
  | "acknowledged"
  | "resolved";

export interface SignalEvidence {
  label: string;
  value: string;
  provenance: Provenance;
}

export interface AgentSignal {
  agent: string;
  area: string;
  severity: SignalSeverity;
  /** One-line rebalancing-focused summary for the compact advisory list. */
  headline: string;
  /** Relative timestamp for the activity feed (e.g. "2m ago"). */
  observedAt: string;
  /** Free prose signal (Mining/Risk/Data-Quality). Use `ptai` instead for Treasury/Distribution. */
  signal?: string;
  ptai?: {
    projection: string;
    trigger: string;
    action: string;
    impact: string;
  };
  evidence: readonly SignalEvidence[];
  suggestedReview: string;
  reviewHref: string;
  impactedModule: string;
  status: SignalStatus;
  /** e.g. "Advisory · Attested evidence". */
  advisoryLabel: string;
  disclaimer: string;
}
