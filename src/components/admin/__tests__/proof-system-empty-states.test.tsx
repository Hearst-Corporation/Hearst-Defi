/**
 * Proof & System admin pages — empty-state structural contract (DS §9).
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MonitoringBoard } from "@/components/admin/monitoring/monitoring-board";
import { ProofList } from "@/components/admin/proof-list";

describe("Proof & System empty states", () => {
  it("ProofList: widget empty without card shell", () => {
    const html = renderToStaticMarkup(<ProofList items={[]} />);
    expect(html).toContain("ct-empty-surface--widget");
  });

  it("MonitoringBoard: widget empty only when no runs", () => {
    const html = renderToStaticMarkup(
      <MonitoringBoard
        stats={{
          totalRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          totalCostUsd: 0,
          avgLatencyMs: 0,
          runsByAgent: [],
          recentRuns: [],
        }}
      />,
    );
    expect(html).toContain("ct-empty-surface--widget");
    expect(html).not.toContain("Runs by Agent");
  });
});
