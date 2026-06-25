// Reporting Crew Read-Only v0 — shared types (pure, client-safe).
//
// A deterministic, read-only BRIEFING composed from data the platform already
// produces (control-center registry, router observability, quality review, tool
// boundary, gates, safety). NOT CrewAI, NOT an autonomous runtime: no tool is
// executed, no write is performed, nothing is stored. Pure types — no I/O.

import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";
import type { RouterObservabilitySummary } from "@/lib/agentic/observability/types";

/** Severity of a briefing signal (drives the badge tone only). */
export type ReportingCrewSignalSeverity = "healthy" | "info" | "watch" | "alert";

/** Overall briefing status, derived from the worst section signal. */
export type ReportingCrewStatus = "healthy" | "watch" | "alert" | "no_data";

/** One read-only signal: a named observation worth an admin's attention. */
export interface ReportingCrewSignal {
  id: string;
  title: string;
  severity: ReportingCrewSignalSeverity;
  detail: string;
  /** Where the signal was derived from (a section/source label, read-only). */
  source: string;
}

/** One headline metric in a section (a label + a formatted value). */
export interface ReportingCrewMetric {
  id: string;
  label: string;
  value: string;
  detail?: string;
}

/** One briefing section: a summary line + metrics + signals. */
export interface ReportingCrewSection {
  id: string;
  title: string;
  summary: string;
  metrics: ReportingCrewMetric[];
  signals: ReportingCrewSignal[];
}

/** The read-only briefing the admin renders. */
export interface ReportingCrewBriefing {
  /** Static marker (NOT a live timestamp — pure code has no Date.now). */
  generatedAt: string;
  mode: "read_only";
  status: ReportingCrewStatus;
  /** One-paragraph plain-language executive summary. */
  executiveSummary: string;
  sections: ReportingCrewSection[];
  /** Short list of read-only follow-up checks. NEVER a write/dangerous action. */
  recommendedReadOnlyChecks: string[];
  /** Constant safety notes rendered verbatim. */
  safetyNotes: string[];
}

/**
 * The read-only inputs the briefing composes. Both come from existing accessors:
 *  - controlCenter: getAgenticControlCenterData() (pure, sync)
 *  - observability: getRouterObservabilitySummary() (best-effort; null on failure)
 * No tool handler, no LLM, no write is ever invoked to build these.
 */
export interface ReportingCrewInputs {
  controlCenter: AgenticControlCenterData;
  /** Null when the observability read failed / is unavailable (honest no_data). */
  observability: RouterObservabilitySummary | null;
}
