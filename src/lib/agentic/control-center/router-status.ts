// Agentic Control Center — router status (static, read-only).
//
// Reflects the Deterministic Intent Router v2 (docs:
// docs/agentic/DETERMINISTIC_INTENT_ROUTER_V2.md, PR #36) as wired into the
// chat route. This module DOES NOT import or run the router — it is a static
// description for visibility. If the router behavior changes, update this file.

import type { RouterStatusSummary } from "./types";

const ROUTER_STATUS: RouterStatusSummary = {
  deterministicRouterExists: true,
  status: "active",
  mode: "non-shadow",
  version: "Deterministic Intent Router v2",
  shadowFlag: {
    name: "AGENTIC_ROUTER_SHADOW",
    alive: false,
    notes:
      "Confirmed dead — zero references in src/. The router drives control flow directly; no shadow-only path remains.",
  },
  routerPaths: [
    {
      id: "navigation",
      label: "Navigation fast-path (read-only, route whitelist)",
      mode: "active",
      notes:
        "kind==='navigation' + confidence>=0.7 + whitelisted routeKey → publishes nav and returns before the LLM. Gated on !decision.negated.",
    },
    {
      id: "negation",
      label: "Negation defence-in-depth",
      mode: "active",
      notes:
        "intent-router-negation.ts flips negated commands to cancellation/unknown; the legacy nav fallback is gated on !agenticDecision.negated, so \"ne montre pas les vaults\" never publishes nav.",
    },
    {
      id: "dangerous-refusal",
      label: "Dangerous-intent refusal before LLM/tool/write",
      mode: "active",
      notes:
        "actionPolicy==='refuse_autonomous' || prohibitedAutonomousAction → fixed refusal ack, no LLM call, no nav, no tool, no HITL token (deploy / sign / governance / migrate / send / source).",
    },
    {
      id: "education-hint",
      label: "Educational read-only steering",
      mode: "active",
      notes:
        "isEducationalReadOnly(decision) → buildEducationalReadOnlyDirective appended to the system prompt. Prompt-only steering; never relaxes the output guard.",
    },
    {
      id: "crew-runtime",
      label: "Full crew runtime / tool-execution orchestration",
      mode: "shadow",
      notes:
        "Not built. The console shows the surface only — there is no crew runtime, no autonomous tool orchestration.",
    },
    {
      id: "external-swarms",
      label: "External swarms / CrewAI",
      mode: "shadow",
      notes: "Not connected. No external agent framework is integrated.",
    },
  ],
  guardAssertions: [
    {
      id: "guard-not-bypassed",
      label: "Compliance guard not bypassed",
      holds: true,
      evidence:
        "The educational hint is PROMPT-only steering (system prompt). It never reaches the output guard.",
    },
    {
      id: "guard-no-intent-param",
      label: "No intent param in the guard → no structural bypass",
      holds: true,
      evidence:
        "chatOutputViolation(text, final?) takes no intent/context arg, so an \"educational\" turn cannot relax it.",
    },
    {
      id: "forbidden-words-blocked",
      label: "Forbidden words still blocked",
      holds: true,
      evidence: "containsForbiddenChat fires regardless of intent (output-guard.ts).",
    },
    {
      id: "guaranteed-yield-blocked",
      label: "Guaranteed yield still blocked",
      holds: true,
      evidence: "\"garanti\" / guaranteed-return phrasing is a forbidden-words violation, always.",
    },
    {
      id: "single-point-apy-blocked",
      label: "Single-point APY headline still blocked",
      holds: true,
      evidence:
        "hasSinglePointApy blocks a headline single point; only fourchettes + per-source breakdowns pass (apy-range.ts).",
    },
    {
      id: "no-hitl-token-on-refusal",
      label: "No HITL token minted on dangerous refusal",
      holds: true,
      evidence:
        "The dangerous-refusal path returns a fixed ack before the LLM — no tool, no write, no confirmation token.",
    },
  ],
  statusBlock: [
    "Status: active",
    "Mode: non-shadow",
    "Active paths:",
    "- navigation fast-path before LLM",
    "- negation protection",
    "- dangerous intent refusal before LLM/tool/write",
    "- educational read-only steering",
    "",
    "Legacy fallback:",
    "- retained",
    "- gated by negation",
    "",
    "Guard:",
    "- not bypassed",
    "- prompt steering only",
    "- forbidden/guaranteed/single-point APY still blocked",
  ],
  release: {
    lotStatus: "closed",
    mergeCommit: "bcb55f2c",
    mergePr: "#36",
    lockReleaseCommit: "49ce60cc",
    lockReleasePr: "#37",
    vercel: "ready",
    validations: [
      { id: "tests", label: "Full test suite", result: "3055/3055", pass: true },
      { id: "typecheck", label: "Typecheck", result: "PASS", pass: true },
      { id: "lint", label: "Lint", result: "0 errors", pass: true },
      { id: "build", label: "Production build", result: "PASS", pass: true },
      { id: "vercel", label: "Vercel", result: "READY", pass: true },
    ],
  },
  activePaths: [
    "Navigation fast-path before LLM",
    "Negation protection",
    "Dangerous intent refusal before LLM/tool/write",
    "Educational read-only steering",
  ],
  shadowOnlyPaths: [
    "Full Crew Runtime",
    "External swarms / CrewAI",
    "Tool execution orchestration",
  ],
  educationalSteering:
    "Active, prompt-only (buildEducationalReadOnlyDirective). Reinforces APY-range + no forbidden words + no personalized advice; never a guard relaxation.",
  dangerousIntentPolicy:
    "Refused BEFORE the LLM/tool/write. AGENTIC_ROUTER_SHADOW is removed (no refs) — the router is fully non-shadow.",
  guardPolicy:
    "Output guard is NOT bypassed: forbidden words + single-point APY headline stay hard-blocked on every human-facing surface, independent of intent.",
  paths: [
    "src/lib/agentic/intent-router.ts",
    "src/lib/agentic/intent-router-types.ts",
    "src/lib/agentic/intent-router-rules.ts",
    "src/lib/agentic/intent-router-normalize.ts",
    "src/lib/agentic/intent-router-negation.ts",
    "src/app/api/cockpit-chat/route.ts",
  ],
  legacyFallback: {
    status: "legacy",
    notes:
      "The legacy @hearst/cockpit-shell chat handler is retired (ADR-017). A deterministic nav fallback (src/lib/llm/nav-fallback-intent.ts) remains, gated on !decision.negated. The chat itself is kill-switched by CHAT_MASTER_AGENT (default ON; =0 disables, no fallback).",
  },
};

export function getRouterStatusSummary(): RouterStatusSummary {
  return ROUTER_STATUS;
}
