// Admin · Agentic Console (simplified) — Tool boundary section body (condensed).
//
// READ-ONLY. The condensed reflection of Tool Boundary v1. The four per-tier
// counts (read-only / draft-proposal / confirmed-write / forbidden) render via
// the canon embedded KPI strip on the parent AdminSectionCard (see
// buildToolBoundaryKpiStrip + agentic-console-simple). This body carries only
// the one HITL sentence — no hand-rolled KPI tiles, no 19-row table, no write
// controls, no run buttons.

import type { AgenticControlCenterData } from "@/lib/agentic/control-center/types";

export function AgenticToolBoundaryCondensed({
  controlCenter,
}: {
  controlCenter: AgenticControlCenterData;
}) {
  const counts = controlCenter.toolBoundaryV1?.counts;

  if (!counts) {
    return (
      <p className="ct-metric-caption m-0 p-5">
        Tool boundary reflection unavailable.
      </p>
    );
  }

  return (
    <p className="ct-metric-caption m-0 p-5">
      Every write sits behind a HITL confirmation token — the model never
      auto-executes one.
    </p>
  );
}
