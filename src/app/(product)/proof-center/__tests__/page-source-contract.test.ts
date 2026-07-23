import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const PAGE_PATH = fileURLToPath(new URL("../page.tsx", import.meta.url));

describe("/proof-center product page — source contract", () => {
  const source = readFileSync(PAGE_PATH, "utf8");

  it("no longer renders the static PROOF_EVENTS catalogue as a completed-proof grid", () => {
    expect(source).not.toContain("PROOF_EVENTS");
  });

  it("renders the real indexed-events stepper instead", () => {
    expect(source).toContain("Series1ProofEventStepper");
    expect(source).toContain("toSeries1ProofStepperState");
  });

  it("carries no business Date.now()/new Date() — the stepper's timestamps come from the backend read", () => {
    expect(source).not.toContain("Date.now()");
    expect(source).not.toMatch(/new Date\(/);
  });
});
