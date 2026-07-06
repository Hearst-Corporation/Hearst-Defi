/**
 * Agentic Agents cards — render contract (SSR).
 *
 * Asserts the 8 real base agents render, and that the DERIVED cron status
 * badges are correct for the scheduled batch agents (mining-health,
 * investor-memo, risk-explanation). renderToStaticMarkup (repo convention —
 * vitest env node, no @testing-library).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AgenticAgentsCards } from "@/components/admin/agentic/agentic-agents-cards";
import { BASE_AGENT_LABELS, BASE_AGENTS } from "@/lib/agents/agent-template-constants";

const html = renderToStaticMarkup(<AgenticAgentsCards />);

describe("AgenticAgentsCards", () => {
  it("renders all 8 base-agent labels", () => {
    expect(BASE_AGENTS).toHaveLength(8);
    for (const agent of BASE_AGENTS) {
      const label = BASE_AGENT_LABELS[agent].replace(/&/g, "&amp;");
      expect(html).toContain(label);
    }
  });

  it("labels the scheduled batch agents with their cron expressions", () => {
    expect(html).toContain("Batch · cron 0 8 * * *"); // mining-health
    expect(html).toContain("Batch · cron 0 9 1 * *"); // investor-memo
    expect(html).toContain("Batch · cron 30 9 * * *"); // risk-explanation
  });

  it("labels the chat and on-demand batch agents", () => {
    expect(html).toContain("Chat · live"); // cockpit-chat
    expect(html).toContain("Batch · on-demand"); // scenario-narrative
    expect(html).toContain("Platform"); // email-outreach / memory-distill / product-review
  });

  it("has no write or run controls (read-only invariant)", () => {
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<input");
  });
});
