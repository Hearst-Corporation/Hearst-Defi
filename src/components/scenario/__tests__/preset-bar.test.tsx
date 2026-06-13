import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PresetBar } from "@/components/scenario/preset-bar";

describe("PresetBar", () => {
  it("renders calm ghost preset tiles — no primary CTA fill on selection", () => {
    const html = renderToStaticMarkup(
      <PresetBar selected="base" onSelect={vi.fn()} />,
    );
    expect(html).toContain("scenario-preset-bar__button");
    expect(html).not.toContain("scenario-preset-bar__button--active");
    expect(html).not.toContain('variant="ghost"');
    expect(html).not.toContain("ct-bg-accent");
    expect(html).not.toContain("ct-glow-accent");
  });

  it("exposes correct single-select ARIA: radiogroup + radio + aria-checked", () => {
    const html = renderToStaticMarkup(
      <PresetBar selected="btc_bear" onSelect={vi.fn()} />,
    );
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('role="radio"');
    expect(html).toContain('aria-checked="true"');
    expect(html).not.toContain("aria-pressed");
    expect(html).not.toContain("scenario-preset-bar__button--active");
    expect(html).not.toContain("<nav");
  });

  it("all buttons aria-checked=false when nothing is selected", () => {
    const html = renderToStaticMarkup(
      <PresetBar selected={null} onSelect={vi.fn()} />,
    );
    expect(html).not.toContain('aria-checked="true"');
    const falseMatches = html.match(/aria-checked="false"/g);
    expect(falseMatches).toHaveLength(5);
  });

  it("roving tabindex: first button is tabbable when nothing selected", () => {
    const html = renderToStaticMarkup(
      <PresetBar selected={null} onSelect={vi.fn()} />,
    );
    const zeroCount = (html.match(/tabindex="0"/g) ?? []).length;
    const negOneCount = (html.match(/tabindex="-1"/g) ?? []).length;
    expect(zeroCount).toBe(1);
    expect(negOneCount).toBe(4);
  });

  it("roving tabindex: active button is tabbable when preset is selected", () => {
    const html = renderToStaticMarkup(
      <PresetBar selected="extreme_stress" onSelect={vi.fn()} />,
    );
    // Only the active (last) button should have tabindex=0
    const zeroCount = (html.match(/tabindex="0"/g) ?? []).length;
    const negOneCount = (html.match(/tabindex="-1"/g) ?? []).length;
    expect(zeroCount).toBe(1);
    expect(negOneCount).toBe(4);
  });
});
