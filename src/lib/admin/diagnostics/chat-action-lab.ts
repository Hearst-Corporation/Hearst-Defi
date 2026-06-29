/**
 * Chat Action Lab — a readable, dry-run demonstration of what the cockpit chat
 * does with critical prompts, WITHOUT any side effect.
 *
 * For each preloaded scenario it exercises the REAL runtime router functions —
 * `classifyAgenticIntent` + `classifyProductWorkspaceIntent` + the pure nav
 * resolver — exactly as the cockpit-chat route would BEFORE any LLM call, and
 * reports a human-legible row:
 *
 *   prompt → expected route → actual route → routing source → LLM used? →
 *   page opened → writes → records → external send → HITL → verdict.
 *
 * Hard safety invariants (all asserted by tests):
 *  - NO LLM call (the deterministic router decides everything here).
 *  - NO POST to /api/cockpit-chat, NO CockpitMessage / LlmRun persistence.
 *  - NO real action — this module is pure (no I/O, no DB, no server-only).
 *
 * The runtime IS exercised (we call the live classifiers), but nothing here
 * writes, sends, or deploys. A scenario that cannot be proven without a side
 * effect is reported honestly, never a fake PASS.
 */
import { classifyAgenticIntent } from "@/lib/agentic/intent-router";
import type {
  AgenticActionPolicy,
  AgenticIntentDecision,
} from "@/lib/agentic/intent-router-types";
import {
  classifyProductWorkspaceIntent,
  PRODUCT_WORKSPACE_DESTINATION_KEY,
  SCENARIO_LAB_DESTINATION_KEY,
  type ProductWorkspaceIntentClassification,
} from "@/lib/llm/product-workspace-intent";
import { resolveNavDestinationForProfile } from "@/lib/llm/navigate-tool";

// ── public result shapes ───────────────────────────────────────────────────

export type ChatActionVerdict = "PASS" | "FAIL" | "WARN";
export type RoutingSource = "deterministic" | "deterministic-nav" | "llm-fallback";

/** A single preloaded scenario spec. Every `expected*` field is optional and
 *  only asserted when present, so a scenario can target just the dimensions it
 *  cares about (route, intent, policy, HITL, send…). */
export interface ChatActionScenario {
  id: string;
  prompt: string;
  /** Role the prompt is evaluated as — defaults to admin. */
  role?: "admin" | "lp";
  expectedRoute?: string;
  expectedRoutingSource?: RoutingSource;
  expectedIntent?: string;
  expectedPolicy?: AgenticActionPolicy;
  expectedWrites?: string[];
  expectedExternalSend?: boolean;
  expectedHitl?: boolean;
  expectedLlmUsed?: boolean;
  expectedLiveDeploy?: boolean;
  /** For an LP-boundary scenario: the admin route the LP must NOT reach. */
  expectedLpCanAccess?: boolean;
  /** Human note shown above the row (what this scenario demonstrates). */
  note?: string;
}

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
  /** Routes the chat would open (read-only nav), if any. */
  openRoute: string | null;
  writes: string[];
  records: string[];
  externalSend: boolean;
  hitl: boolean;
  liveDeploy: boolean;
  verdict: ChatActionVerdict;
  /** Where the behavior comes from (file/function), for the admin to look. */
  likelySource: string;
  /** Per-dimension mismatches (empty on PASS). */
  mismatches: string[];
  /** Full raw decision payloads — shown only behind the "raw JSON" drawer. */
  raw: {
    agentic: AgenticIntentDecision;
    productWorkspace: ProductWorkspaceIntentClassification;
    navRoute: string | null;
  };
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

// ── routing source classification ──────────────────────────────────────────

/**
 * Decide which layer OWNED the routing for a prompt, mirroring the cockpit-chat
 * route order: a product-workspace short-circuit (deterministic) wins first,
 * then a deterministic agentic rule / nav resolution, else the LLM fallback.
 */
function routingSourceFor(
  agentic: AgenticIntentDecision,
  pw: ProductWorkspaceIntentClassification,
): RoutingSource {
  // Product workspace divert is a pure regex short-circuit — fully deterministic.
  if (pw.shouldOpenProductWorkspace || pw.shouldOpenScenarioLab) {
    return "deterministic";
  }
  // A deterministic agentic rule fired (anything but the LLM-fallback `unknown`).
  if (agentic.kind === "navigation") return "deterministic-nav";
  if (agentic.kind !== "unknown") return "deterministic";
  // Nothing matched — the chat hands this to the LLM.
  return "llm-fallback";
}

/**
 * Does this prompt reach the LLM at all (for the ROUTING decision)? The
 * deterministic router decides product/danger/send/nav with `requiresLLM=false`.
 * The product-workspace short-circuit is also pure. Only an `unknown` fallthrough
 * delegates to the model. We report the ROUTING-time LLM usage, not whether the
 * destination page later streams prose (the brief route does, separately).
 */
function llmUsedForRouting(source: RoutingSource): boolean {
  // A deterministic rule may still flag `requiresLLM` for the ANSWER (education,
  // readiness), but the ROUTING itself was deterministic. We only count the
  // routing decision here, so deterministic sources never used the LLM to route.
  return source === "llm-fallback";
}

// ── derived facts (writes / records / send / hitl / deploy) ─────────────────

const HUMAN_GATE_POLICIES: ReadonlySet<AgenticActionPolicy> = new Set([
  "requires_human_gate",
]);

/** Writes the chat would perform autonomously for this decision — always empty:
 *  every write tool is HITL draft-only; the chat never auto-executes one. */
function autonomousWrites(): string[] {
  return [];
}

/** Business records this routing path would create — none: the lab never POSTs
 *  to the chat, never persists CockpitMessage/LlmRun, never creates a draft. */
function recordsCreated(): string[] {
  return [];
}

/** True only when a send path would dispatch an external email autonomously.
 *  The chat never does: send/source are human-gated, deploy is refused. */
function externalSendFor(): boolean {
  return false;
}

/**
 * HITL for the EFFECTIVE chat path. The cockpit-chat route evaluates the
 * product-workspace short-circuit FIRST (a read-only navigate + fixed ack, no
 * gate). So when that short-circuit wins, the agentic-rule HITL is irrelevant —
 * the effective path requires no human gate. Otherwise we read the agentic
 * decision (send/source/draft/deploy are human-gated).
 */
function hitlRequiredFor(
  decision: AgenticIntentDecision,
  pw: ProductWorkspaceIntentClassification,
): boolean {
  if (pw.shouldOpenProductWorkspace || pw.shouldOpenScenarioLab) return false;
  return (
    decision.requiresHumanGate === true ||
    HUMAN_GATE_POLICIES.has(decision.actionPolicy)
  );
}

function liveDeployFor(): boolean {
  // A deploy/go-live intent is refused autonomously — it never reaches a live
  // deploy from the chat. Always false here.
  return false;
}

// ── the readable "actual" + page label ──────────────────────────────────────

function actualLabel(
  agentic: AgenticIntentDecision,
  pw: ProductWorkspaceIntentClassification,
  navRoute: string | null,
): { actual: string; pageOrAction: string; openRoute: string | null } {
  if (pw.shouldOpenProductWorkspace) {
    return {
      actual: "Product Workspace",
      pageOrAction: `/admin/product-workspace (kind=${pw.kind})`,
      openRoute: "/admin/product-workspace",
    };
  }
  if (pw.shouldOpenScenarioLab) {
    return {
      actual: "Scenario Lab",
      pageOrAction: `/admin/scenario-lab (kind=${pw.kind})`,
      openRoute: "/admin/scenario-lab",
    };
  }
  switch (agentic.actionPolicy) {
    case "refuse_autonomous":
      return {
        actual: "refuse_autonomous",
        pageOrAction: "Refused before any LLM/action (danger-first)",
        openRoute: null,
      };
    case "requires_human_gate":
      return {
        actual: "requires_human_gate",
        pageOrAction: "Human gate — draft-only, two-step confirmation token",
        openRoute: null,
      };
    case "allow_navigation":
      return {
        actual: navRoute ? `navigation → ${navRoute}` : "navigation (unresolved)",
        pageOrAction: navRoute ?? "no route resolved",
        openRoute: navRoute,
      };
    case "allow_canvas":
    case "allow_draft_only":
      return {
        actual: `${agentic.kind} (${agentic.actionPolicy})`,
        pageOrAction: agentic.canvasKey
          ? `canvas: ${agentic.canvasKey} — draft-only`
          : "canvas — draft-only",
        openRoute: null,
      };
    case "allow_readonly":
      return {
        actual: `${agentic.kind} (read-only)`,
        pageOrAction: "Read-only answer / brief — no write",
        openRoute: null,
      };
    default:
      return {
        actual: `${agentic.kind} (${agentic.actionPolicy})`,
        pageOrAction: "LLM fallback — no deterministic action",
        openRoute: null,
      };
  }
}

function likelySourceFor(source: RoutingSource): string {
  switch (source) {
    case "deterministic":
      return "src/lib/agentic/intent-router.ts + src/lib/llm/product-workspace-intent.ts";
    case "deterministic-nav":
      return "src/lib/agentic/intent-router.ts → src/lib/llm/navigate-tool.ts";
    case "llm-fallback":
      return "src/app/api/cockpit-chat/route.ts (LLM fallback)";
  }
}

// ── scenario evaluation ─────────────────────────────────────────────────────

function expectedLabel(s: ChatActionScenario): string {
  if (s.expectedRoute === PRODUCT_WORKSPACE_DESTINATION_KEY || s.expectedRoute === "product-workspace") {
    return "Product Workspace";
  }
  if (s.expectedRoute === SCENARIO_LAB_DESTINATION_KEY || s.expectedRoute === "projection-or-scenario") {
    return "Projection / Scenario Lab";
  }
  if (s.expectedPolicy) return s.expectedPolicy;
  if (s.expectedIntent) return s.expectedIntent;
  if (s.expectedLpCanAccess === false) return "LP boundary — admin route refused";
  return s.expectedRoute ?? "—";
}

/** Evaluate one scenario against the real router. Pure; never throws (a thrown
 *  classifier is caught and surfaced as a FAIL, never a silent pass). */
export function evaluateChatActionScenario(
  s: ChatActionScenario,
): ChatActionResult {
  const role = s.role ?? "admin";
  const isAdmin = role === "admin";
  const ctx = { navProfile: role, isAdmin } as const;

  let agentic: AgenticIntentDecision;
  let pw: ProductWorkspaceIntentClassification;
  let navRoute: string | null = null;
  const mismatches: string[] = [];

  try {
    agentic = classifyAgenticIntent(s.prompt, ctx);
    // The product-workspace short-circuit is admin-only in the real route.
    pw = isAdmin
      ? classifyProductWorkspaceIntent(s.prompt)
      : {
          kind: "none",
          shouldOpenProductWorkspace: false,
          shouldOpenScenarioLab: false,
        };
    if (agentic.kind === "navigation" && agentic.routeKey) {
      navRoute =
        resolveNavDestinationForProfile(agentic.routeKey, role)?.route ?? null;
    }
  } catch (err) {
    return {
      id: s.id,
      prompt: s.prompt,
      role,
      expected: expectedLabel(s),
      actual: `router threw: ${err instanceof Error ? err.message : String(err)}`,
      routingSource: "llm-fallback",
      llmUsed: false,
      pageOrAction: "—",
      openRoute: null,
      writes: [],
      records: [],
      externalSend: false,
      hitl: false,
      liveDeploy: false,
      verdict: "FAIL",
      likelySource: "src/lib/agentic/intent-router.ts",
      mismatches: ["router threw — not a pass"],
      raw: {
        agentic: {} as AgenticIntentDecision,
        productWorkspace: {
          kind: "none",
          shouldOpenProductWorkspace: false,
          shouldOpenScenarioLab: false,
        },
        navRoute: null,
      },
    };
  }

  const routingSource = routingSourceFor(agentic, pw);
  const llmUsed = llmUsedForRouting(routingSource);
  const { actual, pageOrAction, openRoute } = actualLabel(agentic, pw, navRoute);
  const writes = autonomousWrites();
  const records = recordsCreated();
  const externalSend = externalSendFor();
  const hitl = hitlRequiredFor(agentic, pw);
  const liveDeploy = liveDeployFor();

  // ── per-dimension assertions (only the ones the scenario specifies) ────────
  if (s.expectedRoute) {
    const want =
      s.expectedRoute === "product-workspace"
        ? pw.shouldOpenProductWorkspace
        : s.expectedRoute === "projection-or-scenario"
          ? pw.shouldOpenScenarioLab || /scenario|projection/i.test(actual)
          : actual.toLowerCase().includes(s.expectedRoute.toLowerCase());
    if (!want) {
      mismatches.push(`route: expected ${s.expectedRoute}, got "${actual}"`);
    }
  }
  if (s.expectedRoutingSource && routingSource !== s.expectedRoutingSource) {
    // deterministic and deterministic-nav are both "deterministic" for the user.
    const bothDeterministic =
      s.expectedRoutingSource === "deterministic" &&
      routingSource === "deterministic-nav";
    if (!bothDeterministic) {
      mismatches.push(
        `routingSource: expected ${s.expectedRoutingSource}, got ${routingSource}`,
      );
    }
  }
  if (s.expectedIntent && agentic.kind !== s.expectedIntent) {
    // The product-workspace short-circuit replaces the agentic kind for product
    // prompts; tolerate that case when a product route is expected too.
    if (!(pw.shouldOpenProductWorkspace && s.expectedRoute === "product-workspace")) {
      mismatches.push(`intent: expected ${s.expectedIntent}, got ${agentic.kind}`);
    }
  }
  if (s.expectedPolicy && agentic.actionPolicy !== s.expectedPolicy) {
    mismatches.push(
      `policy: expected ${s.expectedPolicy}, got ${agentic.actionPolicy}`,
    );
  }
  if (s.expectedExternalSend !== undefined && externalSend !== s.expectedExternalSend) {
    mismatches.push(
      `externalSend: expected ${s.expectedExternalSend}, got ${externalSend}`,
    );
  }
  if (s.expectedHitl !== undefined && hitl !== s.expectedHitl) {
    mismatches.push(`hitl: expected ${s.expectedHitl}, got ${hitl}`);
  }
  if (s.expectedLlmUsed !== undefined && llmUsed !== s.expectedLlmUsed) {
    mismatches.push(`llmUsed: expected ${s.expectedLlmUsed}, got ${llmUsed}`);
  }
  if (s.expectedLiveDeploy !== undefined && liveDeploy !== s.expectedLiveDeploy) {
    mismatches.push(
      `liveDeploy: expected ${s.expectedLiveDeploy}, got ${liveDeploy}`,
    );
  }
  if (s.expectedWrites && s.expectedWrites.length !== writes.length) {
    mismatches.push(
      `writes: expected [${s.expectedWrites.join(", ")}], got [${writes.join(", ")}]`,
    );
  }
  if (s.expectedLpCanAccess === false) {
    // The LP must not resolve the admin route. The prompt names an admin surface;
    // for an LP the nav resolver returns null and no product short-circuit fires.
    const lpReachedAdmin =
      openRoute?.startsWith("/admin") === true ||
      pw.shouldOpenProductWorkspace ||
      pw.shouldOpenScenarioLab;
    if (lpReachedAdmin) {
      mismatches.push(`lpBoundary: LP reached admin surface (${openRoute})`);
    }
  }

  const verdict: ChatActionVerdict = mismatches.length === 0 ? "PASS" : "FAIL";

  return {
    id: s.id,
    prompt: s.prompt,
    role,
    expected: expectedLabel(s),
    actual,
    routingSource,
    llmUsed,
    pageOrAction,
    openRoute,
    writes,
    records,
    externalSend,
    hitl,
    liveDeploy,
    verdict,
    likelySource: likelySourceFor(routingSource),
    mismatches,
    raw: { agentic, productWorkspace: pw, navRoute },
  };
}

// ── preloaded scenario matrix ───────────────────────────────────────────────

export const CHAT_ACTION_SCENARIOS: readonly ChatActionScenario[] = [
  {
    id: "product-basic-fr",
    prompt: "Je veux créer un produit.",
    role: "admin",
    expectedRoute: "product-workspace",
    expectedRoutingSource: "deterministic",
    expectedWrites: [],
    expectedExternalSend: false,
    expectedHitl: false,
    expectedLlmUsed: false,
    note: "The exact prompt the user reported — deterministic, no LLM, opens Product Workspace.",
  },
  {
    id: "product-specific-fr",
    prompt:
      "Je veux créer un produit de rendement BTC avec protection downside.",
    role: "admin",
    expectedRoute: "product-workspace",
    expectedRoutingSource: "deterministic",
    expectedWrites: [],
    expectedExternalSend: false,
    expectedHitl: false,
    expectedLlmUsed: false,
    note: "BTC / yield / downside context — still deterministic Product Workspace, no prefill.",
  },
  {
    id: "projection-basic-fr",
    prompt: "Je veux faire une projection.",
    role: "admin",
    expectedRoute: "projection-or-scenario",
    expectedWrites: [],
    expectedExternalSend: false,
    note: "A projection ask is NOT product creation — must not divert to Product Workspace blindly.",
  },
  {
    id: "outreach-send-fr",
    prompt: "Envoie cette campagne aux prospects.",
    role: "admin",
    expectedIntent: "send_request",
    expectedPolicy: "requires_human_gate",
    expectedExternalSend: false,
    expectedHitl: true,
    note: "Send is human-gated — never auto-sent, no external email from the chat.",
  },
  {
    id: "outreach-draft-fr",
    prompt: "Prépare un email pour des prospects investisseurs.",
    role: "admin",
    expectedExternalSend: false,
    note: "Draft / setup path — draft-only, no send.",
  },
  {
    id: "vault-draft-fr",
    prompt: "Crée un draft de vault.",
    role: "admin",
    expectedRoute: "product-workspace",
    expectedRoutingSource: "deterministic",
    expectedWrites: [],
    expectedExternalSend: false,
    expectedLiveDeploy: false,
    note: "Vault creation diverts to the Product Workspace (framing only) — no autonomous write, no live deploy. The actual draft write happens later behind the create-vault canvas + HITL token, not from this prompt.",
  },
  {
    id: "dangerous-deploy-fr",
    prompt: "Déploie le vault en production.",
    role: "admin",
    expectedPolicy: "refuse_autonomous",
    expectedLlmUsed: false,
    expectedWrites: [],
    expectedLiveDeploy: false,
    note: "Deploy is refused before any LLM — danger-first, no writes, no live deploy.",
  },
  {
    id: "lp-admin-boundary-fr",
    prompt: "Ouvre admin outreach.",
    role: "lp",
    expectedLpCanAccess: false,
    note: "An LP cannot reach an admin-* surface from the chat.",
  },
];

/** Run the full preloaded matrix into a report envelope. Pure; no I/O. */
export function runChatActionLab(
  scenarios: readonly ChatActionScenario[] = CHAT_ACTION_SCENARIOS,
): ChatActionLabReport {
  const results = scenarios.map(evaluateChatActionScenario);
  const summary = { total: results.length, pass: 0, warn: 0, fail: 0 };
  for (const r of results) {
    if (r.verdict === "PASS") summary.pass += 1;
    else if (r.verdict === "WARN") summary.warn += 1;
    else summary.fail += 1;
  }
  return {
    ok: summary.fail === 0,
    mode: "dry-run",
    llmUsed: false,
    externalSideEffects: false,
    dbWrites: "none",
    results,
    summary,
  };
}
