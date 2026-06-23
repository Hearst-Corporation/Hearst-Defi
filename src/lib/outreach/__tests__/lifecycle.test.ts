/**
 * Tests for the pure prospect-lifecycle mapping. No DB, no IO — just the
 * status → stage label/kind/order resolution and terminal detection used by
 * the CRM prospect sheet.
 */
import { describe, it, expect } from "vitest";

import {
  lifecycleFor,
  isTerminalStatus,
  LIFECYCLE_STEPS,
} from "@/lib/outreach/lifecycle";

describe("lifecycleFor", () => {
  it("maps each known status to its stage", () => {
    expect(lifecycleFor("new").label).toBe("New");
    expect(lifecycleFor("new").kind).toBe("pending");
    expect(lifecycleFor("contacted").kind).toBe("active");
    expect(lifecycleFor("converted").kind).toBe("won");
    expect(lifecycleFor("opted_out").kind).toBe("lost");
    expect(lifecycleFor("bounced").kind).toBe("lost");
  });

  it("orders the happy path monotonically", () => {
    expect(lifecycleFor("new").order).toBeLessThan(lifecycleFor("contacted").order);
    expect(lifecycleFor("contacted").order).toBeLessThan(lifecycleFor("opened").order);
    expect(lifecycleFor("opened").order).toBeLessThan(lifecycleFor("replied").order);
    expect(lifecycleFor("replied").order).toBeLessThan(lifecycleFor("qualified").order);
    expect(lifecycleFor("qualified").order).toBeLessThan(lifecycleFor("converted").order);
  });

  it("never throws and never yields undefined on unknown/empty input", () => {
    const u = lifecycleFor("totally_made_up");
    expect(u.label).toBe("totally_made_up");
    expect(u.kind).toBe("pending");
    expect(lifecycleFor(null).label).toBe("Unknown");
    expect(lifecycleFor(undefined).label).toBe("Unknown");
  });
});

describe("isTerminalStatus", () => {
  it("is true only for lost outcomes", () => {
    expect(isTerminalStatus("opted_out")).toBe(true);
    expect(isTerminalStatus("bounced")).toBe(true);
    expect(isTerminalStatus("converted")).toBe(false); // won, not lost
    expect(isTerminalStatus("new")).toBe(false);
    expect(isTerminalStatus(null)).toBe(false);
  });
});

describe("LIFECYCLE_STEPS", () => {
  it("is the ordered happy path, terminal-lost excluded", () => {
    expect(LIFECYCLE_STEPS.map((s) => s.status)).toEqual([
      "new",
      "contacted",
      "opened",
      "replied",
      "qualified",
      "converted",
    ]);
    expect(LIFECYCLE_STEPS.some((s) => s.kind === "lost")).toBe(false);
  });
});
