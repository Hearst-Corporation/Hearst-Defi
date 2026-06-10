/**
 * StepProgressBar unit tests.
 *
 * Verifies:
 *   1. Renders correct number of steps (4)
 *   2. Active step has aria-current="step"
 *   3. role="progressbar" with aria-valuenow, aria-valuemin, aria-valuemax
 *   4. aria-valuetext includes step name
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";

import { StepProgressBar } from "../StepProgressBar";

describe("StepProgressBar", () => {
  it("renders all 4 step labels", () => {
    const html = renderToStaticMarkup(<StepProgressBar active="landing" />);
    const expectedLabels = ["Start", "Accreditation", "Identity", "Wallet"];
    for (const label of expectedLabels) {
      expect(html).toContain(label);
    }
  });

  it("has role=progressbar", () => {
    const html = renderToStaticMarkup(<StepProgressBar active="accreditation" />);
    expect(html).toContain('role="progressbar"');
  });

  it("sets aria-valuenow to the active step index (1-based)", () => {
    // "accreditation" is step index 2
    const html = renderToStaticMarkup(<StepProgressBar active="accreditation" />);
    expect(html).toContain('aria-valuenow="2"');
  });

  it("sets aria-valuemin=1 and aria-valuemax=4", () => {
    const html = renderToStaticMarkup(<StepProgressBar active="landing" />);
    expect(html).toContain('aria-valuemin="1"');
    expect(html).toContain('aria-valuemax="4"');
  });

  it("marks the active step with aria-current=step", () => {
    const html = renderToStaticMarkup(<StepProgressBar active="wallet" />);
    expect(html).toContain('aria-current="step"');
  });

  it("active=wallet sets aria-valuenow=4", () => {
    const html = renderToStaticMarkup(<StepProgressBar active="wallet" />);
    expect(html).toContain('aria-valuenow="4"');
  });

  it("renders aria-valuetext with step name", () => {
    const html = renderToStaticMarkup(<StepProgressBar active="identity" />);
    expect(html).toContain("Step 3 of 4");
    expect(html).toContain("Identity");
  });
});
