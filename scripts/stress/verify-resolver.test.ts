import { describe, it, expect } from "vitest";
import {
  resolveLpNavDestinationKey,
  resolveAdminNavFallbackKey,
} from "@/lib/llm/nav-fallback-intent";

describe("nav gating adversarial verify", () => {
  it("LP proof-center hijacked by benign Q&A", () => {
    expect(resolveLpNavDestinationKey("peux-tu m'expliquer la preuve de réserve")).toBe("proof-center");
  });
  it("admin outreach hijacked by benign Q&A", () => {
    expect(resolveAdminNavFallbackKey("what is our outreach strategy")).toBe("admin-outreach");
  });
  it("admin scenario-lab hijacked by benign Q&A (scénario)", () => {
    expect(resolveAdminNavFallbackKey("explique-moi ce scénario de stress")).toBe("admin-scenario-lab");
  });
  it("admin scenario-lab hijacked by benign Q&A (monte carlo)", () => {
    expect(resolveAdminNavFallbackKey("what does the monte carlo simulation show")).toBe("admin-scenario-lab");
  });
  it("admin scenario-lab hijacked by benign Q&A (simulation FR)", () => {
    expect(resolveAdminNavFallbackKey("je ne comprends pas la simulation")).toBe("admin-scenario-lab");
  });
  it("CONTROL: derived term (distributions) is verb-gated → null on bare mention", () => {
    expect(resolveLpNavDestinationKey("je ne comprends pas mes distributions")).toBeNull();
  });
});
