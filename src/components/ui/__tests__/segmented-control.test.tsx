import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SegmentedControl } from "@/components/ui/segmented-control";

const ITEMS = [
  { value: "a", label: "A" },
  { value: "b", label: "B" },
] as const;

describe("SegmentedControl", () => {
  it("renders canonical ct-seg classes, never an accent fill", () => {
    const html = renderToStaticMarkup(
      <SegmentedControl
        items={ITEMS}
        value="a"
        onChange={vi.fn()}
        ariaLabel="Test group"
      />,
    );
    expect(html).toContain("ct-seg-track");
    expect(html).toContain("ct-seg-btn");
    // selection stays quiet — accent fill is reserved for primary actions.
    expect(html).not.toContain("ct-bg-accent");
    expect(html).not.toContain("ct-glow-accent");
  });

  it("tablist variant: role/aria + roving tabindex on the active item", () => {
    const html = renderToStaticMarkup(
      <SegmentedControl
        items={ITEMS}
        value="a"
        onChange={vi.fn()}
        ariaLabel="Test group"
        variant="tablist"
      />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain(" active");
  });

  it("radiogroup variant: uses aria-checked, not aria-selected", () => {
    const html = renderToStaticMarkup(
      <SegmentedControl
        items={ITEMS}
        value="b"
        onChange={vi.fn()}
        ariaLabel="Test group"
        variant="radiogroup"
      />,
    );
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('role="radio"');
    expect(html).toContain('aria-checked="true"');
    expect(html).not.toContain("aria-selected");
  });
});
