// src/features/investor-ui/__tests__/no-default-fixture.test.ts
//
// GATE 3 (mission HC-BTC-023): the default data source factory must never
// silently return a fixture. FixtureInvestorUiDataSource is legitimate ONLY
// behind an explicit `?state=` preview request (see get-btc-page-data.ts,
// dashboard/mining page loaders) — the runtime default MUST be
// BackendInvestorUiDataSource (hearst-connect-backend over HTTP), so a
// backend outage surfaces as an honest error, never a silent fixture.

import { describe, expect, it } from "vitest";

import { getInvestorUiDataSource, BackendInvestorUiDataSource, FixtureInvestorUiDataSource } from "../data-source";

describe("getInvestorUiDataSource() default factory", () => {
  it("returns BackendInvestorUiDataSource by default (not a fixture)", () => {
    const source = getInvestorUiDataSource();
    expect(source).toBeInstanceOf(BackendInvestorUiDataSource);
    expect(source).not.toBeInstanceOf(FixtureInvestorUiDataSource);
  });
});
