import { describe, expect, it } from "vitest";

import { distributionProvenance } from "@/lib/proof-center/distribution-provenance";

describe("distributionProvenance", () => {
  it("returns manual when tx hash is absent", () => {
    expect(distributionProvenance(null)).toBe("manual");
  });

  it("returns estimated for placeholder fixture hashes", () => {
    expect(distributionProvenance("0xfeed000000000000000000000000000000000000000000000000000000000000")).toBe(
      "estimated",
    );
  });

  it("returns attested for a real-looking tx hash", () => {
    expect(
      distributionProvenance(
        "0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd",
      ),
    ).toBe("attested");
  });
});
