/**
 * Unit tests for the nextPollDelay pure helper exported from chat-nav-bridge.
 *
 * The full polling/timer logic lives in a React effect (not directly testable
 * in Vitest without a DOM + React harness), but nextPollDelay encodes the
 * entire backoff contract and is pure, so we test it here.
 *
 * Contract:
 *  - gotDirective=true  → always reset to base, regardless of current delay.
 *  - gotDirective=false → double current delay, clamped to max.
 *  - Doubling from max stays at max (idempotent ceiling).
 */

import { describe, expect, it } from "vitest";
import {
  isSameDestination,
  nextPollDelay,
  nextPollSchedule,
  shouldScheduleNextPoll,
} from "../chat-nav-bridge";

const BASE = 900;
const MAX = 7_200;

describe("isSameDestination (anti-loop contract)", () => {
  const WS = "/admin/vaults/new";

  it("treats an identical route+query as same (true no-op)", () => {
    expect(isSameDestination(WS, WS)).toBe(true);
    expect(
      isSameDestination(`${WS}?objective=foo`, `${WS}?objective=foo`),
    ).toBe(true);
  });

  it("is order-insensitive on query params", () => {
    expect(
      isSameDestination(
        `${WS}?objective=foo&autostart=1`,
        `${WS}?autostart=1&objective=foo`,
      ),
    ).toBe(true);
  });

  it("THE BUG FIX: same page, DIFFERENT objective is NOT a no-op", () => {
    // User is inside the product workspace on objective "foo" and asks to create
    // a product "bar". The directive lands on the same path with a new objective
    // → must re-navigate, so this is NOT the same destination.
    expect(
      isSameDestination(`${WS}?objective=bar`, `${WS}?objective=foo`),
    ).toBe(false);
    // Arriving with an objective while currently on the bare page also fires.
    expect(isSameDestination(`${WS}?objective=bar`, WS)).toBe(false);
  });

  it("different pathnames are never the same destination", () => {
    expect(isSameDestination("/admin/vaults", WS)).toBe(false);
    expect(
      isSameDestination(`/admin/vaults?objective=foo`, `${WS}?objective=foo`),
    ).toBe(false);
  });

  it("ignores a hash fragment when comparing", () => {
    expect(isSameDestination(`${WS}#section`, WS)).toBe(true);
  });
});

describe("nextPollDelay", () => {
  it("resets to base when a directive landed", () => {
    expect(nextPollDelay(true, MAX, BASE, MAX)).toBe(BASE);
    expect(nextPollDelay(true, 3_600, BASE, MAX)).toBe(BASE);
    expect(nextPollDelay(true, BASE, BASE, MAX)).toBe(BASE);
  });

  it("doubles the delay on empty/failed poll", () => {
    expect(nextPollDelay(false, BASE, BASE, MAX)).toBe(1_800);
    expect(nextPollDelay(false, 1_800, BASE, MAX)).toBe(3_600);
    expect(nextPollDelay(false, 3_600, BASE, MAX)).toBe(MAX);
  });

  it("clamps at max and stays there", () => {
    expect(nextPollDelay(false, MAX, BASE, MAX)).toBe(MAX);
    // Even if current somehow exceeds max, clamp holds.
    expect(nextPollDelay(false, 20_000, BASE, MAX)).toBe(MAX);
  });

  it("full sequence from base to max then reset", () => {
    let delay = BASE;
    // Step through idle backoff until we reach MAX.
    delay = nextPollDelay(false, delay, BASE, MAX); // 1800
    delay = nextPollDelay(false, delay, BASE, MAX); // 3600
    delay = nextPollDelay(false, delay, BASE, MAX); // 7200
    expect(delay).toBe(MAX);

    // A directive lands → immediately back to base.
    delay = nextPollDelay(true, delay, BASE, MAX);
    expect(delay).toBe(BASE);
  });

  it("works with arbitrary base and max values", () => {
    expect(nextPollDelay(false, 100, 100, 800)).toBe(200);
    expect(nextPollDelay(false, 400, 100, 800)).toBe(800);
    expect(nextPollDelay(false, 800, 100, 800)).toBe(800);
    expect(nextPollDelay(true, 800, 100, 800)).toBe(100);
  });
});

describe("nextPollSchedule (dedup / coalescing contract)", () => {
  const BASE = 900;
  const MAX = 7_200;

  it("coalesces a mid-flight re-arm into an immediate base re-poll (no duplicate)", () => {
    // A re-arm requested while the single poll was in flight → poll now at base,
    // instead of having opened a second concurrent /api/chat-nav request.
    expect(
      nextPollSchedule(
        { reArmRequested: true, gotDirective: false, currentDelay: MAX },
        BASE,
        MAX,
      ),
    ).toEqual({ kind: "immediate", delay: BASE });
    // re-arm wins even when a directive also landed.
    expect(
      nextPollSchedule(
        { reArmRequested: true, gotDirective: true, currentDelay: 3_600 },
        BASE,
        MAX,
      ),
    ).toEqual({ kind: "immediate", delay: BASE });
  });

  it("backs off when no re-arm was requested (doubling toward max)", () => {
    expect(
      nextPollSchedule(
        { reArmRequested: false, gotDirective: false, currentDelay: BASE },
        BASE,
        MAX,
      ),
    ).toEqual({ kind: "backoff", delay: 1_800 });
    expect(
      nextPollSchedule(
        { reArmRequested: false, gotDirective: false, currentDelay: 3_600 },
        BASE,
        MAX,
      ),
    ).toEqual({ kind: "backoff", delay: MAX });
  });

  it("resets to base (still backoff) when a directive landed without a re-arm", () => {
    expect(
      nextPollSchedule(
        { reArmRequested: false, gotDirective: true, currentDelay: MAX },
        BASE,
        MAX,
      ),
    ).toEqual({ kind: "backoff", delay: BASE });
  });
});

describe("shouldScheduleNextPoll (idle-load gate)", () => {
  it("does NOT schedule a backoff follow-up before the loop is armed", () => {
    // The decisive case: fresh /portfolio load, no message sent → after the
    // single mount poll returns empty (backoff, not armed) we stop. ≤1 request.
    expect(shouldScheduleNextPoll("backoff", false)).toBe(false);
  });

  it("schedules the backoff chain once armed by a real signal", () => {
    expect(shouldScheduleNextPoll("backoff", true)).toBe(true);
  });

  it("always runs an immediate (coalesced) re-poll, armed or not", () => {
    expect(shouldScheduleNextPoll("immediate", false)).toBe(true);
    expect(shouldScheduleNextPoll("immediate", true)).toBe(true);
  });
});
