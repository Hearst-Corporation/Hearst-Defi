import type { ProposalState } from "@/lib/governance/state-machine";

export function proposalStateVariant(
  state: ProposalState,
): "default" | "warning" | "success" | "danger" | "accent" {
  switch (state) {
    case "DRAFT":
      return "default";
    case "SIGNING":
      return "warning";
    case "QUEUED":
    case "TIMELOCK":
      return "accent";
    case "EXECUTABLE":
    case "EXECUTED":
      return "success";
    case "CANCELLED":
    case "REJECTED":
    case "EXPIRED":
      return "danger";
  }
}

export function proposalStateLabel(state: ProposalState): string {
  return state.charAt(0) + state.slice(1).toLowerCase();
}

export function formatProposalAge(d: Date): string {
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function formatGovernanceTimestamp(d: Date | null): string {
  if (!d) return "—";
  return `${d.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

export function timelockCountdown(etaAt: Date): string {
  const ms = etaAt.getTime() - Date.now();
  if (ms <= 0) return "Elapsed — ready to execute";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m remaining`;
}
