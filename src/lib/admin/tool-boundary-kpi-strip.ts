import type { HeroKpi } from "@/lib/data/cockpit";
import type { ToolBoundaryTierCounts } from "@/lib/agentic/tool-boundary/types";

/**
 * Derives the 4 canon KPIs for the Tool Boundary v1 section from the per-tier
 * counts already reflected by the control-center loader. No DB queries — a pure
 * derivation from the in-memory reflection (built on the model of
 * buildVaultsKpiStrip).
 *
 * Provenance:
 * - Every count reflects the tool registry's static, operator-authored tier
 *   classification (attested by the boundary reflection, not a live oracle) →
 *   "attested".
 */
export function buildToolBoundaryKpiStrip(
  counts: ToolBoundaryTierCounts,
): HeroKpi[] {
  const kpis: HeroKpi[] = [
    {
      label: "Read-only",
      value: String(counts.read_only),
      sublabel: "bounded reads · no write",
      provenance: "attested",
    },
    {
      label: "Draft / proposal",
      value: String(counts.draft_or_proposal),
      sublabel: "persists draft only · HITL",
      provenance: "attested",
    },
    {
      label: "Confirmed write",
      value: String(counts.confirmed_write),
      sublabel: "external effect · HITL-gated",
      provenance: "attested",
      accent: counts.confirmed_write > 0,
    },
    {
      label: "Forbidden",
      value: String(counts.forbidden_autonomous),
      sublabel: "never autonomous",
      provenance: "attested",
      alert: counts.forbidden_autonomous > 0,
    },
  ];

  return kpis;
}
