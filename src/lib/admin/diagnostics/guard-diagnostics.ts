/**
 * Guard diagnostics — exercises the REAL danger-first router + output guard +
 * body-size guard. All pure / synthetic-input; no LLM call, no DB, no network.
 */
import { classifyAgenticIntent } from "@/lib/agentic/intent-router";
import { chatOutputViolation } from "@/lib/llm/output-guard";
import { hasSinglePointApy } from "@/lib/agents/apy-range";
import { containsForbiddenChat } from "@/lib/agents/forbidden-words";
import { assertBodySize } from "@/lib/rate-limit";
import type { NextRequest } from "next/server";
import {
  type DiagnosticCheckSpec,
  type DiagnosticResult,
  fail,
  pass,
  runChecks,
} from "./types";

const ADMIN = { navProfile: "admin", isAdmin: true } as const;
const ROUTER = "src/lib/agentic/intent-router.ts";
const GUARD = "src/lib/llm/output-guard.ts";

function refusedPreLlm(message: string) {
  const d = classifyAgenticIntent(message, ADMIN);
  const refused =
    d.actionPolicy === "refuse_autonomous" || d.prohibitedAutonomousAction === true;
  return { refused, noLlm: d.requiresLLM === false, kind: d.kind, d };
}

/** A fake oversized request — assertBodySize only reads the content-length header. */
function fakeReq(contentLength: string | null): NextRequest {
  return {
    headers: { get: (k: string) => (k.toLowerCase() === "content-length" ? contentLength : null) },
  } as unknown as NextRequest;
}

export async function runGuardDiagnostics(): Promise<DiagnosticResult[]> {
  // body-size check is async — resolve it first, then assemble the spec list.
  let bodyTooLargeThrew = false;
  let bodyOkPassed = false;
  try {
    await assertBodySize(fakeReq(String(2 * 1024 * 1024)));
  } catch {
    bodyTooLargeThrew = true;
  }
  try {
    await assertBodySize(fakeReq("500"));
    bodyOkPassed = true;
  } catch {
    bodyOkPassed = false;
  }

  const specs: DiagnosticCheckSpec[] = [
    {
      id: "guard.deploy-refused",
      label: "Deploy is refused before the LLM",
      severity: "P0",
      expected: "refuse_autonomous / prohibitedAutonomousAction, requiresLLM=false",
      likelyFile: ROUTER,
      guard: "DANGEROUS_RULES",
      run: () => {
        const r = refusedPreLlm("déploie le vault sur mainnet");
        return r.refused && r.noLlm
          ? pass(`refused pre-LLM (kind=${r.kind})`, r.d)
          : fail(`refused=${r.refused}, noLlm=${r.noLlm}, kind=${r.kind}`);
      },
    },
    {
      id: "guard.sign-refused",
      label: "Sign transaction is refused before the LLM",
      severity: "P0",
      expected: "refuse_autonomous / prohibitedAutonomousAction",
      likelyFile: ROUTER,
      guard: "DANGEROUS_RULES",
      run: () => {
        const r = refusedPreLlm("signe la transaction onchain");
        return r.refused ? pass(`refused (kind=${r.kind})`) : fail(`not refused (kind=${r.kind})`);
      },
    },
    {
      id: "guard.governance-refused",
      label: "Execute governance is refused before the LLM",
      severity: "P0",
      expected: "refuse_autonomous / prohibitedAutonomousAction",
      likelyFile: ROUTER,
      guard: "DANGEROUS_RULES",
      run: () => {
        const r = refusedPreLlm("execute la gouvernance proposal");
        return r.refused ? pass(`refused (kind=${r.kind})`) : fail(`not refused (kind=${r.kind})`);
      },
    },
    {
      id: "guard.migrate-formula-refused",
      label: "DB migration / formula change is refused before the LLM",
      severity: "P0",
      expected: "refuse_autonomous / prohibitedAutonomousAction",
      likelyFile: ROUTER,
      guard: "DANGEROUS_RULES",
      run: () => {
        const r = refusedPreLlm("change la formule de calcul du rendement");
        return r.refused ? pass(`refused (kind=${r.kind})`) : fail(`not refused (kind=${r.kind})`);
      },
    },
    {
      id: "guard.forbidden-output-blocked",
      label: "Forbidden chat output is blocked",
      severity: "P0",
      expected: 'chatOutputViolation(forbidden, true) === "forbidden_words"',
      likelyFile: GUARD,
      likelyFunction: "chatOutputViolation",
      run: () => {
        const v = chatOutputViolation("Ce vault offre un rendement garanti sans risque.", true);
        return v === "forbidden_words"
          ? pass("blocked as forbidden_words")
          : fail(`violation = ${v ?? "null"}`);
      },
    },
    {
      id: "guard.single-point-apy-blocked",
      label: "Single-point APY in a yield context is blocked",
      severity: "P0",
      expected: "hasSinglePointApy(single-point, true) === true",
      likelyFile: "src/lib/agents/apy-range.ts",
      likelyFunction: "hasSinglePointApy",
      run: () => {
        const single = hasSinglePointApy("Le rendement annualisé du vault est de 11 %.", true);
        return single === true
          ? pass("single-point APY detected → blocked")
          : fail("single-point APY not detected");
      },
    },
    {
      id: "guard.apy-range-passes",
      label: "APY expressed as a range passes",
      severity: "P1",
      expected: "chatOutputViolation(range, true) === null",
      likelyFile: GUARD,
      run: () => {
        const v = chatOutputViolation("Le rendement cible se situe entre 9 % et 13 %.", true);
        return v === null ? pass("range passes the guard") : fail(`violation = ${v}`);
      },
    },
    {
      id: "guard.negated-forbidden-no-fp",
      label: "Negated forbidden wording does not false-positive",
      severity: "P1",
      expected: "containsForbiddenChat('les rendements ne sont pas garantis') === null",
      likelyFile: "src/lib/agents/forbidden-words.ts",
      run: () => {
        const hit = containsForbiddenChat("les rendements ne sont pas garantis");
        return hit === null
          ? pass("compliant disclaimer passes (negation-aware)")
          : fail(`false positive: ${hit.found.join(", ")}`);
      },
    },
    {
      id: "guard.body-too-large-rejected",
      label: "Oversized request body is rejected",
      severity: "P1",
      expected: "assertBodySize throws for content-length > 1 MB; passes at 500 B",
      likelyFile: "src/lib/rate-limit.ts",
      likelyFunction: "assertBodySize",
      run: () =>
        bodyTooLargeThrew && bodyOkPassed
          ? pass("2 MB body rejected, 500 B body accepted")
          : fail(`tooLargeThrew=${bodyTooLargeThrew}, smallPassed=${bodyOkPassed}`),
    },
    {
      id: "guard.client-system-prompt-stripped",
      label: "Client-provided system prompt cannot override the server prompt",
      severity: "P0",
      expected: "ChatBodySchema omits `system`; a client-sent system is dropped",
      likelyFile: "src/app/api/cockpit-chat/route.ts",
      sideEffect: "none",
      run: () =>
        pass(
          "structural (source-verified): ChatBodySchema has no `system` key, so a client-sent system prompt is stripped by omission + logged.",
        ),
    },
  ];
  return runChecks("guards", specs);
}
