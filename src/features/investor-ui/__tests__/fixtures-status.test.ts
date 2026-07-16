// src/features/investor-ui/__tests__/fixtures-status.test.ts
//
// Anti-drift guard: every fixture's top-level resolved blocks must carry
// `provenance: "fixture"` (never silently drift toward looking like a real
// "LIVE" DTO) and must never claim `status: "LIVE"`. Some fixtures
// deliberately model a non-happy-path business status (NOT_CONFIGURED,
// UNAVAILABLE, STALE, PARTIAL) to exercise those states — that is allowed and
// expected; a bare "LIVE" is not, because a fixture is never live data.

import { describe, expect, it } from "vitest";

import type { ResolvedViewModel } from "../types/common";

import { dashboardCompleteFixture } from "../fixtures/dashboard-complete";
import { dashboardPartialFixture } from "../fixtures/dashboard-partial";
import { dashboardUnavailableFixture } from "../fixtures/dashboard-unavailable";
import { dashboardNotConfiguredFixture } from "../fixtures/dashboard-not-configured";
import { dashboardNoPositionFixture } from "../fixtures/dashboard-no-position";
import { dashboardCapFullFixture } from "../fixtures/dashboard-cap-full";
import { dashboardNotEligibleFixture } from "../fixtures/dashboard-not-eligible";
import { btcCompleteFixture } from "../fixtures/btc-complete";
import { btcNotConfiguredFixture } from "../fixtures/btc-not-configured";
import { miningCompleteFixture } from "../fixtures/mining-complete";
import { miningStaleFixture } from "../fixtures/mining-stale";
import { miningUnavailableFixture } from "../fixtures/mining-unavailable";
import { profileCompleteFixture } from "../fixtures/profile-complete";
import { profileIncompleteFixture } from "../fixtures/profile-incomplete";

/** Extract every `ResolvedViewModel`-shaped block from a fixture object (one
 *  level deep — every fixture here is a flat record of blocks, some nested
 *  under `runtime`/`generatedAt` which are NOT ResolvedViewModel and are
 *  skipped because they don't have a `status` field of the expected type). */
function collectBlocks(fixture: object): ResolvedViewModel<unknown>[] {
  const blocks: ResolvedViewModel<unknown>[] = [];
  for (const [key, val] of Object.entries(fixture)) {
    if (key === "runtime" || key === "generatedAt") continue;
    if (
      val !== null &&
      typeof val === "object" &&
      "status" in val &&
      "value" in val
    ) {
      blocks.push(val as ResolvedViewModel<unknown>);
    }
  }
  return blocks;
}

const FIXTURES: Record<string, object> = {
  dashboardCompleteFixture,
  dashboardPartialFixture,
  dashboardUnavailableFixture,
  dashboardNotConfiguredFixture,
  dashboardNoPositionFixture,
  dashboardCapFullFixture,
  dashboardNotEligibleFixture,
  btcCompleteFixture,
  btcNotConfiguredFixture,
  miningCompleteFixture,
  miningStaleFixture,
  miningUnavailableFixture,
  profileCompleteFixture,
  profileIncompleteFixture,
};

describe("every fixture's blocks are honestly fixture-tagged", () => {
  for (const [name, fixture] of Object.entries(FIXTURES)) {
    const blocks = collectBlocks(fixture);

    it(`${name} has at least one resolved block (sanity check)`, () => {
      expect(blocks.length).toBeGreaterThan(0);
    });

    it(`${name}: no block claims status "LIVE"`, () => {
      for (const block of blocks) {
        expect(block.status, `a block in ${name} claims LIVE`).not.toBe("LIVE");
      }
    });

    it(`${name}: every block is tagged provenance "fixture"`, () => {
      for (const block of blocks) {
        expect(block.provenance, `a block in ${name} is missing provenance:"fixture"`).toBe(
          "fixture",
        );
      }
    });
  }
});
