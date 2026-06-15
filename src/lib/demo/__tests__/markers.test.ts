import { describe, expect, it } from "vitest";

import {
  DEMO_CONFIRMED_DESCRIPTION,
  DEMO_CONFIRMED_TITLE,
  demoProvenance,
  proofProvenance,
} from "../markers";

describe("demo confirmed copy markers", () => {
  it("DEMO_CONFIRMED_TITLE is the expected string", () => {
    expect(DEMO_CONFIRMED_TITLE).toBe("Demo deposit simulated");
  });

  it("DEMO_CONFIRMED_DESCRIPTION is the expected string", () => {
    expect(DEMO_CONFIRMED_DESCRIPTION).toBe(
      "No real subscription was created. This sandbox flow is for visual QA only.",
    );
  });
});

describe("demoProvenance — every demo value is 'simulated', live flow untouched", () => {
  it("forces 'simulated' in demo mode regardless of the live kind", () => {
    expect(demoProvenance(true, "live")).toBe("simulated");
    expect(demoProvenance(true, "attested")).toBe("simulated");
    expect(demoProvenance(true, "estimated")).toBe("simulated");
    expect(demoProvenance(true, "stale")).toBe("simulated");
  });

  it("returns the live kind unchanged outside demo mode (byte-identical live flow)", () => {
    expect(demoProvenance(false, "live")).toBe("live");
    expect(demoProvenance(false, "attested")).toBe("attested");
    expect(demoProvenance(false, "manual")).toBe("manual");
  });
});

describe("proofProvenance — demo proofs are 'simulated', real proofs unchanged", () => {
  it("returns 'simulated' for any proof source in demo mode", () => {
    expect(proofProvenance(true, "paper", "attested")).toBe("simulated");
    expect(proofProvenance(true, "on_chain", "attested")).toBe("simulated");
  });

  it("returns the resolved live provenance outside demo mode", () => {
    expect(proofProvenance(false, "paper", "attested")).toBe("attested");
    expect(proofProvenance(false, "paper", "stale")).toBe("stale");
    expect(proofProvenance(false, "on_chain", "manual")).toBe("manual");
  });
});
