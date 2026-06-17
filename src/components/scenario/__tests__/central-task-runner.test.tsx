import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CentralTaskRunner } from "@/components/scenario/central-task-runner";

describe("CentralTaskRunner", () => {
  it("renders English console copy when a run is active", () => {
    const html = renderToStaticMarkup(
      <CentralTaskRunner
        runId={1}
        objective="Stress BTC drawdown"
        pending={false}
        output={null}
      />,
    );

    expect(html).toContain("Booting central workspace");
    expect(html).toContain("Loading assumptions and risk bounds");
    expect(html).not.toMatch(/Initialisation|Préparation|Nouvelle tâche/i);
  });

  it("shows idle copy when no run is in progress", () => {
    const html = renderToStaticMarkup(
      <CentralTaskRunner runId={0} objective="" pending={false} output={null} />,
    );

    expect(html).toContain("No execution in progress.");
  });
});
