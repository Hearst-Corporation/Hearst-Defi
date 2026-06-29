/**
 * Chat Router diagnostics — exercises the REAL deterministic intent router and
 * product-workspace classifier (both pure, no I/O, no LLM, no DB). Every check
 * calls the live function and asserts on its real output.
 */
import { classifyAgenticIntent } from "@/lib/agentic/intent-router";
import { classifyProductWorkspaceIntent } from "@/lib/llm/product-workspace-intent";
import { resolveNavDestinationForProfile } from "@/lib/llm/navigate-tool";
import {
  type DiagnosticCheckSpec,
  type DiagnosticResult,
  fail,
  pass,
  runChecks,
} from "./types";

const ADMIN = { navProfile: "admin", isAdmin: true } as const;
const LP = { navProfile: "lp", isAdmin: false } as const;
const ROUTER = "src/lib/agentic/intent-router.ts";
const PW = "src/lib/llm/product-workspace-intent.ts";

export function runChatRouterDiagnostics(): DiagnosticResult[] {
  const specs: DiagnosticCheckSpec[] = [
    {
      id: "chat.product-creation",
      label: "Product creation prompt routes to Product Workspace",
      severity: "P1",
      expected: "classifyProductWorkspaceIntent → shouldOpenProductWorkspace = true",
      likelyFile: PW,
      likelyFunction: "classifyProductWorkspaceIntent",
      run: () => {
        const c = classifyProductWorkspaceIntent(
          "create a new mining stable yield product",
        );
        return c.shouldOpenProductWorkspace
          ? pass(`kind=${c.kind}, opens Product Workspace`, c)
          : fail(`kind=${c.kind}, shouldOpenProductWorkspace=${c.shouldOpenProductWorkspace}`);
      },
    },
    {
      id: "chat.simulation-scenario-lab",
      label: "Explicit simulation prompt routes to Scenario Lab",
      severity: "P2",
      expected: "classifyProductWorkspaceIntent → shouldOpenScenarioLab = true",
      likelyFile: PW,
      likelyFunction: "classifyProductWorkspaceIntent",
      run: () => {
        const c = classifyProductWorkspaceIntent(
          "run a monte carlo simulation for this vault",
        );
        return c.shouldOpenScenarioLab
          ? pass(`kind=${c.kind}, opens Scenario Lab`, c)
          : fail(`kind=${c.kind}, shouldOpenScenarioLab=${c.shouldOpenScenarioLab}`);
      },
    },
    {
      id: "chat.create-projection-not-product",
      label: '"create projection" is NOT product creation',
      severity: "P1",
      expected: "shouldOpenProductWorkspace = false (no product noun)",
      likelyFile: PW,
      likelyFunction: "classifyProductWorkspaceIntent",
      run: () => {
        const c = classifyProductWorkspaceIntent("create projection");
        return !c.shouldOpenProductWorkspace
          ? pass(`kind=${c.kind}, does not open Product Workspace`, c)
          : fail(`kind=${c.kind} opened Product Workspace`);
      },
    },
    {
      id: "chat.deploy-refused",
      label: "Dangerous deploy prompt is refused pre-LLM",
      severity: "P0",
      expected: "actionPolicy=refuse_autonomous, prohibitedAutonomousAction=true, requiresLLM=false",
      likelyFile: ROUTER,
      likelyFunction: "classifyAgenticIntent",
      guard: "DANGEROUS_RULES",
      run: () => {
        const d = classifyAgenticIntent("déploie le vault sur mainnet", ADMIN);
        return d.actionPolicy === "refuse_autonomous" &&
          d.prohibitedAutonomousAction === true &&
          d.requiresLLM === false
          ? pass(`kind=${d.kind}, refuse_autonomous, no LLM`, d)
          : fail(`kind=${d.kind}, actionPolicy=${d.actionPolicy}, prohibited=${d.prohibitedAutonomousAction}, requiresLLM=${d.requiresLLM}`);
      },
    },
    {
      id: "chat.negated-deploy-cancellation",
      label: "Negated deploy becomes cancellation, not a deploy",
      severity: "P0",
      expected: "kind=cancellation, negated=true, prohibitedAutonomousAction=false",
      likelyFile: "src/lib/agentic/intent-router-negation.ts",
      likelyFunction: "isNegated",
      run: () => {
        const d = classifyAgenticIntent("ne déploie pas ce vault", ADMIN);
        return d.kind === "cancellation" &&
          d.negated === true &&
          d.prohibitedAutonomousAction === false
          ? pass(`kind=cancellation, negated, not a deploy`, d)
          : fail(`kind=${d.kind}, negated=${d.negated}, prohibited=${d.prohibitedAutonomousAction}`);
      },
    },
    {
      id: "chat.outreach-send-human-gate",
      label: "Outreach send prompt requires a human gate",
      severity: "P0",
      expected: "actionPolicy=requires_human_gate, requiresHumanGate=true, prohibitedAutonomousAction=true",
      likelyFile: "src/lib/agentic/intent-router-rules.ts",
      guard: "SEND_SOURCE_RULES",
      run: () => {
        const d = classifyAgenticIntent(
          "envoie la campagne outreach maintenant",
          ADMIN,
        );
        return d.actionPolicy === "requires_human_gate" &&
          d.requiresHumanGate === true &&
          d.prohibitedAutonomousAction === true
          ? pass(`kind=${d.kind}, human-gated, never auto-sent`, d)
          : fail(`kind=${d.kind}, actionPolicy=${d.actionPolicy}, requiresHumanGate=${d.requiresHumanGate}`);
      },
    },
    {
      id: "chat.lp-cannot-resolve-admin-nav",
      label: "LP cannot resolve an admin-* navigation destination",
      severity: "P0",
      expected: "resolveNavDestinationForProfile('admin-outreach','lp') === null; ('admin') !== null",
      likelyFile: "src/lib/llm/navigate-tool.ts",
      likelyFunction: "resolveNavDestinationForProfile",
      guard: "nav profile guard",
      run: () => {
        const lp = resolveNavDestinationForProfile("admin-outreach", "lp");
        const admin = resolveNavDestinationForProfile("admin-outreach", "admin");
        return lp === null && admin !== null
          ? pass("admin-* dropped for LP, resolved for admin", {
              lp,
              adminRoute: admin?.route,
            })
          : fail(`lp=${JSON.stringify(lp)}, admin=${JSON.stringify(admin)}`);
      },
    },
    {
      id: "chat.lp-nav-allowed",
      label: "LP can navigate its own (portfolio) destination",
      severity: "P2",
      expected: "classifyAgenticIntent('ouvre mon portefeuille', lp) → navigation + resolvable",
      likelyFile: ROUTER,
      run: () => {
        const d = classifyAgenticIntent("ouvre mon portefeuille", LP);
        const dest = resolveNavDestinationForProfile(d.routeKey ?? null, "lp");
        return d.kind === "navigation" && dest !== null
          ? pass(`routeKey=${d.routeKey} → ${dest?.route}`, d)
          : fail(`kind=${d.kind}, routeKey=${d.routeKey}, dest=${JSON.stringify(dest)}`);
      },
    },
    {
      id: "chat.unknown-no-write",
      label: "Unknown prompt falls to LLM fallback, not a write action",
      severity: "P1",
      expected: "actionPolicy != refuse_autonomous, prohibitedAutonomousAction=false, requiresHumanGate=false",
      likelyFile: ROUTER,
      run: () => {
        const d = classifyAgenticIntent("asdf qwer zxcv lorem ipsum", ADMIN);
        return d.actionPolicy !== "refuse_autonomous" &&
          d.prohibitedAutonomousAction === false &&
          d.requiresHumanGate === false
          ? pass(`kind=${d.kind}, actionPolicy=${d.actionPolicy} (no autonomous write)`, d)
          : fail(`kind=${d.kind}, actionPolicy=${d.actionPolicy}, prohibited=${d.prohibitedAutonomousAction}`);
      },
    },
    {
      id: "chat.bug-report-no-nav",
      label: "Bug report mentioning a page does not auto-navigate",
      severity: "P1",
      expected: "kind != navigation, routeKey undefined for a complaint",
      likelyFile: ROUTER,
      guard: "BUG_REPORT_RE",
      run: () => {
        const d = classifyAgenticIntent("le dashboard est cassé", ADMIN);
        return d.kind !== "navigation" && !d.routeKey
          ? pass(`kind=${d.kind}, no routeKey (complaint, not nav)`, d)
          : fail(`kind=${d.kind}, routeKey=${d.routeKey}`);
      },
    },
  ];
  return runChecks("chat-router", specs);
}
