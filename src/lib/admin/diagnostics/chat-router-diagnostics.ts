/**
 * Chat Router diagnostics — exercises the REAL product-workspace classifier and
 * the nav resolver (both pure, no I/O, no LLM, no DB). Every live check calls the
 * real function and asserts on its real output.
 *
 * NOTE — the deterministic agentic intent router (`@/lib/agentic/intent-router`,
 * `classifyAgenticIntent`) was REMOVED. The checks that probed it (pre-LLM
 * deploy/send refusals, negation, agentic navigation, unknown fallthrough,
 * bug-report non-nav) no longer have a runtime to exercise, so they are reported
 * honestly as SKIPPED ("router removed — capability not applicable"), never a
 * fabricated PASS. The product-workspace routing + LP nav-boundary checks remain
 * live because those functions still exist.
 */
import { classifyProductWorkspaceIntent } from "@/lib/llm/product-workspace-intent";
import { resolveNavDestinationForProfile } from "@/lib/llm/navigate-tool";
import {
  type DiagnosticCheckSpec,
  type DiagnosticResult,
  fail,
  pass,
  skip,
  runChecks,
} from "./types";

const PW = "src/lib/llm/product-workspace-intent.ts";

/** Reason surfaced by every check that used to probe the deleted intent router. */
const ROUTER_REMOVED =
  "agentic intent router removed — classifyAgenticIntent no longer exists, capability not applicable";

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
      expected: "Scenario Lab route retired — capability not applicable",
      likelyFile: PW,
      likelyFunction: "classifyProductWorkspaceIntent",
      sideEffect: "skipped",
      run: () =>
        skip(
          "Scenario Lab route retired — classifyProductWorkspaceIntent no longer routes a standalone simulation to a destination (it falls to the LLM)",
        ),
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
      sideEffect: "skipped",
      run: () => skip(ROUTER_REMOVED),
    },
    {
      id: "chat.negated-deploy-cancellation",
      label: "Negated deploy becomes cancellation, not a deploy",
      severity: "P0",
      expected: "kind=cancellation, negated=true, prohibitedAutonomousAction=false",
      sideEffect: "skipped",
      run: () => skip(ROUTER_REMOVED),
    },
    {
      id: "chat.outreach-send-human-gate",
      label: "Outreach send prompt requires a human gate",
      severity: "P0",
      expected: "actionPolicy=requires_human_gate, requiresHumanGate=true, prohibitedAutonomousAction=true",
      sideEffect: "skipped",
      run: () => skip(ROUTER_REMOVED),
    },
    {
      id: "chat.lp-cannot-resolve-admin-nav",
      label: "LP cannot resolve an admin-* navigation destination",
      severity: "P0",
      expected: "resolveNavDestinationForProfile('admin-dashboard','lp') === null; ('admin') !== null",
      likelyFile: "src/lib/llm/navigate-tool.ts",
      likelyFunction: "resolveNavDestinationForProfile",
      guard: "nav profile guard",
      run: () => {
        const lp = resolveNavDestinationForProfile("admin-dashboard", "lp");
        const admin = resolveNavDestinationForProfile("admin-dashboard", "admin");
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
      expected: "resolveNavDestinationForProfile('portfolio','lp') resolvable",
      likelyFile: "src/lib/llm/navigate-tool.ts",
      likelyFunction: "resolveNavDestinationForProfile",
      run: () => {
        const dest = resolveNavDestinationForProfile("portfolio", "lp");
        return dest !== null
          ? pass(`portfolio → ${dest.route}`, dest)
          : fail(`portfolio unresolved for LP: ${JSON.stringify(dest)}`);
      },
    },
    {
      id: "chat.unknown-no-write",
      label: "Unknown prompt falls to LLM fallback, not a write action",
      severity: "P1",
      expected: "actionPolicy != refuse_autonomous, prohibitedAutonomousAction=false, requiresHumanGate=false",
      sideEffect: "skipped",
      run: () => skip(ROUTER_REMOVED),
    },
    {
      id: "chat.bug-report-no-nav",
      label: "Bug report mentioning a page does not auto-navigate",
      severity: "P1",
      expected: "kind != navigation, routeKey undefined for a complaint",
      sideEffect: "skipped",
      run: () => skip(ROUTER_REMOVED),
    },
  ];
  return runChecks("chat-router", specs);
}
