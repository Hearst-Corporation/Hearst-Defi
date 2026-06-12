/**
 * Accreditation attestation fields — structural checks (static markup).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";

import {
  AccreditationAttestationFields,
  type AccreditationAttestationState,
} from "../accreditation-attestations";

const INITIAL_STATE: AccreditationAttestationState = {
  allChecked: false,
  isPending: false,
  attestError: null,
  toggle: () => {},
  isChecked: () => false,
  handleContinue: () => {},
};

const ALL_CHECKED_STATE: AccreditationAttestationState = {
  allChecked: true,
  isPending: false,
  attestError: null,
  toggle: () => {},
  isChecked: () => true,
  handleContinue: () => {},
};

describe("AccreditationAttestationFields — static / initial state", () => {
  it("renders exactly 3 checkbox inputs", () => {
    const html = renderToStaticMarkup(
      <AccreditationAttestationFields state={INITIAL_STATE} />,
    );
    const matches = html.match(/type="checkbox"/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(3);
  });

  it("renders all three attestation IDs", () => {
    const html = renderToStaticMarkup(
      <AccreditationAttestationFields state={INITIAL_STATE} />,
    );
    expect(html).toContain("rule-506c");
    expect(html).toContain("cayman-pif");
    expect(html).toContain("not-guaranteed");
  });

  it("renders the hint text when no boxes checked", () => {
    const html = renderToStaticMarkup(
      <AccreditationAttestationFields state={INITIAL_STATE} />,
    );
    expect(html).toContain("All three attestations are required");
  });

  it("each checkbox has an associated label (htmlFor matches id)", () => {
    const html = renderToStaticMarkup(
      <AccreditationAttestationFields state={INITIAL_STATE} />,
    );
    expect(html).toContain('for="attest-rule-506c"');
    expect(html).toContain('id="attest-rule-506c"');
    expect(html).toContain('for="attest-cayman-pif"');
    expect(html).toContain('for="attest-not-guaranteed"');
  });

  it("uses DS Checkbox — sr-only input + ct-checkbox visual", () => {
    const html = renderToStaticMarkup(
      <AccreditationAttestationFields state={INITIAL_STATE} />,
    );
    expect(html).toContain('class="sr-only"');
    expect(html).toContain("ct-checkbox");
    expect(html).not.toContain("accent-[var(--ct-accent)]");
  });

  it("renders ct-checkbox__box--checked on checked boxes", () => {
    const html = renderToStaticMarkup(
      <AccreditationAttestationFields state={ALL_CHECKED_STATE} />,
    );
    const checkedMatches = html.match(/ct-checkbox__box--checked/g);
    expect(checkedMatches).not.toBeNull();
    expect(checkedMatches?.length).toBe(3);
  });

  it("renders attestError when present", () => {
    const html = renderToStaticMarkup(
      <AccreditationAttestationFields
        state={{ ...INITIAL_STATE, attestError: "Authentication required." }}
      />,
    );
    expect(html).toContain("Authentication required.");
    expect(html).toContain('role="alert"');
  });

  it("includes APY range disclaimer (not single point)", () => {
    const html = renderToStaticMarkup(
      <AccreditationAttestationFields state={INITIAL_STATE} />,
    );
    expect(html).toContain("8–15%");
    expect(html).toContain("not a commitment of future returns");
  });
});
