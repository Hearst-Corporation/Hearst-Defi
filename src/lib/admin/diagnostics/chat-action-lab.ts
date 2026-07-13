/**
 * Chat Action Lab — retired probe (honest stub).
 *
 * This lab used to exercise the REAL deterministic agentic intent router
 * (`classifyAgenticIntent` from `@/lib/agentic/intent-router`) to demonstrate, in
 * a dry run, how the cockpit chat routed critical prompts BEFORE any LLM call:
 *
 *   prompt → expected route → actual route → routing source → LLM used? →
 *   page opened → writes → records → external send → HITL → verdict.
 *
 * That deterministic router has been REMOVED. There is no runtime left to probe,
 * so the lab cannot classify anything. Per the honesty invariant of the Live
 * Diagnostic Center, this file does NOT fabricate PASS rows or invent routing
 * decisions for a capability that no longer exists — it reports the removal
 * plainly (one WARN row) and keeps its exported surface stable for the admin
 * page + API route + result components that consume it.
 *
 * When/if a replacement routing layer lands, restore the scenario matrix against
 * that new runtime instead of resurrecting the deleted symbols.
 */

// ── public result shapes (stable contract for the admin UI + API) ───────────

export type ChatActionVerdict = "PASS" | "FAIL" | "WARN";
export type RoutingSource = "deterministic" | "deterministic-nav" | "llm-fallback";

/** The legible, non-JSON row a single scenario produces. */
export interface ChatActionResult {
  id: string;
  prompt: string;
  role: "admin" | "lp";
  /** Expected route/gate label, human readable. */
  expected: string;
  /** What the router actually resolved, human readable. */
  actual: string;
  routingSource: RoutingSource;
  llmUsed: boolean;
  /** Page that would open, or the gate/refusal label. */
  pageOrAction: string;
  writes: string[];
  records: string[];
  externalSend: boolean;
  hitl: boolean;
  verdict: ChatActionVerdict;
  /** Where the behavior comes from (file/function), for the admin to look. */
  likelySource: string;
  /** Per-dimension notes (empty on PASS). */
  mismatches: string[];
}

export interface ChatActionLabReport {
  ok: boolean;
  mode: "dry-run";
  llmUsed: false;
  externalSideEffects: false;
  dbWrites: "none";
  results: ChatActionResult[];
  summary: { total: number; pass: number; warn: number; fail: number };
}

// ── honest "removed capability" row ─────────────────────────────────────────

const ROUTER_REMOVED_ROW: ChatActionResult = {
  id: "chat-action-lab.router-removed",
  prompt: "(no scenario evaluated)",
  role: "admin",
  expected: "deterministic intent-router classification per scenario",
  actual:
    "Retired — the deterministic agentic intent router (classifyAgenticIntent) was removed; the lab has no runtime to probe.",
  // With the deterministic router gone, no prompt is routed by rules anymore —
  // every turn falls through to the LLM. This is the honest post-removal state,
  // not a fabricated routing decision.
  routingSource: "llm-fallback",
  llmUsed: false,
  pageOrAction: "n/a — router removed",
  writes: [],
  records: [],
  externalSend: false,
  hitl: false,
  verdict: "WARN",
  likelySource: "@/lib/agentic/intent-router (deleted)",
  mismatches: [
    "The @/lib/agentic/intent-router module was deleted — this probe is not applicable until a replacement routing layer exists.",
  ],
};

/**
 * Build the honest lab report. Pure; no I/O, no LLM, no DB. Returns a single
 * WARN row that reports the router removal instead of pretending to route.
 *
 * The `scenarios` parameter is retained for call-site compatibility but is
 * ignored — there is no runtime to evaluate scenarios against.
 */
export function runChatActionLab(): ChatActionLabReport {
  const results = [ROUTER_REMOVED_ROW];
  return {
    ok: true,
    mode: "dry-run",
    llmUsed: false,
    externalSideEffects: false,
    dbWrites: "none",
    results,
    summary: { total: results.length, pass: 0, warn: 1, fail: 0 },
  };
}
