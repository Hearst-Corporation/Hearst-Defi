/**
 * Agentic Console (simplified) — render contract (SSR).
 *
 * Asserts the three-section information architecture (Agents / Tool boundary /
 * Observability aria-labels), that the 8 base-agent labels render, and the
 * read-only invariant: NO <button>/<form>/<input>, no actionable (run/execute/
 * launch/send/deploy/source/mark live) controls. Mirrors the
 * agentic-control-tower.test.tsx pattern (renderToStaticMarkup — vitest env
 * node, no @testing-library).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AgenticConsoleSimple } from "@/components/admin/agentic/agentic-console-simple";
import { getAgenticControlCenterData } from "@/lib/agentic/control-center";
import { BASE_AGENT_LABELS, BASE_AGENTS } from "@/lib/agents/agent-template-constants";

const CC = getAgenticControlCenterData();

const html = renderToStaticMarkup(
  <AgenticConsoleSimple
    controlCenter={CC}
    observability={null}
    observabilityWindow="24h"
  />,
);

const NO_WRITE_CONTROLS = (markup: string) => {
  expect(markup).not.toContain("<button");
  expect(markup).not.toContain("<form");
  expect(markup).not.toContain("<input");
};
const NO_RUN_CONTROLS = (markup: string) => {
  NO_WRITE_CONTROLS(markup);
  const actionable = /<(button|a)[^>]*>\s*(run|execute|launch|send|deploy|source|mark live)\b/i;
  expect(actionable.test(markup)).toBe(false);
};

describe("AgenticConsoleSimple", () => {
  it("mounts exactly the three canon sections (Agents / Tool boundary / Observability)", () => {
    expect(html).toContain('aria-label="Agents"');
    expect(html).toContain('aria-label="Tool boundary"');
    expect(html).toContain('aria-label="Observability"');
  });

  it("renders all 8 base-agent labels", () => {
    expect(BASE_AGENTS).toHaveLength(8);
    for (const agent of BASE_AGENTS) {
      const label = BASE_AGENT_LABELS[agent].replace(/&/g, "&amp;");
      expect(html).toContain(label);
    }
  });

  it("has no write or run controls (read-only invariant)", () => {
    NO_RUN_CONTROLS(html);
  });
});
