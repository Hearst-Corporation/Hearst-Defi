/**
 * Tool-result MESSAGING contract for the Master Agent.
 *
 * The Master may never auto-execute a write/send tool — but the message the
 * model receives when it tries must read as "expected mandate behaviour + here
 * is how to respond", not "BLOCKED / error". This pins the human-facing guidance
 * per action nature so the agent's reply stays fluid and accurate:
 *   - draft tools say nothing is sent
 *   - send run says it is governed (SUGGEST sends nothing, Tier A never auto-sent)
 *   - sourcing says no credit spent until confirmed
 * No LLM, no DB, no send.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/llm/tools/registry", () => ({
  getAllowedAdminReadTools: vi.fn(() => []),
  executeAdminReadTool: vi.fn(),
}));

import { writeToolGuidance } from "@/lib/llm/chat-agent";

describe("writeToolGuidance — per-action HITL phrasing", () => {
  it("draft tools state nothing is sent and stay in review", () => {
    for (const id of [
      "outreach_draft_email",
      "create_review_note_draft",
      "create_governance_proposal_draft",
    ]) {
      const g = writeToolGuidance(id);
      expect(g).toMatch(/draft/i);
      expect(g).toMatch(/nothing is sent|not.*sent|stays in review|review/i);
      expect(g).toMatch(/confirm/i);
      // never tells the model to claim it already happened
      expect(g).toMatch(/do NOT claim/i);
    }
  });

  it("send run explains the autonomy governance and never-claims-sent", () => {
    const g = writeToolGuidance("outreach_trigger_send_run");
    expect(g).toMatch(/SUGGEST sends nothing/i);
    expect(g).toMatch(/Tier A is never auto-sent/i);
    expect(g).toMatch(/suppression/i);
    expect(g).toMatch(/confirm/i);
    expect(g).toMatch(/do NOT claim anything was sent/i);
  });

  it("sourcing says no credit is spent until confirmed", () => {
    const g = writeToolGuidance("outreach_source_leads");
    expect(g).toMatch(/sends nothing|spends no credit/i);
    expect(g).toMatch(/confirm/i);
    expect(g).toMatch(/do NOT claim/i);
  });

  it("unknown write tool falls back to a generic confirm-first message", () => {
    const g = writeToolGuidance("some_future_write_tool");
    expect(g).toMatch(/confirmation|confirm/i);
    expect(g).toMatch(/do NOT claim/i);
  });

  it("guidance never instructs the model to say the action is impossible", () => {
    for (const id of [
      "outreach_draft_email",
      "outreach_trigger_send_run",
      "outreach_source_leads",
    ]) {
      const g = writeToolGuidance(id);
      expect(g).not.toMatch(/cannot|unable|disabled|blocked|not possible/i);
    }
  });
});
