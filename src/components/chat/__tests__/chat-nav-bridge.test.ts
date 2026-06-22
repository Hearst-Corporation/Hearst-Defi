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
import { nextPollDelay } from "../chat-nav-bridge";

const BASE = 900;
const MAX = 7_200;

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
