import type { HeroKpi } from "@/lib/data/cockpit";
import type { ProposalState } from "@/lib/governance/state-machine";

interface GovernanceProposalRow {
  state: ProposalState;
  updatedAt?: Date | null;
}

/**
 * Derives KPIs from the governance queue already loaded by /admin/governance.
 * Returns [] when the queue is empty (caller suppresses the strip).
 */
export function buildGovernanceKpiStrip(
  proposals: GovernanceProposalRow[],
): HeroKpi[] {
  if (proposals.length === 0) return [];

  const byState = proposals.reduce<Partial<Record<ProposalState, number>>>(
    (acc, p) => {
      acc[p.state] = (acc[p.state] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const signing = byState.SIGNING ?? 0;
  const timelock = byState.TIMELOCK ?? 0;
  const executable = byState.EXECUTABLE ?? 0;

  return [
    {
      label: "In queue",
      value: String(proposals.length),
      sublabel: "all proposal states",
      provenance: "manual",
    },
    {
      label: "Awaiting signature",
      value: String(signing),
      sublabel: signing === 1 ? "needs operator" : "need operators",
      provenance: "manual",
      alert: signing > 0,
    },
    {
      label: "Timelock",
      value: String(timelock),
      sublabel: "pending execution window",
      provenance: "manual",
      accent: timelock > 0,
    },
    {
      label: "Executable",
      value: String(executable),
      sublabel: "ready to run",
      provenance: "manual",
      accent: executable > 0,
    },
  ];
}
