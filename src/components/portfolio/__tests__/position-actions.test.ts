/**
 * Unit tests for PositionActions — two-step withdrawal confirmation (Lot 3).
 *
 * The project's component tests assert logic contracts rather than render DOM
 * (no jsdom / @testing-library installed — see share-class-compare.test.tsx).
 * The two-step invariant is encoded in pure, exported phase-machine helpers
 * that the component itself calls, so testing them tests the real behaviour:
 *
 *   - clicking "Withdraw" (intent) only opens the review card → NO chain call;
 *   - the on-chain withdrawal may run ONLY from the "confirm" phase;
 *   - "Cancel" returns to idle with no side effect.
 */

import { describe, it, expect } from "vitest";

import {
  phaseAfterReviewClick,
  phaseAfterCancel,
  canRunOnChainWithdraw,
} from "@/components/portfolio/position-actions";

describe("PositionActions — two-step withdrawal contract", () => {
  it("clicking Withdraw (intent) opens the review card without reaching the chain", () => {
    // From a resting state, the intent click moves to "confirm"…
    expect(phaseAfterReviewClick("idle")).toBe("confirm");
    expect(phaseAfterReviewClick("error")).toBe("confirm");
    // …and the on-chain path is NOT yet runnable from "idle".
    expect(canRunOnChainWithdraw("idle")).toBe(false);
    expect(canRunOnChainWithdraw("error")).toBe(false);
  });

  it("the on-chain withdrawal runs ONLY from the confirm phase", () => {
    expect(canRunOnChainWithdraw("confirm")).toBe(true);

    // Never runnable from any other phase — defence against double-submit and
    // accidental direct invocation.
    expect(canRunOnChainWithdraw("idle")).toBe(false);
    expect(canRunOnChainWithdraw("redeeming")).toBe(false);
    expect(canRunOnChainWithdraw("recording")).toBe(false);
    expect(canRunOnChainWithdraw("done")).toBe(false);
    expect(canRunOnChainWithdraw("error")).toBe(false);
  });

  it("Cancel returns to idle with no side effect", () => {
    expect(phaseAfterCancel()).toBe("idle");
  });

  it("the intent click is a no-op while a transaction is in flight or finished", () => {
    // The intent button is not shown in these phases; the helper must not yank
    // an in-flight or completed flow back into the review card.
    expect(phaseAfterReviewClick("redeeming")).toBe("redeeming");
    expect(phaseAfterReviewClick("recording")).toBe("recording");
    expect(phaseAfterReviewClick("confirm")).toBe("confirm");
    expect(phaseAfterReviewClick("done")).toBe("done");
  });
});
