import { describe, it, expect } from "vitest";
import {
  ACTION_READINESS_ITEMS,
  buildActionReadinessMatrix,
  classifyUnknownAction,
  validateItem,
} from "../index";

// ─── Expected IDs ─────────────────────────────────────────────────────────────

const EXPECTED_READ_ONLY_IDS = [
  "navigate_admin_surface",
  "explain_product",
  "explain_yield",
  "compose_reporting_briefing",
  "review_router_quality",
  "inspect_tool_boundary",
  "read_observability",
  "explain_risk",
  "explain_provenance",
  "read_session_context",
];

const EXPECTED_DRAFT_IDS = [
  "create_review_note_draft",
  "create_governance_proposal_draft",
  "create_campaign_draft",
  "create_vault_draft",
  "draft_outreach_email",
];

const EXPECTED_CONFIRMED_WRITE_IDS = ["outreach_trigger_send_run"];

const EXPECTED_FORBIDDEN_IDS = [
  "source_leads_autonomously",
  "deploy_product",
  "mark_vault_live",
  "safe_signature",
  "governance_execution",
  "db_migration",
  "formula_model_change",
  "tier_a_auto_send",
];

const ALL_EXPECTED_IDS = [
  ...EXPECTED_READ_ONLY_IDS,
  ...EXPECTED_DRAFT_IDS,
  ...EXPECTED_CONFIRMED_WRITE_IDS,
  ...EXPECTED_FORBIDDEN_IDS,
];

// ─── Registry presence ────────────────────────────────────────────────────────

describe("ACTION_READINESS_ITEMS — presence", () => {
  it("contains all expected read-only action ids", () => {
    const ids = ACTION_READINESS_ITEMS.map((i) => i.id);
    for (const id of EXPECTED_READ_ONLY_IDS) {
      expect(ids).toContain(id);
    }
  });

  it("contains all expected draft/proposal action ids", () => {
    const ids = ACTION_READINESS_ITEMS.map((i) => i.id);
    for (const id of EXPECTED_DRAFT_IDS) {
      expect(ids).toContain(id);
    }
  });

  it("contains all expected confirmed-write action ids", () => {
    const ids = ACTION_READINESS_ITEMS.map((i) => i.id);
    for (const id of EXPECTED_CONFIRMED_WRITE_IDS) {
      expect(ids).toContain(id);
    }
  });

  it("contains all expected forbidden-autonomous action ids", () => {
    const ids = ACTION_READINESS_ITEMS.map((i) => i.id);
    for (const id of EXPECTED_FORBIDDEN_IDS) {
      expect(ids).toContain(id);
    }
  });

  it("has no duplicate ids", () => {
    const ids = ACTION_READINESS_ITEMS.map((i) => i.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every item has a non-empty label, reason, and examples", () => {
    for (const item of ACTION_READINESS_ITEMS) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.reason.length).toBeGreaterThan(0);
      expect(item.examples.length).toBeGreaterThan(0);
    }
  });
});

// ─── Tier assignment ──────────────────────────────────────────────────────────

describe("ACTION_READINESS_ITEMS — tier assignment", () => {
  it("all read-only items have tier=read_only", () => {
    for (const id of EXPECTED_READ_ONLY_IDS) {
      const item = ACTION_READINESS_ITEMS.find((i) => i.id === id);
      expect(item?.tier).toBe("read_only");
    }
  });

  it("all draft ids have tier=draft_or_proposal", () => {
    for (const id of EXPECTED_DRAFT_IDS) {
      const item = ACTION_READINESS_ITEMS.find((i) => i.id === id);
      expect(item?.tier).toBe("draft_or_proposal");
    }
  });

  it("outreach_trigger_send_run has tier=confirmed_write", () => {
    const item = ACTION_READINESS_ITEMS.find(
      (i) => i.id === "outreach_trigger_send_run"
    );
    expect(item?.tier).toBe("confirmed_write");
  });

  it("all forbidden ids have tier=forbidden_autonomous", () => {
    for (const id of EXPECTED_FORBIDDEN_IDS) {
      const item = ACTION_READINESS_ITEMS.find((i) => i.id === id);
      expect(item?.tier).toBe("forbidden_autonomous");
    }
  });
});

// ─── Autonomy rules ───────────────────────────────────────────────────────────

describe("ACTION_READINESS_ITEMS — autonomy rules", () => {
  it("all read-only items are autonomousAllowed=true", () => {
    const readOnlyItems = ACTION_READINESS_ITEMS.filter(
      (i) => i.tier === "read_only"
    );
    for (const item of readOnlyItems) {
      expect(item.autonomousAllowed).toBe(true);
    }
  });

  it("no draft/proposal item is autonomousAllowed=true", () => {
    const draftItems = ACTION_READINESS_ITEMS.filter(
      (i) => i.tier === "draft_or_proposal"
    );
    for (const item of draftItems) {
      expect(item.autonomousAllowed).toBe(false);
    }
  });

  it("no confirmed_write item is autonomousAllowed=true", () => {
    const writeItems = ACTION_READINESS_ITEMS.filter(
      (i) => i.tier === "confirmed_write"
    );
    for (const item of writeItems) {
      expect(item.autonomousAllowed).toBe(false);
    }
  });

  it("no forbidden_autonomous item is autonomousAllowed=true", () => {
    const forbiddenItems = ACTION_READINESS_ITEMS.filter(
      (i) => i.tier === "forbidden_autonomous"
    );
    for (const item of forbiddenItems) {
      expect(item.autonomousAllowed).toBe(false);
    }
  });
});

// ─── Gate rules ───────────────────────────────────────────────────────────────

describe("ACTION_READINESS_ITEMS — gate rules", () => {
  it("confirmed_write has humanGateRequired=true", () => {
    const writeItems = ACTION_READINESS_ITEMS.filter(
      (i) => i.tier === "confirmed_write"
    );
    for (const item of writeItems) {
      expect(item.humanGateRequired).toBe(true);
    }
  });

  it("confirmed_write has confirmationRequired=true", () => {
    const writeItems = ACTION_READINESS_ITEMS.filter(
      (i) => i.tier === "confirmed_write"
    );
    for (const item of writeItems) {
      expect(item.confirmationRequired).toBe(true);
    }
  });

  it("confirmed_write has a requiredGate string", () => {
    const writeItems = ACTION_READINESS_ITEMS.filter(
      (i) => i.tier === "confirmed_write"
    );
    for (const item of writeItems) {
      expect(typeof item.requiredGate).toBe("string");
      expect((item.requiredGate ?? "").length).toBeGreaterThan(0);
    }
  });

  it("forbidden_autonomous items have humanGateRequired=true", () => {
    const forbiddenItems = ACTION_READINESS_ITEMS.filter(
      (i) => i.tier === "forbidden_autonomous"
    );
    for (const item of forbiddenItems) {
      expect(item.humanGateRequired).toBe(true);
    }
  });
});

// ─── Safety — no execution suggestion ────────────────────────────────────────

const EXECUTION_VERBS = [
  "executes",
  "auto-executes",
  "runs autonomously",
  "auto-sends",
  "auto-deploys",
  "auto-signs",
  "auto-approves",
];

describe("ACTION_READINESS_ITEMS — no execution suggestion", () => {
  it("no item reason or label implies autonomous execution", () => {
    for (const item of ACTION_READINESS_ITEMS) {
      if (item.tier === "forbidden_autonomous" || item.tier === "confirmed_write") {
        for (const verb of EXECUTION_VERBS) {
          const inLabel = item.label.toLowerCase().includes(verb);
          const inReason = item.reason.toLowerCase().includes(verb);
          if (inLabel || inReason) {
            expect(
              `[${item.id}] contains execution suggestion "${verb}"`
            ).toBe("");
          }
        }
      }
    }
  });

  it("tier_a_auto_send is unconditionally blocked (critical risk, no gate workaround)", () => {
    const item = ACTION_READINESS_ITEMS.find((i) => i.id === "tier_a_auto_send");
    expect(item?.tier).toBe("forbidden_autonomous");
    expect(item?.riskLevel).toBe("critical");
    expect(item?.autonomousAllowed).toBe(false);
    expect(item?.status).toBe("blocked");
  });
});

// ─── Matrix build ─────────────────────────────────────────────────────────────

describe("buildActionReadinessMatrix", () => {
  const FIXED_TS = "2026-06-25T00:00:00.000Z";

  it("is deterministic — identical output on repeated calls with same generatedAt", () => {
    const m1 = buildActionReadinessMatrix(FIXED_TS);
    const m2 = buildActionReadinessMatrix(FIXED_TS);
    expect(JSON.stringify(m1)).toBe(JSON.stringify(m2));
  });

  it("counts match actual item counts per tier", () => {
    const matrix = buildActionReadinessMatrix(FIXED_TS);
    expect(matrix.counts.read_only).toBe(EXPECTED_READ_ONLY_IDS.length);
    expect(matrix.counts.draft_or_proposal).toBe(EXPECTED_DRAFT_IDS.length);
    expect(matrix.counts.confirmed_write).toBe(
      EXPECTED_CONFIRMED_WRITE_IDS.length
    );
    expect(matrix.counts.forbidden_autonomous).toBe(EXPECTED_FORBIDDEN_IDS.length);
  });

  it("total item count matches all expected ids", () => {
    const matrix = buildActionReadinessMatrix(FIXED_TS);
    expect(matrix.items.length).toBe(ALL_EXPECTED_IDS.length);
  });

  it("generatedAt is stored verbatim", () => {
    const matrix = buildActionReadinessMatrix(FIXED_TS);
    expect(matrix.generatedAt).toBe(FIXED_TS);
  });

  it("safetyNotes is a non-empty array of strings", () => {
    const matrix = buildActionReadinessMatrix(FIXED_TS);
    expect(matrix.safetyNotes.length).toBeGreaterThan(0);
    for (const note of matrix.safetyNotes) {
      expect(typeof note).toBe("string");
      expect(note.length).toBeGreaterThan(0);
    }
  });

  it("validates all items without throwing", () => {
    expect(() => buildActionReadinessMatrix(FIXED_TS)).not.toThrow();
  });
});

// ─── validateItem ─────────────────────────────────────────────────────────────

describe("validateItem", () => {
  it("returns no violations for all registered items", () => {
    for (const item of ACTION_READINESS_ITEMS) {
      const violations = validateItem(item);
      expect(violations).toHaveLength(0);
    }
  });

  it("flags confirmed_write that is autonomous", () => {
    const bad = ACTION_READINESS_ITEMS.find(
      (i) => i.id === "outreach_trigger_send_run"
    )!;
    const violations = validateItem({ ...bad, autonomousAllowed: true });
    expect(violations.some((v) => v.includes("confirmed_write"))).toBe(true);
  });

  it("flags confirmed_write without human gate", () => {
    const bad = ACTION_READINESS_ITEMS.find(
      (i) => i.id === "outreach_trigger_send_run"
    )!;
    const violations = validateItem({ ...bad, humanGateRequired: false });
    expect(violations.some((v) => v.includes("humanGateRequired"))).toBe(true);
  });

  it("flags forbidden_autonomous that is autonomous", () => {
    const bad = ACTION_READINESS_ITEMS.find((i) => i.id === "deploy_product")!;
    const violations = validateItem({ ...bad, autonomousAllowed: true });
    expect(violations.some((v) => v.includes("forbidden_autonomous"))).toBe(true);
  });

  it("flags draft_or_proposal that is autonomous", () => {
    const bad = ACTION_READINESS_ITEMS.find(
      (i) => i.id === "create_vault_draft"
    )!;
    const violations = validateItem({ ...bad, autonomousAllowed: true });
    expect(violations.some((v) => v.includes("draft_or_proposal"))).toBe(true);
  });
});

// ─── classifyUnknownAction ────────────────────────────────────────────────────

describe("classifyUnknownAction", () => {
  it("classifies write-like unknown id as forbidden_autonomous", () => {
    const result = classifyUnknownAction("trigger_deploy_something");
    expect(result.tier).toBe("forbidden_autonomous");
    expect(result.autonomousAllowed).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.riskLevel).toBe("high");
  });

  it("classifies send-like unknown id as forbidden_autonomous", () => {
    const result = classifyUnknownAction("send_email_to_everyone");
    expect(result.tier).toBe("forbidden_autonomous");
    expect(result.autonomousAllowed).toBe(false);
  });

  it("classifies non-write unknown id as read_only planned", () => {
    const result = classifyUnknownAction("view_dashboard_summary");
    expect(result.tier).toBe("read_only");
    expect(result.status).toBe("planned");
    expect(result.autonomousAllowed).toBe(false);
  });

  it("unknown action with delete-like semantics is forbidden_autonomous", () => {
    const result = classifyUnknownAction("delete_vault_record");
    expect(result.tier).toBe("forbidden_autonomous");
    expect(result.autonomousAllowed).toBe(false);
  });
});
