/**
 * SimulationPanel unit tests.
 *
 * Uses react-dom/server renderToString (available in the Node vitest environment)
 * since no jsdom / happy-dom is installed in this project.
 *
 * Tests cover:
 *  1. All fields rendered on a happy-path result
 *  2. Loading state shows spinner text
 *  3. Error state shows message
 *  4. State diff color-coded (before = --ct-text-faint, after = --ct-accent)
 *  5. Reverts section present when reverts array is non-empty
 *  6. Events section rendered with correct event name
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { SimulationPanel } from "../simulation-panel";
import type { SimulationResult } from "@/lib/simulation/types";

// ── Fixtures ──────────────────────────────────────────────────────────────

const SUCCESS_RESULT: SimulationResult = {
  ok: true,
  gasUsedEstimate: 84_231,
  gasCostUsdEstimate: 3.4,
  stateDiff: [
    {
      contract: "0x1234567890abcdef1234567890abcdef12345678",
      slot: "0x" + "a".repeat(64),
      before: "0x" + "0".repeat(64),
      after: "0x" + "b".repeat(64),
    },
  ],
  balanceDelta: [],
  reverts: [],
  events: [
    {
      name: "GovernanceExecuted",
      args: {
        opId: "0x" + "0".repeat(64),
        target: "0x1234567890abcdef1234567890abcdef12345678",
        selector: "0xa9059cbb",
        by: "0x000000000000000000000000000000000000dead",
      },
    },
  ],
};

const REVERT_RESULT: SimulationResult = {
  ok: false,
  gasUsedEstimate: 84_231,
  gasCostUsdEstimate: 3.4,
  stateDiff: [],
  balanceDelta: [],
  reverts: [
    { reason: "GovernanceAction: execution reverted by stub", pc: 1337 },
  ],
  events: [],
};

// ── Helpers ────────────────────────────────────────────────────────────────

function render(element: React.ReactElement): string {
  return renderToString(element);
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("SimulationPanel — all fields on success result", () => {
  it("renders gas estimate", () => {
    const html = render(
      <SimulationPanel result={SUCCESS_RESULT} loading={false} />,
    );
    expect(html).toContain("84,231");
    // React renderToString inserts <!-- --> between JSX expressions;
    // test for the two parts independently
    expect(html).toContain("3.40");
    expect(html).toContain("($");
  });

  it("renders state diff section", () => {
    const html = render(
      <SimulationPanel result={SUCCESS_RESULT} loading={false} />,
    );
    expect(html).toContain("State diff");
    // contract address should appear
    expect(html).toContain("0x123456789");
  });

  it("renders balance delta section", () => {
    const html = render(
      <SimulationPanel result={SUCCESS_RESULT} loading={false} />,
    );
    expect(html).toContain("Balance delta");
    expect(html).toContain("No balance changes");
  });

  it("renders events section with GovernanceExecuted", () => {
    const html = render(
      <SimulationPanel result={SUCCESS_RESULT} loading={false} />,
    );
    expect(html).toContain("Events");
    expect(html).toContain("GovernanceExecuted");
  });

  it("renders View full trace link", () => {
    const html = render(
      <SimulationPanel result={SUCCESS_RESULT} loading={false} />,
    );
    expect(html).toContain("View full trace");
  });

  it("shows Success status badge when ok=true", () => {
    const html = render(
      <SimulationPanel result={SUCCESS_RESULT} loading={false} />,
    );
    expect(html).toContain("Success");
  });

  it("shows Reverts status badge when ok=false", () => {
    const html = render(
      <SimulationPanel result={REVERT_RESULT} loading={false} />,
    );
    expect(html).toContain("Reverts");
  });
});

describe("SimulationPanel — loading state", () => {
  it("shows spinner text when loading=true", () => {
    const html = render(<SimulationPanel result={null} loading={true} />);
    expect(html).toContain("Simulating on fork");
  });

  it("sets aria-busy=true when loading", () => {
    const html = render(<SimulationPanel result={null} loading={true} />);
    expect(html).toContain('aria-busy="true"');
  });

  it("does not render gas when loading", () => {
    const html = render(<SimulationPanel result={null} loading={true} />);
    expect(html).not.toContain("84,231");
  });
});

describe("SimulationPanel — error state", () => {
  it("shows error message", () => {
    const html = render(
      <SimulationPanel
        result={null}
        loading={false}
        error="Tenderly API unreachable"
      />,
    );
    expect(html).toContain("Tenderly API unreachable");
  });

  it("shows 'Simulation failed' heading on error", () => {
    const html = render(
      <SimulationPanel
        result={null}
        loading={false}
        error="Something went wrong"
      />,
    );
    expect(html).toContain("Simulation failed");
  });

  it("error container has role=alert", () => {
    const html = render(
      <SimulationPanel
        result={null}
        loading={false}
        error="Something went wrong"
      />,
    );
    expect(html).toContain('role="alert"');
  });
});

describe("SimulationPanel — state diff color coding", () => {
  it("applies --ct-text-faint to the before value", () => {
    const html = render(
      <SimulationPanel result={SUCCESS_RESULT} loading={false} />,
    );
    // The before span uses ct-text-faint
    expect(html).toContain("ct-text-faint");
  });

  it("applies --ct-accent to the after value", () => {
    const html = render(
      <SimulationPanel result={SUCCESS_RESULT} loading={false} />,
    );
    // The after span uses ct-text-accent
    expect(html).toContain("ct-text-accent");
  });
});

describe("SimulationPanel — reverts section", () => {
  it("renders reverts when reverts array is non-empty", () => {
    const html = render(
      <SimulationPanel result={REVERT_RESULT} loading={false} />,
    );
    expect(html).toContain("GovernanceAction: execution reverted by stub");
    // React renderToString inserts <!-- --> between JSX expressions ("PC: " + {pc})
    expect(html).toContain("PC:");
    expect(html).toContain("1337");
  });

  it("reverts section has role=alert", () => {
    const html = render(
      <SimulationPanel result={REVERT_RESULT} loading={false} />,
    );
    // The RevertsSection div has role="alert"
    expect(html).toContain('role="alert"');
  });

  it("does NOT render reverts section when reverts is empty", () => {
    const html = render(
      <SimulationPanel result={SUCCESS_RESULT} loading={false} />,
    );
    expect(html).not.toContain("Reverts (");
  });
});

describe("SimulationPanel — empty/null state", () => {
  it("renders empty state when result is null and not loading", () => {
    const html = render(<SimulationPanel result={null} loading={false} />);
    expect(html).toContain("No simulation run yet");
  });
});
