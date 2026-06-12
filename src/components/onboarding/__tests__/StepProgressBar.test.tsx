/**
 * StepProgressBar unit tests — 3-step onboarding wizard.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";

import { StepProgressBar } from "../StepProgressBar";

describe("StepProgressBar", () => {
  it("renders all 3 step labels", () => {
    const html = renderToStaticMarkup(<StepProgressBar active="accreditation" />);
    const expectedLabels = ["Accreditation", "Identity", "Wallet"];
    for (const label of expectedLabels) {
      expect(html).toContain(label);
    }
  });

  it("has role=progressbar", () => {
    const html = renderToStaticMarkup(<StepProgressBar active="accreditation" />);
    expect(html).toContain('role="progressbar"');
  });

  it("sets aria-valuenow to the active step index (1-based)", () => {
    const html = renderToStaticMarkup(<StepProgressBar active="identity" />);
    expect(html).toContain('aria-valuenow="2"');
  });

  it("sets aria-valuemin=1 and aria-valuemax=3", () => {
    const html = renderToStaticMarkup(<StepProgressBar active="accreditation" />);
    expect(html).toContain('aria-valuemin="1"');
    expect(html).toContain('aria-valuemax="3"');
  });

  it("marks the active step with aria-current=step", () => {
    const html = renderToStaticMarkup(<StepProgressBar active="wallet" />);
    expect(html).toContain('aria-current="step"');
  });

  it("active=wallet sets aria-valuenow=3", () => {
    const html = renderToStaticMarkup(<StepProgressBar active="wallet" />);
    expect(html).toContain('aria-valuenow="3"');
  });

  it("uses DS wizard-step-progress classes without inline glow utilities", () => {
    const html = renderToStaticMarkup(<StepProgressBar active="identity" />);
    expect(html).toContain("wizard-step-progress");
    expect(html).toContain("wizard-step-progress__dot--active");
    expect(html).not.toContain("shadow-");
    expect(html).not.toContain("ct-glow");
    expect(html).not.toContain("accent-soft");
  });
});
