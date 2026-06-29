import { describe, expect, it } from "vitest";

import {
  nextExitRecoveryState,
  type ExitRecoveryTriggers,
} from "@/lib/products/exit-recovery";
import { containsForbidden } from "@/lib/agents/forbidden-words";

function triggers(over: Partial<ExitRecoveryTriggers> = {}): ExitRecoveryTriggers {
  return {
    targetReached: false,
    maturityReached: false,
    capitalNotRecovered: false,
    coverageStress: false,
    collateralStress: false,
    operatorGovernanceApproved: false,
    ...over,
  };
}

describe("nextExitRecoveryState", () => {
  it("targetReached before maturity → EARLY_EXIT_ELIGIBLE", () => {
    const r = nextExitRecoveryState("ACTIVE", triggers({ targetReached: true }));
    expect(r.state).toBe("EARLY_EXIT_ELIGIBLE");
  });

  it("maturity + capital recovered → NORMAL_MATURITY", () => {
    const r = nextExitRecoveryState(
      "TARGET_PROGRESS",
      triggers({ maturityReached: true, capitalNotRecovered: false }),
    );
    expect(r.state).toBe("NORMAL_MATURITY");
  });

  it("maturity + capital NOT recovered → RECOVERY_MODE, default capital_only", () => {
    const r = nextExitRecoveryState(
      "TARGET_PROGRESS",
      triggers({ maturityReached: true, capitalNotRecovered: true }),
    );
    expect(r.state).toBe("RECOVERY_MODE");
    expect(r.recoveryMode).toBe("capital_only");
  });

  it("recovery does NOT promise guaranteed recovery", () => {
    const r = nextExitRecoveryState(
      "ACTIVE",
      triggers({ maturityReached: true, capitalNotRecovered: true }),
    );
    expect(r.guaranteedRecovery).toBe(false);
    // and the note carries no forbidden guarantee language
    expect(containsForbidden(r.note)).toBeNull();
    expect(r.note).toMatch(/not a promise|maximizes the probability/i);
  });

  it("coverage/collateral stress (before maturity) → PROTECTION_MODE", () => {
    expect(
      nextExitRecoveryState("ACTIVE", triggers({ coverageStress: true })).state,
    ).toBe("PROTECTION_MODE");
    expect(
      nextExitRecoveryState("ACTIVE", triggers({ collateralStress: true })).state,
    ).toBe("PROTECTION_MODE");
  });

  it("maturity takes priority over stress — matured-unrecovered lands in RECOVERY_MODE", () => {
    const r = nextExitRecoveryState(
      "ACTIVE",
      triggers({
        maturityReached: true,
        capitalNotRecovered: true,
        coverageStress: true,
        collateralStress: true,
      }),
    );
    expect(r.state).toBe("RECOVERY_MODE");
  });

  it("no trigger from ACTIVE → TARGET_PROGRESS; CLOSED is terminal", () => {
    expect(nextExitRecoveryState("ACTIVE", triggers()).state).toBe(
      "TARGET_PROGRESS",
    );
    expect(nextExitRecoveryState("CLOSED", triggers({ targetReached: true })).state).toBe(
      "CLOSED",
    );
  });

  it("no guarantee language in any emitted note", () => {
    const notes = [
      nextExitRecoveryState("ACTIVE", triggers({ targetReached: true })).note,
      nextExitRecoveryState("ACTIVE", triggers({ maturityReached: true })).note,
      nextExitRecoveryState(
        "ACTIVE",
        triggers({ maturityReached: true, capitalNotRecovered: true }),
      ).note,
      nextExitRecoveryState("ACTIVE", triggers({ coverageStress: true })).note,
    ];
    for (const n of notes) {
      expect(containsForbidden(n)).toBeNull();
    }
  });
});
