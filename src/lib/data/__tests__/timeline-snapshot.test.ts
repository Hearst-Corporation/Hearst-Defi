import { describe, it, expect } from "vitest";

// `isLiveTimelineSource` is the exact guard T-15 was missing from the memo
// loader (`src/lib/agents/loaders/vault.ts`) — it already gates the admin
// dashboard's Live/Attested badges. No dedicated unit test existed for the
// function itself; this pins its contract directly so a future edit to the
// `LIVE_TIMELINE_SOURCES` set is a deliberate, visible change.

import {
  isLiveTimelineSource,
  timelineSnapshotWhere,
  TIMELINE_SNAPSHOT_SOURCES,
} from "@/lib/data/timeline-snapshot";

describe("isLiveTimelineSource", () => {
  it.each(["live", "oracle", "attested"] as const)(
    "treats %s as a live production source",
    (source) => {
      expect(isLiveTimelineSource(source)).toBe(true);
    },
  );

  it("treats daily-seed as NOT a live source (synthetic seeded timeline)", () => {
    expect(isLiveTimelineSource("daily-seed")).toBe(false);
  });

  it("treats computed as NOT a live source (engine preset run)", () => {
    expect(isLiveTimelineSource("computed")).toBe(false);
  });

  it("is conservative (false) for null/undefined/unknown sources", () => {
    expect(isLiveTimelineSource(null)).toBe(false);
    expect(isLiveTimelineSource(undefined)).toBe(false);
    expect(isLiveTimelineSource("something-unexpected")).toBe(false);
  });
});

describe("timelineSnapshotWhere", () => {
  it("scopes to exactly the declared timeline sources", () => {
    expect(timelineSnapshotWhere()).toEqual({
      source: { in: [...TIMELINE_SNAPSHOT_SOURCES] },
    });
  });

  it("includes daily-seed for chart/history queries even though it is not a live badge source", () => {
    // daily-seed is valid timeline data for charts/history (per module docs)
    // — it must stay in the query scope even though isLiveTimelineSource()
    // excludes it from Live/Attested badges.
    expect(TIMELINE_SNAPSHOT_SOURCES).toContain("daily-seed");
    expect(isLiveTimelineSource("daily-seed")).toBe(false);
  });
});
