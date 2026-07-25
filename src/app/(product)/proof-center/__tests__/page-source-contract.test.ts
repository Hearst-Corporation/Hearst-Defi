import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const PAGE_PATH = fileURLToPath(new URL("../page.tsx", import.meta.url));
// Depuis l'overhaul 2026-07-25 la page est un wrapper : le rendu vit dans la
// vue. Le contrat s'applique à la source EFFECTIVE (page + vue), même
// mécanisme substring que les autres gardiens.
const VIEW_PATH = fileURLToPath(
  new URL("../../../../views/investor/proof-center-view.tsx", import.meta.url),
);

describe("/proof-center product page — source contract", () => {
  const source = readFileSync(PAGE_PATH, "utf8");
  const effective = source + "\n" + readFileSync(VIEW_PATH, "utf8");

  it("no longer renders the static PROOF_EVENTS catalogue as a completed-proof grid", () => {
    expect(source).not.toContain("PROOF_EVENTS");
  });

  it("renders the real indexed-events stepper instead", () => {
    expect(effective).toContain("Series1ProofEventStepper");
    expect(source).toContain("toSeries1ProofStepperState");
  });

  it("carries no business Date.now()/new Date() — the stepper's timestamps come from the backend read", () => {
    expect(source).not.toContain("Date.now()");
    expect(source).not.toMatch(/new Date\(/);
  });
});
