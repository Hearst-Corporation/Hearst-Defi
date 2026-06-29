import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AgentBriefLive } from "../agent-brief-live";

/**
 * SSR snapshots of the initial render. The component is a client component, but
 * its INITIAL (pre-effect) branch renders synchronously — which is exactly the
 * state the user sees first, and where the too-vague / no-objective / persisted
 * states are decided. The watchdog + streaming live in effects (not exercised by
 * SSR), so these assertions prove the no-spinner contract: a vague objective
 * renders the structured fallback, never the streaming spinner.
 */
function render(props: {
  objective: string | null;
  autostart: boolean;
  initialBrief: string | null;
}) {
  return renderToStaticMarkup(<AgentBriefLive {...props} />);
}

describe("AgentBriefLive — no infinite spinner", () => {
  it("a vague objective renders the structured too-vague fallback, not the spinner", () => {
    const html = render({
      objective: "Je veux créer un produit.",
      autostart: true,
      initialBrief: null,
    });
    expect(html).toContain("too broad to generate a complete product brief");
    // The 5 framing inputs are listed.
    expect(html).toContain("Asset or strategy");
    expect(html).toContain("Target investor");
    expect(html).toContain("Yield source");
    expect(html).toContain("Risk profile");
    expect(html).toContain("Time horizon");
    // It is NOT in the streaming spinner state.
    expect(html).not.toContain("The agent is writing the brief");
  });

  it("the too-vague fallback offers a 'Write a brief anyway' escape hatch", () => {
    const html = render({
      objective: "Crée un draft de vault.",
      autostart: true,
      initialBrief: null,
    });
    expect(html).toContain("Write a brief anyway");
  });

  it("no objective renders an honest empty state, never a spinner", () => {
    const html = render({
      objective: null,
      autostart: true,
      initialBrief: null,
    });
    expect(html).toContain("No objective provided");
    expect(html).toContain("Start from chat or enter an objective manually");
    expect(html).not.toContain("The agent is writing the brief");
  });

  it("a persisted brief renders directly (done state), no spinner", () => {
    const html = render({
      objective: "BTC yield vault, 60-day lock-up, downside protection",
      autostart: false,
      initialBrief: "Cadrage déjà rédigé.",
    });
    expect(html).toContain("Cadrage déjà rédigé.");
    expect(html).not.toContain("The agent is writing the brief");
  });

  it("a specific objective with manual (no autostart) shows the idle trigger, not the spinner", () => {
    const html = render({
      objective: "BTC yield vault for institutions, 60-day lock-up, downside",
      autostart: false,
      initialBrief: null,
    });
    expect(html).toContain("Write the brief");
    expect(html).not.toContain("The agent is writing the brief");
  });
});
