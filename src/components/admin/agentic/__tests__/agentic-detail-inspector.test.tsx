// Admin · Agentic Detail Inspector — SSR render contract.
//
// Tests the second-layer inspector component via renderToStaticMarkup.
// Pure data in, no network, no DB, no tool execution, no @testing-library/react.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, test, expect, beforeAll } from "vitest";
import { AgenticDetailInspector } from "../agentic-detail-inspector";
import { buildAgenticSystemMap } from "@/lib/agentic/system-map/build-system-map";
import { getAgenticControlCenterData } from "@/lib/agentic/control-center";
import type { AgenticSystemMap } from "@/lib/agentic/system-map/types";

let map: AgenticSystemMap;

beforeAll(() => {
  const controlCenter = getAgenticControlCenterData();
  map = buildAgenticSystemMap({
    controlCenter,
    observability: null,
    reporting: null,
  });
});

function render(m: AgenticSystemMap | null | undefined): string {
  return renderToStaticMarkup(<AgenticDetailInspector map={m} />);
}

describe("AgenticDetailInspector", () => {
  test("renders detail inspector section with id", () => {
    const html = render(map);
    expect(html).toContain('id="agentic-detail-inspector"');
  });

  test("has accessible aria-label", () => {
    const html = render(map);
    expect(html).toContain("Agentic detail inspector");
  });

  test("shows 'System Details' heading", () => {
    const html = render(map);
    expect(html).toContain("System Details");
  });

  test("shows total node count", () => {
    const html = render(map);
    expect(html).toContain(String(map.nodes.length));
  });

  test("shows total edge count", () => {
    const html = render(map);
    expect(html).toContain(String(map.edges.length));
  });

  test("shows group/layer count", () => {
    const html = render(map);
    expect(html).toContain(String(map.groups.length));
  });

  test("renders the layer rollup with each group", () => {
    const html = render(map);
    // renderToStaticMarkup HTML-escapes "&", so match on safe label substrings.
    expect(html).toContain("Control Layer");
    expect(html).toContain("Crews"); // "Crews & Agents" → "&" escaped
    expect(html).toContain("Observability Layer");
    expect(html).toContain("Tool Layer");
  });

  test("renders a health/status badge (healthy/watch/alert)", () => {
    const html = render(map);
    expect(html).toMatch(/all healthy|alert|watch/i);
  });

  test("has in-page jump-link anchors (href starting with #)", () => {
    const html = render(map);
    expect(html).toContain('href="#');
  });

  test("jump-links do not contain http(s) URLs", () => {
    const anchors = (html: string) =>
      [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1] ?? "");
    const hrefs = anchors(render(map));
    hrefs.forEach((href) => {
      expect(href).not.toMatch(/^https?:\/\//);
    });
  });

  test("no <form> elements present", () => {
    const html = render(map);
    expect(html).not.toContain("<form");
  });

  test("no <input> elements present", () => {
    const html = render(map);
    expect(html).not.toContain("<input");
  });

  test("no <textarea> elements present", () => {
    const html = render(map);
    expect(html).not.toContain("<textarea");
  });

  test("no dangerous write action buttons", () => {
    const html = render(map);
    const buttonContent = (html.match(/<button[^>]*>[\s\S]*?<\/button>/gi) ?? []).join("");
    expect(buttonContent).not.toMatch(/send|execute|write|deploy|delete|confirm|approve/i);
  });

  test("shows the second-layer description text", () => {
    const html = render(map);
    expect(html).toContain("Second layer");
  });

  test("shows 'Open a detail panel' jump-links card", () => {
    const html = render(map);
    expect(html).toContain("Open a detail panel");
  });

  test("renders null map as empty string (no crash)", () => {
    expect(render(null)).toBe("");
  });

  test("renders undefined map as empty string (no crash)", () => {
    expect(render(undefined)).toBe("");
  });

  test("shows at least one known jump-link target", () => {
    const html = render(map);
    // The jump-links include #reporting-crew, #router-observability, etc.
    const knownTargets = [
      "#reporting-crew",
      "#router-observability",
      "#tool-boundary-v1",
      "#human-gates",
    ];
    const hasAtLeastOne = knownTargets.some((target) => html.includes(target));
    expect(hasAtLeastOne).toBe(true);
  });
});
