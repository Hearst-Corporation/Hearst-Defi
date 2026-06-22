import { describe, expect, it, vi } from "vitest";

/**
 * Registry + gating coverage for the outreach tools folded into the unified
 * chat. Asserts the 5 tools exist, every write tool is HITL-confirmed, and they
 * are exposed to admin-mode + admin-profile ONLY (no LP / normal-mode leak) —
 * the cross-profile invariant the counter-audit pinned.
 *
 * The heavy domain graph (DB / outreach actions / send job) is mocked: this test
 * only inspects the static tool definitions and the pure policy filter.
 */

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/app/admin/outreach/actions", () => ({
  runSourcing: vi.fn(),
  draftEmailForProspect: vi.fn(),
}));
vi.mock("@/lib/inngest/functions/outreach-auto-send", () => ({
  outreachAutoSendHandler: vi.fn(),
}));

import {
  ADMIN_READ_TOOLS,
  ADMIN_WRITE_TOOLS,
  getAllowedAdminReadTools,
  getAllowedAdminWriteTools,
} from "@/lib/llm/tools/registry";

const OUTREACH_READ = ["outreach_list_prospects", "outreach_stats"];
const OUTREACH_WRITE = [
  "outreach_source_leads",
  "outreach_draft_email",
  "outreach_trigger_send_run",
];

describe("outreach tools — registry + gating", () => {
  it("registers the read + write outreach tools", () => {
    const readIds = ADMIN_READ_TOOLS.map((t) => t.id);
    const writeIds = ADMIN_WRITE_TOOLS.map((t) => t.id);
    for (const id of OUTREACH_READ) expect(readIds).toContain(id);
    for (const id of OUTREACH_WRITE) expect(writeIds).toContain(id);
  });

  it("requires HITL confirmation on every outreach write tool", () => {
    for (const id of OUTREACH_WRITE) {
      const tool = ADMIN_WRITE_TOOLS.find((t) => t.id === id);
      expect(tool?.confirmationRequired).toBe(true);
    }
  });

  it("exposes outreach tools to admin mode + admin profile only", () => {
    const readAdmin = getAllowedAdminReadTools({
      chatMode: "admin",
      profile: "admin",
    }).map((t) => t.id);
    for (const id of OUTREACH_READ) expect(readAdmin).toContain(id);

    // normal mode (LP-facing) must NOT see them.
    const readNormal = getAllowedAdminReadTools({
      chatMode: "normal",
      profile: "admin",
    }).map((t) => t.id);
    for (const id of OUTREACH_READ) expect(readNormal).not.toContain(id);

    // lp profile must NOT see them.
    const readLp = getAllowedAdminReadTools({
      chatMode: "admin",
      profile: "lp",
    }).map((t) => t.id);
    for (const id of OUTREACH_READ) expect(readLp).not.toContain(id);

    const writeAdmin = getAllowedAdminWriteTools({
      chatMode: "admin",
      profile: "admin",
    }).map((t) => t.id);
    for (const id of OUTREACH_WRITE) expect(writeAdmin).toContain(id);

    const writeLp = getAllowedAdminWriteTools({
      chatMode: "admin",
      profile: "lp",
    }).map((t) => t.id);
    for (const id of OUTREACH_WRITE) expect(writeLp).not.toContain(id);
  });
});
