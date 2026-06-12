/**
 * Tests for chart overlay components.
 *
 * These tests exercise the pure logic contracts (prop defaults, class/text
 * derivation, aria attributes) without mounting React DOM — consistent with
 * the project's `environment: "node"` vitest config.
 */

import { describe, it, expect, vi } from "vitest";

// ── ChartProvenanceCorner ─────────────────────────────────────────────────────
import {
  ChartProvenanceCorner,
  type ChartProvenanceCornerProps,
} from "@/components/ui/chart-provenance-corner";

// ── ChartTimeSelector ─────────────────────────────────────────────────────────
import {
  ChartTimeSelector,
  type TimeRange,
  type ChartTimeSelectorProps,
} from "@/components/ui/chart-time-selector";

// ── ChartDisclaimerUnderlay ───────────────────────────────────────────────────
import {
  ChartDisclaimerUnderlay,
  type ChartDisclaimerUnderlayProps,
} from "@/components/ui/chart-disclaimer-underlay";

// Helper: extract class names from JSX output by calling the component as a
// plain function (valid because Server Components are plain functions).
// For client components we inspect the props that would be passed to the DOM.

// ─────────────────────────────────────────────────────────────────────────────
// 1. ChartProvenanceCorner — kind="live" renders badge + position class
// ─────────────────────────────────────────────────────────────────────────────
describe("ChartProvenanceCorner", () => {
  it('renders with kind="live" and default top-right position', () => {
    const props: ChartProvenanceCornerProps = { kind: "live" };
    const element = ChartProvenanceCorner(props);

    // Must produce a JSX element (React.ReactElement)
    expect(element).not.toBeNull();
    expect(element).toBeDefined();

    // className string must contain the top-right positioning token
    const className = (element as { props: { className?: string } }).props
      .className as string;
    expect(className).toContain("top-2");
    expect(className).toContain("right-2");
    expect(className).toContain("chart-provenance-corner");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 2. ChartProvenanceCorner — lastUpdateAt produces formatted tooltip text
  // ─────────────────────────────────────────────────────────────────────────
  it("includes lastUpdateAt time in the title tooltip", () => {
    // Fixed date so the assertion is deterministic regardless of TZ.
    const fixedDate = new Date("2026-05-26T14:35:00");
    const props: ChartProvenanceCornerProps = {
      kind: "oracle",
      lastUpdateAt: fixedDate,
    };
    const element = ChartProvenanceCorner(props);
    const titleAttr = (element as { props: { title?: string } }).props.title;

    expect(titleAttr).toContain("Last update");
    // The time portion must include digits (HH:MM pattern).
    expect(titleAttr).toMatch(/\d{1,2}:\d{2}/);
    // Source label for oracle
    expect(titleAttr).toContain("on-chain oracle");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. ChartProvenanceCorner — position="bottom-right" class applied
  // ─────────────────────────────────────────────────────────────────────────
  it('applies bottom-right position classes when position="bottom-right"', () => {
    const props: ChartProvenanceCornerProps = {
      kind: "estimated",
      position: "bottom-right",
    };
    const element = ChartProvenanceCorner(props);
    const className = (element as { props: { className?: string } }).props
      .className as string;

    expect(className).toContain("bottom-2");
    expect(className).toContain("right-2");
    expect(className).not.toContain("top-2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. ChartTimeSelector — value="30D" → "30D" segment is marked active
// ─────────────────────────────────────────────────────────────────────────────
describe("ChartTimeSelector", () => {
  it('value="30D" sets aria-checked on the 30D option', () => {
    const onChange = vi.fn();
    const props: ChartTimeSelectorProps = {
      value: "30D",
      onChange,
    };
    const element = ChartTimeSelector(props);

    // The component returns a <div> whose children are button elements.
    // We verify the structure via the JSX tree.
    const children = (
      element as { props: { children: React.ReactElement[] } }
    ).props.children as React.ReactElement[];

    const activeBtn = children.find(
      (child) => (child.props as { children: string }).children === "30D",
    );
    expect(activeBtn).toBeDefined();
    expect((activeBtn!.props as { "aria-checked": boolean })["aria-checked"]).toBe(true);

    const inactiveBtn = children.find(
      (child) => (child.props as { children: string }).children === "7D",
    );
    expect(inactiveBtn).toBeDefined();
    expect(
      (inactiveBtn!.props as { "aria-checked": boolean })["aria-checked"],
    ).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 5. ChartTimeSelector — onChange is called with the clicked option
  // ─────────────────────────────────────────────────────────────────────────
  it("calls onChange with the correct value when a button is clicked", () => {
    const onChange = vi.fn();
    const props: ChartTimeSelectorProps = {
      value: "1D",
      onChange,
    };
    const element = ChartTimeSelector(props);
    const children = (
      element as { props: { children: React.ReactElement[] } }
    ).props.children as React.ReactElement[];

    const ytdBtn = children.find(
      (child) => (child.props as { children: string }).children === "YTD",
    );
    expect(ytdBtn).toBeDefined();

    // Simulate the click handler directly
    const onClick = (ytdBtn!.props as { onClick: () => void }).onClick;
    onClick();

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("YTD" as TimeRange);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. ChartDisclaimerUnderlay — default text rendered
// ─────────────────────────────────────────────────────────────────────────────
describe("ChartDisclaimerUnderlay", () => {
  it("renders default disclaimer text", () => {
    const props: ChartDisclaimerUnderlayProps = {};
    const element = ChartDisclaimerUnderlay(props);

    // Outer div is aria-hidden
    const ariaHidden = (element as { props: { "aria-hidden": string } }).props[
      "aria-hidden"
    ];
    expect(ariaHidden).toBe("true");

    // Inner span carries the text
    const innerSpan = (
      element as { props: { children: React.ReactElement } }
    ).props.children;
    const text = (innerSpan.props as { children: string }).children;
    expect(text).toContain("projections");
    expect(text).toContain("methodology v1.0");
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 7. ChartDisclaimerUnderlay — custom text rendered
  // ─────────────────────────────────────────────────────────────────────────
  it("renders custom disclaimer text when provided", () => {
    const customText = "simulated · indicative only · v2.0";
    const props: ChartDisclaimerUnderlayProps = { text: customText };
    const element = ChartDisclaimerUnderlay(props);

    const innerSpan = (
      element as { props: { children: React.ReactElement } }
    ).props.children;
    const text = (innerSpan.props as { children: string }).children;
    expect(text).toBe(customText);
  });
});
