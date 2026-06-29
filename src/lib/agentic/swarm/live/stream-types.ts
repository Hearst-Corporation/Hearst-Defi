/**
 * Streamed product-construction — frame contract (shared client/server).
 *
 * The Product Workspace runs FIVE named specialist steps SEQUENTIALLY and streams
 * one NDJSON frame per transition. Unlike the retired construction-report (which
 * computed everything in one POST and faked a 300ms reveal), each step here is a
 * REAL `await`: the frame is emitted only when that specialist's work actually
 * finishes. Provenance is the genuine source state — a degraded/unavailable step
 * is surfaced honestly, never papered over with a fabricated number.
 *
 * Pure types — no I/O. The server orchestrator (stream-orchestrator.ts) emits
 * these; the client stepper (construction-stepper.tsx) consumes them.
 */

import type { LiveProvenance, ProductConstructionDraft } from "./types";

/** The five named specialists, in fixed running order. */
export type ConstructionStepId =
  | "bitcoin"
  | "hashprice"
  | "mining_infra"
  | "defi"
  | "data_scientist";

/**
 * Per-step lifecycle status.
 *   - running     : the specialist is working (frame `step_start`).
 *   - live        : finished on genuinely live/fresh data.
 *   - degraded    : finished, but the live source was stale / a fallback was used.
 *   - unavailable : the source is not configured / did not respond — NO number is
 *                   presented as real (honest empty).
 *   - error       : the step threw (never fabricated).
 */
export type ConstructionStepStatus =
  | "running"
  | "live"
  | "degraded"
  | "unavailable"
  | "error";

/** Static metadata for a step (persona + role), keyed by id. */
export interface ConstructionStepMeta {
  id: ConstructionStepId;
  index: number;
  /** Human persona shown as the step title. */
  persona: string;
  /** One-line description of what this specialist does. */
  role: string;
}

/** The five steps, in order. Names are the personas Adrien defined. */
export const CONSTRUCTION_STEPS: readonly ConstructionStepMeta[] = [
  {
    id: "bitcoin",
    index: 1,
    persona: "Bitcoin Price Specialist",
    role: "Reads the live BTC reference price (oracle, then spot).",
  },
  {
    id: "hashprice",
    index: 2,
    persona: "Hashprice Specialist",
    role: "Derives the live mining hashprice ($/TH/day) and network difficulty.",
  },
  {
    id: "mining_infra",
    index: 3,
    persona: "Mining Infrastructure Specialist",
    role: "Prices machines (landed cost: ex-works + freight + customs) and margins.",
  },
  {
    id: "defi",
    index: 4,
    persona: "DeFi Specialist",
    role: "Sources the best stable / BTC yields and the BTC scenario band.",
  },
  {
    id: "data_scientist",
    index: 5,
    persona: "Data Scientist",
    role: "Writes the thesis, charts the projection, and sizes the allocation (+2 versions).",
  },
] as const;

/** One labelled metric a step reports. */
export interface StepMetric {
  label: string;
  value: string;
}

/** Emitted when a specialist starts working. */
export interface StepStartFrame {
  type: "step_start";
  step: ConstructionStepId;
}

/** Emitted when a specialist finishes (success, degraded, or unavailable). */
export interface StepDoneFrame {
  type: "step_done";
  step: ConstructionStepId;
  status: Exclude<ConstructionStepStatus, "running">;
  /** Genuine provenance of the data this step produced (null when unavailable). */
  provenance: LiveProvenance | null;
  /** One-line headline result. */
  headline: string;
  /** Key metrics for the step card. */
  metrics: StepMetric[];
  /** Honesty note shown when degraded / unavailable (e.g. "Telegram not configured"). */
  note?: string;
}

/** Emitted once after the data-scientist step — the full assembled draft. */
export interface FinalFrame {
  type: "final";
  draft: ProductConstructionDraft;
}

/** Emitted on a hard failure (the construction could not produce a draft). */
export interface ErrorFrame {
  type: "error";
  message: string;
}

export type ConstructionStreamFrame =
  | StepStartFrame
  | StepDoneFrame
  | FinalFrame
  | ErrorFrame;
