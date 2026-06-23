import { describe, expect, it } from "vitest";

import {
  evaluateVaultProjectionReadiness,
  evaluateVaultPublishReadiness,
  resolveAgentVaultAction,
  VAULT_AGENT_ACTION_MATRIX,
  type VaultProductBlueprint,
} from "../blueprint";

// A complete, publish-ready blueprint. Individual tests degrade it field by
// field to prove each gate.
function completeBlueprint(
  overrides: Partial<VaultProductBlueprint> = {},
): VaultProductBlueprint {
  return {
    id: "hyv-test",
    name: "Hearst Yield Vault (test)",
    status: "deployed",
    strategy: "mining_yield",
    assetType: "structured-yield",
    jurisdiction: "cayman",
    investorPersona: "qualified-institutional",
    terms: {
      minTicketUsdc: 250_000,
      capacityUsdc: 50_000_000,
      softLockupDays: 60,
      mgmtFeeBps: 100,
      perfFeeBps: 1_000,
      hurdleBps: 0,
      targetApyLowBps: 800,
      targetApyHighBps: 1_500,
    },
    projectionInputs: {
      allocation: {
        miningBps: 6_000,
        btcTacticalBps: 2_500,
        usdcBaseBps: 1_000,
        stableReserveBps: 500,
      },
      hasTerms: true,
    },
    riskProfile: "Market, mining, liquidity, smart-contract and counterparty risk apply.",
    complianceNotes:
      "Offered to qualified investors via a Cayman SPV. Outcomes are not guaranteed.",
    requiredDocuments: ["PPM", "LPA"],
    onboardingRequirements: {
      requiresAccreditation: true,
      requiresKyc: true,
      requiresWallet: true,
    },
    approvals: { distinctApprovers: 3, requiredSigners: 3 },
    ...overrides,
  };
}

describe("evaluateVaultProjectionReadiness", () => {
  it("a complete blueprint can run a projection", () => {
    const r = evaluateVaultProjectionReadiness(completeBlueprint());
    expect(r.projectionCanRun).toBe(true);
    expect(r.level).toBe("ready");
    expect(r.blockers).toHaveLength(0);
  });

  it("missing terms blocks projection (projection is not a source of truth)", () => {
    const r = evaluateVaultProjectionReadiness(
      completeBlueprint({
        terms: {
          ...completeBlueprint().terms,
          minTicketUsdc: 0,
          capacityUsdc: 0,
        },
      }),
    );
    expect(r.projectionCanRun).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/Missing terms/);
  });

  it("a single-point APY (low == high) is not a valid range → blocks projection", () => {
    const r = evaluateVaultProjectionReadiness(
      completeBlueprint({
        terms: {
          ...completeBlueprint().terms,
          targetApyLowBps: 1_000,
          targetApyHighBps: 1_000,
        },
      }),
    );
    expect(r.projectionCanRun).toBe(false);
  });

  it("allocation that does not sum to 10000 bps blocks projection", () => {
    const r = evaluateVaultProjectionReadiness(
      completeBlueprint({
        projectionInputs: {
          hasTerms: true,
          allocation: {
            miningBps: 6_000,
            btcTacticalBps: 2_500,
            usdcBaseBps: 1_000,
            stableReserveBps: 0, // sum = 9500
          },
        },
      }),
    );
    expect(r.projectionCanRun).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/10000 bps/);
  });

  it("a missing risk disclosure warns but does not block projection", () => {
    const r = evaluateVaultProjectionReadiness(
      completeBlueprint({ riskProfile: "" }),
    );
    expect(r.projectionCanRun).toBe(true);
    expect(r.level).toBe("warning");
    expect(r.warnings.join(" ")).toMatch(/risk disclosure/);
  });
});

describe("evaluateVaultPublishReadiness", () => {
  it("a complete, approved blueprint can publish", () => {
    const r = evaluateVaultPublishReadiness(completeBlueprint());
    expect(r.publishCanHappen).toBe(true);
    expect(r.blockers).toHaveLength(0);
  });

  it("missing risk disclosure blocks publish", () => {
    const r = evaluateVaultPublishReadiness(completeBlueprint({ riskProfile: "" }));
    expect(r.publishCanHappen).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/risk disclosure/);
  });

  it("missing compliance notes blocks publish", () => {
    const r = evaluateVaultPublishReadiness(completeBlueprint({ complianceNotes: "" }));
    expect(r.publishCanHappen).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/compliance/i);
  });

  it("incomplete projection inputs block publish", () => {
    const r = evaluateVaultPublishReadiness(
      completeBlueprint({
        projectionInputs: { hasTerms: false, allocation: completeBlueprint().projectionInputs.allocation },
      }),
    );
    expect(r.publishCanHappen).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/Projection cannot run/);
  });

  it("incomplete eligibility (no KYC required) blocks publish", () => {
    const r = evaluateVaultPublishReadiness(
      completeBlueprint({
        onboardingRequirements: {
          requiresAccreditation: true,
          requiresKyc: false,
          requiresWallet: true,
        },
      }),
    );
    expect(r.publishCanHappen).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/Eligibility/);
  });

  it("no investor documents blocks publish", () => {
    const r = evaluateVaultPublishReadiness(completeBlueprint({ requiredDocuments: [] }));
    expect(r.publishCanHappen).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/documents/i);
  });

  it("missing approval quorum blocks publish (publish requires approval)", () => {
    const r = evaluateVaultPublishReadiness(
      completeBlueprint({ approvals: { distinctApprovers: 1, requiredSigners: 3 } }),
    );
    expect(r.publishCanHappen).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/Approval missing: 1\/3/);
  });

  it("publishing a still-draft blueprint warns even when otherwise complete", () => {
    const r = evaluateVaultPublishReadiness(completeBlueprint({ status: "draft" }));
    // still complete enough to publish, but the warning surfaces the skipped review
    expect(r.warnings.join(" ")).toMatch(/draft/);
  });

  it("publish is strictly stricter than projection (risk gate)", () => {
    const noRisk = completeBlueprint({ riskProfile: "" });
    expect(evaluateVaultProjectionReadiness(noRisk).projectionCanRun).toBe(true);
    expect(evaluateVaultPublishReadiness(noRisk).publishCanHappen).toBe(false);
  });
});

describe("VAULT_AGENT_ACTION_MATRIX + resolveAgentVaultAction", () => {
  it("agent can draft/propose without confirmation", () => {
    const bp = completeBlueprint();
    for (const action of [
      "draft_blueprint",
      "propose_projection_assumptions",
      "generate_investor_copy",
      "flag_compliance_gaps",
      "prepare_approval_memo",
    ] as const) {
      const r = resolveAgentVaultAction(action, bp);
      expect(r.allowed).toBe(true);
      expect(r.requiresConfirmation).toBe(false);
    }
  });

  it("modifying the blueprint requires confirmation", () => {
    const r = resolveAgentVaultAction("modify_blueprint", completeBlueprint());
    expect(r.allowed).toBe(true);
    expect(r.requiresConfirmation).toBe(true);
  });

  it("running a projection is gated on complete inputs", () => {
    const ok = resolveAgentVaultAction("run_projection", completeBlueprint());
    expect(ok.allowed).toBe(true);

    const blocked = resolveAgentVaultAction(
      "run_projection",
      completeBlueprint({
        projectionInputs: { hasTerms: false, allocation: completeBlueprint().projectionInputs.allocation },
      }),
    );
    expect(blocked.allowed).toBe(false);
  });

  it("an agent CANNOT publish from an incomplete blueprint", () => {
    const incomplete = completeBlueprint({
      riskProfile: "",
      approvals: { distinctApprovers: 0, requiredSigners: 3 },
    });
    const r = resolveAgentVaultAction("publish_vault", incomplete);
    expect(r.allowed).toBe(false);
    // even when blocked, publish always demands confirmation as a backstop
    expect(r.requiresConfirmation).toBe(true);
  });

  it("publishing a complete blueprint is allowed but still requires confirmation", () => {
    const r = resolveAgentVaultAction("publish_vault", completeBlueprint());
    expect(r.allowed).toBe(true);
    expect(r.requiresConfirmation).toBe(true);
  });

  it("every matrix entry has a guard and note", () => {
    for (const policy of VAULT_AGENT_ACTION_MATRIX) {
      expect(policy.guard).toBeTruthy();
      expect(policy.note.length).toBeGreaterThan(0);
    }
  });
});
