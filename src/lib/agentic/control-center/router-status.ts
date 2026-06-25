// Agentic Control Center v0 — router status (static, read-only).
//
// Reflects the Deterministic Intent Router v2 (ADR / docs:
// docs/agentic/DETERMINISTIC_INTENT_ROUTER_V2.md, PR #36) as wired into the
// chat route. This module DOES NOT import or run the router — it is a static
// description for visibility. If the router behavior changes, update this file.

import type { RouterStatusSummary } from "./types";

const ROUTER_STATUS: RouterStatusSummary = {
  deterministicRouterExists: true,
  version: "Deterministic Intent Router v2",
  status: "active",
  mode: "non-shadow",
  shadowFlag: {
    name: "AGENTIC_ROUTER_SHADOW",
    alive: false,
    notes:
      "Confirmed dead — zero references in src/. The router drives control flow directly; no shadow-only path remains.",
  },
  routerPaths: [
    {
      id: "navigation",
      label: "Navigation (read-only, route whitelist)",
      mode: "active",
      notes:
        "Publishes a nav event to a closed route whitelist; gated on !decision.negated so negated phrasing never publishes nav.",
    },
    {
      id: "negation",
      label: "Negation defence-in-depth",
      mode: "active",
      notes:
        "intent-router-negation.ts strips negated commands so \"ne montre pas les vaults\" is not treated as a nav/action request.",
    },
    {
      id: "dangerous-refusal",
      label: "Dangerous-action refusal",
      mode: "active",
      notes:
        "DANGEROUS_RULES classify financial/custodial/deploy asks as prohibited; the model is steered to refuse, never to execute.",
    },
    {
      id: "education-hint",
      label: "Educational read-only hint",
      mode: "active",
      notes:
        "EDUCATION_RULES set isEducationalReadOnly; prompt-only steering (buildEducationalReadOnlyDirective). Never relaxes the output guard.",
    },
    {
      id: "outreach",
      label: "Outreach (source / draft / send)",
      mode: "shadow",
      notes:
        "OUTREACH_RULES + SEND_SOURCE_RULES classified; execution stays behind HITL write tools, not auto-acted from the router.",
    },
    {
      id: "product-vault-draft",
      label: "Product / vault draft",
      mode: "shadow",
      notes:
        "PRODUCT_VAULT_RULES classified; create_vault_draft is draft-only and confirmation-gated, never auto-executed.",
    },
    {
      id: "reporting",
      label: "Reporting / memo",
      mode: "shadow",
      notes:
        "REPORTING_RULES classified for visibility; no autonomous report write from the chat.",
    },
    {
      id: "readiness",
      label: "Vault readiness / deploy safety",
      mode: "shadow",
      notes:
        "Readiness intents classified; promote/markAsLive/deploy are separate admin server actions, never chat tools.",
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
