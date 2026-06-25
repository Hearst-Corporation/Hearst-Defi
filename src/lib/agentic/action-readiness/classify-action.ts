import type {
  ActionReadinessTier,
  ActionReadinessStatus,
  ActionRiskLevel,
  ActionReadinessItem,
} from "./types";

export type ClassifyResult = {
  tier: ActionReadinessTier;
  status: ActionReadinessStatus;
  autonomousAllowed: boolean;
  humanGateRequired: boolean;
  confirmationRequired: boolean;
  riskLevel: ActionRiskLevel;
  reason: string;
};

/**
 * Classify an unknown action id that is not in the static registry.
 * Unknown write-like actions default to forbidden_autonomous (fail-safe).
 */
export function classifyUnknownAction(id: string): ClassifyResult {
  const looksLikeWrite =
    /send|deploy|sign|execute|migrate|mutate|create|update|delete|remove|mark|approve|source|trigger/i.test(
      id
    );

  if (looksLikeWrite) {
    return {
      tier: "forbidden_autonomous",
      status: "blocked",
      autonomousAllowed: false,
      humanGateRequired: true,
      confirmationRequired: true,
      riskLevel: "high",
      reason:
        "Unknown action with write-like semantics defaults to forbidden_autonomous (fail-safe). Register the action in the matrix to enable it.",
    };
  }

  return {
    tier: "read_only",
    status: "planned",
    autonomousAllowed: false,
    humanGateRequired: false,
    confirmationRequired: false,
    riskLevel: "low",
    reason:
      "Unknown action with no write-like semantics. Treat as planned/unregistered read-only until explicitly classified.",
  };
}

/**
 * Validate internal consistency rules for a single item.
 * Returns a list of violation strings (empty = valid).
 */
export function validateItem(item: ActionReadinessItem): string[] {
  const violations: string[] = [];

  if (item.tier === "confirmed_write" && item.autonomousAllowed) {
    violations.push(
      `[${item.id}] confirmed_write must never be autonomous`
    );
  }
  if (item.tier === "confirmed_write" && !item.humanGateRequired) {
    violations.push(
      `[${item.id}] confirmed_write must have humanGateRequired=true`
    );
  }
  if (item.tier === "forbidden_autonomous" && item.autonomousAllowed) {
    violations.push(
      `[${item.id}] forbidden_autonomous must never be autonomous`
    );
  }
  if (item.tier === "draft_or_proposal" && item.autonomousAllowed) {
    violations.push(
      `[${item.id}] draft_or_proposal must not be autonomous (potential DB write or external effect)`
    );
  }
  if (
    item.tier === "read_only" &&
    item.humanGateRequired &&
    item.riskLevel === "none"
  ) {
    violations.push(
      `[${item.id}] read_only with riskLevel=none should not require a human gate`
    );
  }

  return violations;
}
