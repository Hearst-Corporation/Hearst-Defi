import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PresetBar } from "@/components/scenario/preset-bar";

describe("PresetBar", () => {
  it("uses calm ghost preset tiles — no primary CTA fill on selection", () => {
    const html = renderToStaticMarkup(
      <PresetBar selected="base" onSelect={vi.fn()} />,
    );
    expect(html).toContain("scenario-preset-bar__button");
    expect(html).toContain("scenario-preset-bar__button--active");
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain("ct-bg-accent");
    expect(html).not.toContain("ct-glow-accent");
  });
});
