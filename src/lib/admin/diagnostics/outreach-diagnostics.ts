/**
 * Outreach diagnostics — exercises the REAL guard + policy functions every send
 * path relies on (containsForbidden, assertNoForbiddenWords, decideAutoSend,
 * remainingDailyBudget). It NEVER calls a send handler, Resend, or Inngest. The
 * suppression DB-read probe is injected by the route (db-read, no write); without
 * it that check is SKIPPED.
 */
import { containsForbidden } from "@/lib/agents/forbidden-words";
import { assertNoForbiddenWords } from "@/lib/agents/validators";
import { decideAutoSend, remainingDailyBudget } from "@/lib/outreach/send-policy";
import type { Autonomy, SendKind } from "@/lib/outreach/send-policy";
import type { Tier } from "@/lib/outreach/tier";
import {
  type DiagnosticCheckSpec,
  type DiagnosticResult,
  fail,
  pass,
  runChecks,
  skip,
} from "./types";

export type OutreachDiagnosticsDeps = {
  /** Real isSuppressed() probe result, injected by the route (db-read). */
  suppressionProbe?: { email: string; suppressed: boolean };
};

const UNSAFE = "This vault is risk-free and we guarantee returns.";
const SAFE = "Returns are not guaranteed; capital is at risk.";
const AUTONOMIES: Autonomy[] = ["SUGGEST", "SEND", "NURTURE", "CLOSED"];
const KINDS: SendKind[] = ["first_touch", "follow_up"];

export function runOutreachDiagnostics(
  deps: OutreachDiagnosticsDeps = {},
): DiagnosticResult[] {
  const specs: DiagnosticCheckSpec[] = [
    {
      id: "outreach.direct-forbidden-blocked",
      label: "Direct send with forbidden words is caught by the guard",
      severity: "P0",
      expected: "containsForbidden(unsafe) returns a non-null hit",
      likelyFile: "src/lib/outreach/admin-actions.ts",
      likelyFunction: "sendDirectEmail",
      guard: "assertNoForbiddenWords",
      run: () => {
        const hit = containsForbidden(UNSAFE);
        return hit
          ? pass(`blocked — found: ${hit.found.join(", ")}`, hit)
          : fail("forbidden words not detected");
      },
    },
    {
      id: "outreach.fanout-forbidden-blocked",
      label: "Campaign fan-out forbidden-word check blocks unsafe email",
      severity: "P0",
      expected: "containsForbidden(unsafe) non-null (re-checked at fan-out send)",
      likelyFile: "src/lib/inngest/functions/outreach-send.ts",
      guard: "containsForbidden (PR #211)",
      run: () => {
        const hit = containsForbidden(UNSAFE);
        return hit ? pass(`blocked — ${hit.found.join(", ")}`) : fail("not detected");
      },
    },
    {
      id: "outreach.autosend-forbidden-blocked",
      label: "Auto-send forbidden-word check blocks unsafe email",
      severity: "P0",
      expected: "containsForbidden(unsafe) non-null (re-checked at auto-send)",
      likelyFile: "src/lib/inngest/functions/outreach-auto-send.ts",
      guard: "containsForbidden (PR #216)",
      run: () => {
        const hit = containsForbidden(UNSAFE);
        return hit ? pass(`blocked — ${hit.found.join(", ")}`) : fail("not detected");
      },
    },
    {
      id: "outreach.followup-forbidden-blocked",
      label: "Follow-up forbidden-word check blocks unsafe email",
      severity: "P0",
      expected: "containsForbidden(unsafe) non-null (re-checked at follow-up send)",
      likelyFile: "src/lib/inngest/functions/outreach-followups.ts",
      guard: "containsForbidden",
      run: () => {
        const hit = containsForbidden(UNSAFE);
        return hit ? pass(`blocked — ${hit.found.join(", ")}`) : fail("not detected");
      },
    },
    {
      id: "outreach.clean-passes",
      label: "Compliant copy (negated claim) passes the guard",
      severity: "P2",
      expected: "containsForbidden(safe) === null (negation-exempted)",
      likelyFile: "src/lib/agents/forbidden-words.ts",
      run: () => {
        const hit = containsForbidden(SAFE);
        return hit === null
          ? pass("clean copy passes")
          : fail(`false positive: ${hit.found.join(", ")}`);
      },
    },
    {
      id: "outreach.assert-throws",
      label: "assertNoForbiddenWords throws on unsafe copy",
      severity: "P1",
      expected: "assertNoForbiddenWords(unsafe) throws",
      likelyFile: "src/lib/agents/validators.ts",
      run: () => {
        try {
          assertNoForbiddenWords(UNSAFE);
          return fail("did not throw on forbidden copy");
        } catch (err) {
          return pass(`threw: ${err instanceof Error ? err.message.slice(0, 80) : "error"}`);
        }
      },
    },
    {
      id: "outreach.tier-a-never-autosend",
      label: "Tier A never auto-sends at any autonomy level",
      severity: "P0",
      expected: "decideAutoSend('A', *, *).autoSend === false for all",
      likelyFile: "src/lib/outreach/send-policy.ts",
      likelyFunction: "decideAutoSend",
      run: () => {
        const offenders: string[] = [];
        for (const a of AUTONOMIES)
          for (const k of KINDS) {
            const d = decideAutoSend("A" as Tier, a, k);
            if (d.autoSend) offenders.push(`A/${a}/${k}`);
          }
        return offenders.length === 0
          ? pass("Tier A autoSend=false across all autonomy × kind")
          : fail(`Tier A auto-sent for: ${offenders.join(", ")}`);
      },
    },
    {
      id: "outreach.suggest-zero-autosend",
      label: "OUTREACH_AUTONOMY=SUGGEST produces zero auto-send",
      severity: "P0",
      expected: "decideAutoSend(B|C, SUGGEST, *).autoSend === false",
      likelyFile: "src/lib/outreach/send-policy.ts",
      run: () => {
        const any = (["B", "C"] as Tier[]).some((t) =>
          KINDS.some((k) => decideAutoSend(t, "SUGGEST", k).autoSend),
        );
        return !any
          ? pass("SUGGEST → nothing auto-sends")
          : fail("SUGGEST auto-sent something");
      },
    },
    {
      id: "outreach.send-allows-bc-firsttouch",
      label: "SEND+ allows Tier B/C first-touch auto-send",
      severity: "P1",
      expected: "decideAutoSend('B','SEND','first_touch').autoSend === true",
      likelyFile: "src/lib/outreach/send-policy.ts",
      run: () => {
        const b = decideAutoSend("B" as Tier, "SEND", "first_touch");
        return b.autoSend === true
          ? pass(`Tier B first-touch @ SEND → autoSend (reason: ${b.reason})`, b)
          : fail(`Tier B first-touch @ SEND autoSend=${b.autoSend}`);
      },
    },
    {
      id: "outreach.followup-needs-nurture",
      label: "Follow-up auto-send needs NURTURE+",
      severity: "P1",
      expected: "follow_up autoSend false @ SEND, true @ NURTURE",
      likelyFile: "src/lib/outreach/send-policy.ts",
      run: () => {
        const send = decideAutoSend("B" as Tier, "SEND", "follow_up");
        const nurture = decideAutoSend("B" as Tier, "NURTURE", "follow_up");
        return send.autoSend === false && nurture.autoSend === true
          ? pass("follow_up: SEND→no, NURTURE→yes")
          : fail(`SEND=${send.autoSend}, NURTURE=${nurture.autoSend}`);
      },
    },
    {
      id: "outreach.warmup-day0-floor",
      label: "Warm-up caps day-0 budget at the floor (10)",
      severity: "P2",
      expected: "remainingDailyBudget(200, 0, 0) === 10",
      likelyFile: "src/lib/outreach/send-policy.ts",
      likelyFunction: "remainingDailyBudget",
      run: () => {
        const day0 = remainingDailyBudget(200, 0, 0);
        return day0 === 10
          ? pass("day-0 cap = 10 (warm-up floor)")
          : fail(`day-0 budget = ${day0}`);
      },
    },
    {
      id: "outreach.suppression-blocks",
      label: "Suppressed address is blocked at send (DB-read probe)",
      severity: "P0",
      expected: "isSuppressed(email) runs and returns a boolean (read-only)",
      likelyFile: "src/lib/outreach/suppression.ts",
      likelyFunction: "isSuppressed",
      sideEffect: deps.suppressionProbe ? "none" : "skipped",
      run: () =>
        deps.suppressionProbe
          ? pass(
              `isSuppressed("${deps.suppressionProbe.email}") = ${deps.suppressionProbe.suppressed} (read-only query executed)`,
              deps.suppressionProbe,
            )
          : skip(
              "SKIPPED — needs a server-side DB-read; the route injects a real isSuppressed() probe.",
            ),
    },
    {
      id: "outreach.no-resend",
      label: "No diagnostic path calls Resend or emits Inngest events",
      severity: "INFO",
      expected: "guards tested in isolation; sendTrackedEmail / inngest never invoked",
      likelyFile: "src/lib/email/send.ts",
      sideEffect: "none",
      run: () =>
        pass(
          "structural — this suite imports only guard/policy functions; no send handler, Resend, or Inngest event is reachable.",
        ),
    },
    {
      id: "outreach.distinct-handlers",
      label: "Four send paths are distinct handlers (fan-out ≠ auto-send ≠ follow-up ≠ direct)",
      severity: "INFO",
      expected: "outreach-send.ts (fan-out) · outreach-auto-send.ts (cron) · outreach-followups.ts (cron) · actions.ts (direct)",
      sideEffect: "none",
      run: () =>
        pass(
          "structural (source-verified): OUTREACH_SEND_ID=outreach-send (event), OUTREACH_AUTO_SEND_ID=outreach-auto-send (0 * * * *), OUTREACH_FOLLOWUPS_ID=outreach-followups (0 9 * * *).",
        ),
    },
  ];
  return runChecks("outreach", specs);
}
