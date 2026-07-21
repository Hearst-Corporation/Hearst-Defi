import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function readSource(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Phase A provenance boundaries", () => {
  it("uses backend BTC production on the live dashboard path", () => {
    const source = readSource("src/app/(product)/dashboard/page.tsx");

    expect(source).toContain("getBtcPageData(null)");
    expect(source).toContain("productionBlock: btc.extra.production");
    expect(source).toContain(
      "source={dataStatusToSource(productionBlock.status)}",
    );
  });

  it("uses backend mining data for the live Bitcoin ledger", () => {
    const source = readSource("src/app/(product)/btc/ledger/page.tsx");

    expect(source).toContain(": getInvestorUiDataSource()");
    expect(source).toContain("miningSource.getMining()");
    expect(source).not.toContain(
      "const previewSource = getFixtureInvestorUiDataSource",
    );
  });

  it("limits the simulated mining badge to explicit QA previews", () => {
    const source = readSource("src/app/(product)/mining/page.tsx");

    expect(source).toContain(
      "const headerProvenance = miningHeaderProvenance(viewModel.mining.status)",
    );
    expect(source).toContain(
      "Backend mining source unavailable — no fixture substituted.",
    );
    expect(source.match(/kind="simulated"/g)).toHaveLength(1);
  });
});
