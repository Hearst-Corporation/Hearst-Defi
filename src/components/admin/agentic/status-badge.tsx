// Agentic Control Center v0 — presentational badges (read-only).
// Maps inventory status / risk / boolean flags to DS Badge variants.

import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type {
  AgenticStatus,
  RiskLevel,
} from "@/lib/agentic/control-center/types";

const STATUS_VARIANT: Record<AgenticStatus, BadgeVariant> = {
  active: "success",
  shadow: "warning",
  "read-only": "accent",
  gated: "warning",
  legacy: "default",
  unknown: "default",
};

export function StatusBadge({ status }: { status: AgenticStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>;
}

const RISK_VARIANT: Record<RiskLevel, BadgeVariant> = {
  low: "default",
  medium: "warning",
  high: "danger",
};

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <Badge variant={RISK_VARIANT[risk]}>{risk} risk</Badge>;
}

/** Yes/No flag — danger when a write is allowed, success when gated/blocked. */
export function FlagBadge({
  on,
  onLabel,
  offLabel,
  /** When true, an "on" value is the SAFE state (e.g. human gate required). */
  onIsSafe = false,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
  onIsSafe?: boolean;
}) {
  const safe = on === onIsSafe;
  return (
    <Badge variant={safe ? "success" : "warning"}>
      {on ? onLabel : offLabel}
    </Badge>
  );
}
