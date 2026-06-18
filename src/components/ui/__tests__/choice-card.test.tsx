import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ChoiceCard, ChoiceGroup } from "@/components/ui/choice-card";

describe("ChoiceCard", () => {
  it("renders canonical ct-choice-card classes and radio semantics", () => {
    const html = renderToStaticMarkup(
      <ChoiceCard label="Family office" selected onClick={vi.fn()} />,
    );
    expect(html).toContain("ct-choice-card");
    expect(html).toContain("ct-choice-card--selected");
    expect(html).toContain('role="radio"');
    expect(html).toContain('aria-checked="true"');
  });
});

describe("ChoiceGroup", () => {
  it("renders fieldset with ct-form-label legend", () => {
    const html = renderToStaticMarkup(
      <ChoiceGroup legend="Platform type">
        <ChoiceCard label="RIA" selected={false} onClick={vi.fn()} />
      </ChoiceGroup>,
    );
    expect(html).toContain("<fieldset");
    expect(html).toContain("ct-form-label");
    expect(html).toContain("ct-choice-group__options");
  });
});
