/**
 * CanvasActionButton — the only network-touching canvas component. Node env,
 * renderToStaticMarkup (repo convention). The interactive two-step token flow is
 * enforced server-side (executeAdminWriteTool + consumeWriteConfirmation, tested
 * there); here we pin the UI safety properties:
 *   1. With the kill-switch off (disabled), the CTA renders DISABLED — a write
 *      cannot even be proposed.
 *   2. The PTAI summary + the "will not do" honesty list are always rendered.
 *   3. The proposal carries no token in the rendered surface.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CanvasActionButton } from "@/components/admin/agent-canvas/canvas-action-button";
import type { PendingActionProposal } from "@/lib/canvas/contract";

const PROPOSAL: PendingActionProposal = {
  proposalId: "create-vault-draft",
  toolId: "create_vault_draft",
  input: { ticker: "HYV2", name: "Test Vault" },
  label: "Create vault draft (DRAFT only)",
  riskLevel: "high",
  summary: {
    projection: "A new vault is recorded as a draft.",
    trigger: "You confirm after review.",
    action: "Persist a draft vault.",
    impact: "Enters the review pipeline; not live.",
  },
  willNotDo: ["Does NOT mark the vault live.", "No financial action."],
};

describe("CanvasActionButton", () => {
  it("renders the CTA disabled when the kill-switch is off (disabled=true)", () => {
    const html = renderToStaticMarkup(
      <CanvasActionButton canvasId="create-vault" proposal={PROPOSAL} disabled />,
    );
    expect(html).toContain("disabled");
    expect(html).toContain("Create vault draft");
  });

  it("renders the PTAI summary and the will-not-do honesty list", () => {
    const html = renderToStaticMarkup(
      <CanvasActionButton canvasId="create-vault" proposal={PROPOSAL} />,
    );
    expect(html).toContain("Projection");
    expect(html).toContain("Trigger");
    expect(html).toContain("Action");
    expect(html).toContain("Impact");
    expect(html).toContain("Does NOT mark the vault live.");
  });

  it("never renders a confirmation token in the initial surface", () => {
    const html = renderToStaticMarkup(
      <CanvasActionButton canvasId="create-vault" proposal={PROPOSAL} />,
    );
    // A proposal is inert; no token/uuid is present before the propose round-trip.
    expect(html.toLowerCase()).not.toContain("confirmedtoken");
    expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
  });
});
