// Tool Boundary v1 — consistency checks (pure, read-only).
//
// Compares the reflected real tools against (a) safety invariants and (b) the
// existing STATIC Control Center boundary, emitting info/warning/critical issues.
// It never blocks and never mutates — it only surfaces drift so an admin can SEE
// when the code and the displayed boundary disagree.

import type {
  ReflectedToolBoundaryItem,
  ToolBoundaryConsistencyIssue,
} from "./types";

/** Tool ids that the static Control Center boundary currently displays. */
export interface StaticBoundaryView {
  /** All tool ids listed across the static read/draft/confirmed tiers. */
  toolIds: string[];
}

/**
 * Run every consistency check over the reflected boundary items + the static
 * view. Pure. Severities:
 *   - critical: a real safety invariant is violated (write without gate, etc.)
 *   - warning:  drift that needs attention (unknown tool, static/real mismatch)
 *   - info:     benign notes
 */
export function checkToolBoundaryConsistency(
  reflected: readonly ReflectedToolBoundaryItem[],
  staticView: StaticBoundaryView,
): ToolBoundaryConsistencyIssue[] {
  const issues: ToolBoundaryConsistencyIssue[] = [];

  // Only the REAL callable tools (exclude forbidden-autonomous representations).
  const realTools = reflected.filter(
    (t) => t.tier !== "forbidden_autonomous",
  );

  // 1) Unknown tier — a real tool with no classification.
  for (const t of realTools) {
    if (t.tier === "unknown") {
      issues.push({
        id: `unknown-tool:${t.id}`,
        severity: "warning",
        message: `Tool "${t.id}" is in the registry but has no boundary classification. It is treated as high-risk + non-autonomous until classified in registry-reflection.ts.`,
      });
    }
  }

  // 2) Write-like tool without a human gate → critical safety violation.
  for (const t of realTools) {
    const isWriteLike =
      t.tier === "draft_or_proposal" ||
      t.tier === "confirmed_write" ||
      t.tier === "unknown";
    if (isWriteLike && !t.humanGateRequired) {
      issues.push({
        id: `write-without-gate:${t.id}`,
        severity: "critical",
        message: `Write-capable tool "${t.id}" (${t.tier}) is not human-gated. Every write must require a HITL confirmation token.`,
      });
    }
  }

  // 3) confirmed_write with autonomousAllowed true → critical.
  for (const t of realTools) {
    if (t.tier === "confirmed_write" && t.autonomousAllowed) {
      issues.push({
        id: `confirmed-write-autonomous:${t.id}`,
        severity: "critical",
        message: `Confirmed-write tool "${t.id}" is marked autonomousAllowed=true. A confirmed write must never be autonomous.`,
      });
    }
  }

  // 4) Any non-read tool with autonomousAllowed true → critical.
  for (const t of realTools) {
    if (t.tier !== "read_only" && t.autonomousAllowed) {
      issues.push({
        id: `non-read-autonomous:${t.id}`,
        severity: "critical",
        message: `Tool "${t.id}" (${t.tier}) is marked autonomousAllowed=true but only read_only tools may be autonomous.`,
      });
    }
  }

  // 5) forbidden_autonomous represented as autonomous → critical.
  for (const t of reflected) {
    if (t.tier === "forbidden_autonomous" && t.autonomousAllowed) {
      issues.push({
        id: `forbidden-exposed:${t.id}`,
        severity: "critical",
        message: `Forbidden action "${t.id}" is marked autonomousAllowed=true. It must never be autonomous.`,
      });
    }
  }

  // 6) Static-vs-code drift (both directions). Compare real callable ids vs the
  //    ids the static Control Center boundary displays.
  const realIds = new Set(realTools.map((t) => t.id));
  const staticIds = new Set(staticView.toolIds);

  for (const id of realIds) {
    if (!staticIds.has(id)) {
      issues.push({
        id: `missing-in-static:${id}`,
        severity: "warning",
        message: `Real registry tool "${id}" is not shown in the static Control Center boundary. The displayed list is stale.`,
      });
    }
  }
  for (const id of staticIds) {
    if (!realIds.has(id)) {
      issues.push({
        id: `stale-static:${id}`,
        severity: "warning",
        message: `Static Control Center boundary lists "${id}", which is not a real registry tool id. It may be renamed, removed, or an action label.`,
      });
    }
  }

  return issues;
}
