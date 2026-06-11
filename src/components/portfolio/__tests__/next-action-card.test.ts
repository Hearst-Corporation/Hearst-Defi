/**
 * Unit tests for NextActionCard's pure step resolver (UX premium).
 *
 * resolveNextStep is a pure, total function of four status flags — the page
 * renders exactly one primary action from it. Tests assert the priority order
 * and that the serene "ready" state still offers a quiet secondary action,
 * never a forbidden/promised-return phrasing.
 */

import { describe, it, expect } from "vitest";

import {
  resolveNextStep,
  shouldShowNextActionCard,
} from "@/components/portfolio/next-action-card";

const base = {
  kycStatus: "approved",
  accreditationAttested: true,
  hasWallet: true,
  positionCount: 1,
};

describe("resolveNextStep — single next action by priority", () => {
  it("rejected KYC takes precedence over everything", () => {
    const step = resolveNextStep({ ...base, kycStatus: "rejected" });
    expect(step.cta?.href).toBe("/profile");
    expect(step.headline.toLowerCase()).toContain("attention");
  });

  it("missing accreditation routes to onboarding before KYC/wallet checks", () => {
    const step = resolveNextStep({
      ...base,
      accreditationAttested: false,
      kycStatus: "pending",
      hasWallet: false,
      positionCount: 0,
    });
    expect(step.cta?.href).toBe("/onboarding/accreditation");
  });

  it("active positions skip onboarding even when accreditation flag is false", () => {
    const step = resolveNextStep({
      ...base,
      accreditationAttested: false,
      positionCount: 2,
    });
    expect(step.eyebrow).not.toBe("Get started");
    expect(step.cta?.href).not.toBe("/onboarding/accreditation");
    expect(step.headline.toLowerCase()).toContain("ready");
  });

  it("pending KYC (accreditation done) shows a no-action review state", () => {
    const step = resolveNextStep({
      ...base,
      kycStatus: "pending",
      positionCount: 0,
    });
    expect(step.cta).toBeUndefined(); // nothing for the user to do
    expect(step.headline.toLowerCase()).toContain("progress");
  });

  it("approved but no wallet → connect wallet", () => {
    const step = resolveNextStep({
      ...base,
      hasWallet: false,
      positionCount: 0,
    });
    expect(step.cta?.href).toBe("/onboarding/wallet");
  });

  it("ready to invest, no positions → explore the vault", () => {
    const step = resolveNextStep({ ...base, positionCount: 0 });
    expect(step.cta?.href).toBe("/vaults");
    expect(step.headline.toLowerCase()).toContain("first investment");
  });

  it("fully set up with positions → serene ready state with a quiet secondary CTA", () => {
    const step = resolveNextStep(base);
    expect(step.headline.toLowerCase()).toContain("ready");
    expect(step.cta?.href).toBe("/vaults");
  });

  it("hides the card when investor is fully operational with live positions", () => {
    expect(shouldShowNextActionCard(base)).toBe(false);
  });

  it("hides the card whenever positions exist, even if onboarding flags lag", () => {
    // Product rule: a funded portfolio means onboarding is done. Never surface a
    // get-started / "ready" CTA on top of live positions, regardless of stale flags.
    expect(
      shouldShowNextActionCard({
        ...base,
        accreditationAttested: false,
        kycStatus: "pending",
        hasWallet: false,
        positionCount: 2,
      }),
    ).toBe(false);
  });

  it("still surfaces the card for rejected KYC, even mid-portfolio", () => {
    expect(
      shouldShowNextActionCard({ ...base, kycStatus: "rejected", positionCount: 3 }),
    ).toBe(true);
  });

  it("shows the card pre-position when onboarding flags are incomplete", () => {
    expect(
      shouldShowNextActionCard({
        ...base,
        accreditationAttested: false,
        positionCount: 0,
      }),
    ).toBe(true);
  });

  it("never uses forbidden words across any state", () => {
    const forbidden = ["guarantee", "promise", "certain", "will deliver", "risk-free"];
    const states = [
      { ...base, kycStatus: "rejected" },
      { ...base, accreditationAttested: false },
      { ...base, kycStatus: "pending" },
      { ...base, hasWallet: false },
      { ...base, positionCount: 0 },
      base,
    ];
    for (const s of states) {
      const step = resolveNextStep(s);
      const text = `${step.eyebrow} ${step.headline} ${step.detail ?? ""} ${step.cta?.label ?? ""}`.toLowerCase();
      for (const w of forbidden) expect(text).not.toContain(w);
    }
  });
});
