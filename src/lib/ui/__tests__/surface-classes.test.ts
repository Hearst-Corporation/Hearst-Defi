import { describe, expect, it } from "vitest";

import {
  surfaceClassName,
  surfaceHeroAccentLine,
  surfaceNoticeWell,
} from "../surface-classes";

describe("surfaceClassName", () => {
  it("maps every variant to token-only depth classes", () => {
    const variants = [
      "canvas",
      "hero",
      "primary",
      "secondary",
      "quiet",
      "inset",
    ] as const;

    for (const variant of variants) {
      const cls = surfaceClassName(variant);
      expect(cls).toMatch(/min-w-0/);
      expect(cls).not.toMatch(/bg-black|emerald-|green-|bordeaux|#[0-9a-f]{3,8}/i);
    }
  });

  it("elevates hero and primary, softens secondary, calms quiet", () => {
    expect(surfaceClassName("hero")).toContain("shadow-(--ct-shadow-elevated)");
    expect(surfaceClassName("primary")).toContain("shadow-(--ct-shadow-elevated)");
    expect(surfaceClassName("secondary")).toContain("shadow-(--ct-shadow-soft)");
    expect(surfaceClassName("quiet")).not.toContain("shadow-");
    expect(surfaceClassName("inset")).toContain("shadow-(--ct-shadow-inset)");
  });

  it("merges optional className", () => {
    expect(surfaceClassName("canvas", "gap-4")).toContain("gap-4");
  });

  it("exports hero accent and notice wells from tokens", () => {
    expect(surfaceHeroAccentLine).toContain("--ct-border-accent");
    expect(surfaceNoticeWell).toContain("--ct-border-soft");
    expect(surfaceNoticeWell).toContain("--ct-bg-deep");
  });
});
