export type ActionReadinessTier =
  | "read_only"
  | "draft_or_proposal"
  | "confirmed_write"
  | "forbidden_autonomous";

export type ActionReadinessStatus =
  | "available"
  | "gated"
  | "blocked"
  | "planned";

export type ActionRiskLevel =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type ActionReadinessItem = {
  id: string;
  label: string;
  tier: ActionReadinessTier;
  status: ActionReadinessStatus;
  autonomousAllowed: boolean;
  humanGateRequired: boolean;
  confirmationRequired: boolean;
  riskLevel: ActionRiskLevel;
  requiredGate?: string;
  reason: string;
  examples: string[];
};

export type ActionReadinessMatrix = {
  generatedAt: string;
  items: ActionReadinessItem[];
  counts: Record<ActionReadinessTier, number>;
  safetyNotes: string[];
};
