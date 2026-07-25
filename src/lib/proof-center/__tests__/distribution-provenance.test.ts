import { describe, expect, it } from "vitest";

import { distributionProvenance } from "@/lib/proof-center/distribution-provenance";

describe("distributionProvenance", () => {
  it("returns manual when tx hash is absent", () => {
    expect(distributionProvenance(null)).toBe("manual");
  });

  it("returns simulated for placeholder fixture hashes (0xFEED)", () => {
    // E5: a sandbox fixture IS sandbox data, not an estimate — the old
    // "estimated" verdict overclaimed a projection that never happened.
    expect(distributionProvenance("0xfeed000000000000000000000000000000000000000000000000000000000000")).toBe(
      "simulated",
    );
  });

  it("returns simulated for 0xMOCK fixtures (canonical txProvenance rule)", () => {
    expect(distributionProvenance("0xMOCK00000000000000000000000000000000000000000000000000000000000")).toBe(
      "simulated",
    );
  });

  it("returns simulated for 0x5EED seed fixtures", () => {
    expect(distributionProvenance("0x5eed000000000000000000000000000000000000000000000000000000000000")).toBe(
      "simulated",
    );
  });

  it("returns attested for a real-looking tx hash", () => {
    expect(
      distributionProvenance(
        "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd",
      ),
    ).toBe("attested");
  });

  it("never returns estimated — fixtures are simulated, not projections", () => {
    for (const hash of [
      null,
      "0xfeed0000000000000000000000000000000000000000000000000000000000",
      "0xmock0000000000000000000000000000000000000000000000000000000000",
      "0xreal1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    ]) {
      expect(distributionProvenance(hash)).not.toBe("estimated");
    }
  });
});
