/**
 * Route-level integration — DETERMINISTIC Outreach turn (NO LLM, NO prod write).
 *
 * Drives the REAL POST handler with mocked auth / prisma / openai / publishNav /
 * runChatAgent, so the deterministic state machine is exercised end-to-end
 * without an OpenAI call or a Supabase write. Proves:
 *   turn 1 → canvas published + building frame (no button, fields "—") + the
 *            template "name + kind?" question, with the chat LLM NEVER invoked;
 *   turn 2 → regex extraction (Q3 / cold) → ready frame whose button payload name
 *            EQUALS the workspace name, with a monotonic revision.
 *
 * No real campaign is created here: the route only emits a frame + text. The
 * draft write lives behind the HITL token on /api/admin/chat-tools (covered by
 * route-e2e.test.ts).
 */
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  assertBodySize: vi.fn().mockResolvedValue(undefined),
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/feature-flags", () => ({
  FEATURE_FLAGS: { CHAT_MASTER_AGENT: true },
}));

// OpenAI with a spy on chat.completions.create — asserted NEVER called on the
// deterministic turn (the regex classifier wins, no LLM classification either).
// `vi.hoisted` so the spy exists when the hoisted vi.mock factory runs.
const { openaiCreate } = vi.hoisted(() => ({ openaiCreate: vi.fn() }));
vi.mock("@/lib/llm/openai", () => ({
  openai: { chat: { completions: { create: openaiCreate } } },
  LLM_MODEL: "gpt-4.1",
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminChatMode: { findUnique: vi.fn() },
    cockpitChat: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    cockpitMessage: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    llmRun: { create: vi.fn() },
    navTrace: { create: vi.fn() },
  },
}));

vi.mock("@/lib/agents/user-context", () => ({
  loadUserAgentProfile: vi.fn().mockResolvedValue(null),
  loadUserMemory: vi.fn().mockResolvedValue(null),
  buildUserContextSystemBlock: vi.fn().mockReturnValue(null),
}));
vi.mock("@/lib/llm/chat-context", () => ({
  buildPortfolioContextBlock: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/llm/admin-context", () => ({
  buildAdminContextBlock: vi.fn().mockResolvedValue(""),
}));
// runChatAgent must NEVER run on a deterministic outreach turn.
vi.mock("@/lib/llm/chat-agent", () => ({ runChatAgent: vi.fn() }));
vi.mock("@/lib/llm/nav-channel", () => ({ publishNav: vi.fn() }));

import { POST } from "@/app/api/cockpit-chat/route";
import { requireAuth } from "@/lib/auth/require-auth";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { runChatAgent } from "@/lib/llm/chat-agent";
import { publishNav } from "@/lib/llm/nav-channel";

const mockRequireAuth = vi.mocked(requireAuth);
const mockGetSession = vi.mocked(getSession);
const mockRunChatAgent = vi.mocked(runChatAgent);
const mockPublishNav = vi.mocked(publishNav);
const mockMsgCreate = vi.mocked(prisma.cockpitMessage.create);

const USER_ID = "admin-outreach-test";
const EVENT_PREFIX = "\x00HC_EVENT:";

interface Frame {
  canvasId: string;
  revision: number;
  sections: Array<{
    id: string;
    status: string;
    fields: Array<{ key: string; value: string }>;
    actions: Array<{ toolId: string; input?: Record<string, unknown> }>;
  }>;
}

async function readBody(res: Response): Promise<{ frames: Frame[]; text: string }> {
  if (!res.body) return { frames: [], text: "" };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) buf += dec.decode(value, { stream: true });
  }
  const frames: Frame[] = [];
  let text = "";
  for (const line of buf.split("\n")) {
    const idx = line.indexOf(EVENT_PREFIX);
    if (idx === -1) {
      text += line;
      continue;
    }
    text += line.slice(0, idx);
    try {
      const ev = JSON.parse(line.slice(idx + EVENT_PREFIX.length)) as {
        type?: string;
        canvas?: Frame;
      };
      if (ev.type === "canvas_state" && ev.canvas) frames.push(ev.canvas);
    } catch {
      /* ignore */
    }
  }
  return { frames, text };
}

function chatRequest(message: string): NextRequest {
  return new Request("http://localhost/api/cockpit-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  }) as NextRequest;
}

describe("POST /api/cockpit-chat — deterministic Outreach turn", () => {
  let clock = 1_700_000_000_000;

  beforeEach(() => {
    vi.clearAllMocks();
    clock = 1_700_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => ++clock);
    mockRequireAuth.mockResolvedValue({ userId: USER_ID });
    mockGetSession.mockResolvedValue({ role: "admin" } as never);
    vi.mocked(prisma.adminChatMode.findUnique).mockResolvedValue({
      mode: "admin",
      userId: USER_ID,
      updatedAt: new Date(),
    } as never);
    vi.mocked(prisma.cockpitChat.create).mockResolvedValue({
      id: "chat-1",
      userId: USER_ID,
    } as never);
    vi.mocked(prisma.cockpitChat.findUnique).mockResolvedValue({
      userId: USER_ID,
    } as never);
    vi.mocked(prisma.cockpitChat.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.cockpitChat.update).mockResolvedValue({} as never);
    vi.mocked(prisma.cockpitMessage.create).mockResolvedValue({} as never);
    vi.mocked(prisma.cockpitMessage.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.cockpitMessage.count).mockResolvedValue(0 as never);
    mockPublishNav.mockResolvedValue(undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  const TURN1 = "On va faire un outreach";
  const TURN2 = "Adrien et c'est un colde";
  const TURN3 = "T'as rien écrit dans le brouillon.";

  it("turn 1 asks only missing slots (no LLM classifier/router)", async () => {
    const res = await POST(chatRequest(TURN1));
    expect(res.status).toBe(200);
    expect(mockRunChatAgent).not.toHaveBeenCalled();
    expect(openaiCreate).not.toHaveBeenCalled();
    expect(mockPublishNav).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ canvasId: "outreach", destinationKey: "admin-agent-canvas", autostart: true }),
    );

    const { frames, text } = await readBody(res);
    expect(frames).toHaveLength(1);
    const campaign = frames[0]!.sections.find((s) => s.id === "outreach-campaign")!;
    expect(campaign.status).toBe("building");
    // No confirmable action anywhere.
    expect(frames[0]!.sections.flatMap((s) => s.actions)).toHaveLength(0);
    // Name + kind show no fabricated value.
    expect(campaign.fields.find((f) => f.key === "name")!.value).toBe("—");
    expect(campaign.fields.find((f) => f.key === "kind")!.value).toBe("—");
    const draft = frames[0]!.sections.find((s) => s.id === "outreach-draft")!;
    expect(draft.fields.find((f) => f.key === "subject")!.value).toBe("—");
    expect(draft.fields.find((f) => f.key === "body")!.value).toBe("—");
    expect(text).toContain("Il me manque");
    expect(text).toContain("`cold`");
    expect(text).toContain("`newsletter`");
    expect(text.toLowerCase()).not.toContain("confirmation nécessaire");
    expect(text).not.toContain("I can guide and analyze, not transact.");

    await vi.waitFor(() => {
      const assistant = mockMsgCreate.mock.calls
        .map((c) => c[0].data)
        .find((d: { role?: string }) => d.role === "assistant");
      expect(assistant?.content).toContain("Il me manque");
    });
    expect(vi.mocked(prisma.llmRun.create)).not.toHaveBeenCalled();
  });

  it("turn 2 prepares draft immediately and turn 3 complaint repairs/returns draft without re-asking slots", async () => {
    const res1 = await POST(chatRequest(TURN1));
    const { frames: f1 } = await readBody(res1);
    const rev1 = f1[0]!.revision;

    vi.clearAllMocks();
    vi.mocked(prisma.cockpitChat.create).mockResolvedValue({ id: "chat-2", userId: USER_ID } as never);
    vi.mocked(prisma.cockpitChat.findUnique).mockResolvedValue({ userId: USER_ID } as never);
    vi.mocked(prisma.cockpitChat.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.cockpitMessage.create).mockResolvedValue({} as never);
    vi.mocked(prisma.cockpitMessage.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.cockpitMessage.count).mockResolvedValue(0 as never);

    const res2 = await POST(chatRequest(TURN2));
    expect(res2.status).toBe(200);
    expect(mockRunChatAgent).not.toHaveBeenCalled();
    expect(openaiCreate).not.toHaveBeenCalled();

    const { frames, text } = await readBody(res2);
    const frame = frames[0]!;
    const campaign = frame.sections.find((s) => s.id === "outreach-campaign")!;
    const draft = frame.sections.find((s) => s.id === "outreach-draft")!;
    expect(campaign.status).toBe("ready");
    expect(draft.status).toBe("ready");

    const nameValue = campaign.fields.find((f) => f.key === "name")!.value;
    const kindValue = campaign.fields.find((f) => f.key === "kind")!.value;
    const subject = draft.fields.find((f) => f.key === "subject")!.value;
    const body = draft.fields.find((f) => f.key === "body")!.value;
    expect(nameValue).toBe("Adrien");
    expect(kindValue).toBe("cold");
    expect(subject.trim().length).toBeGreaterThan(0);
    expect(body.trim().length).toBeGreaterThan(0);
    expect(text).toContain("J’ai préparé un brouillon");
    expect(text).toContain("Adrien");
    expect(text).toContain("Aucun envoi n’a été lancé");
    expect(text.toLowerCase()).not.toContain("souhaites-tu continuer");
    expect(text.toLowerCase()).not.toContain("confirmation nécessaire");
    expect(text.toLowerCase()).not.toContain("source");
    expect(text).not.toContain("I can guide and analyze, not transact.");

    expect(frame.revision).toBeGreaterThan(rev1);
    expect(vi.mocked(prisma.llmRun.create)).not.toHaveBeenCalled();

    vi.clearAllMocks();
    vi.mocked(prisma.cockpitChat.create).mockResolvedValue({ id: "chat-3", userId: USER_ID } as never);
    vi.mocked(prisma.cockpitChat.findUnique).mockResolvedValue({ userId: USER_ID } as never);
    vi.mocked(prisma.cockpitChat.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.cockpitMessage.create).mockResolvedValue({} as never);
    vi.mocked(prisma.cockpitMessage.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.cockpitMessage.count).mockResolvedValue(0 as never);

    const res3 = await POST(chatRequest(TURN3));
    expect(res3.status).toBe(200);
    expect(mockRunChatAgent).not.toHaveBeenCalled();
    expect(openaiCreate).not.toHaveBeenCalled();

    const turn3 = await readBody(res3);
    const frame3 = turn3.frames[0]!;
    const campaign3 = frame3.sections.find((s) => s.id === "outreach-campaign")!;
    const draft3 = frame3.sections.find((s) => s.id === "outreach-draft")!;
    expect(campaign3.fields.find((f) => f.key === "name")!.value).toBe("Adrien");
    expect(campaign3.fields.find((f) => f.key === "kind")!.value).toBe("cold");
    expect(draft3.fields.find((f) => f.key === "subject")!.value.trim().length).toBeGreaterThan(0);
    expect(draft3.fields.find((f) => f.key === "body")!.value.trim().length).toBeGreaterThan(0);
    expect(turn3.text).toContain("Tu as raison");
    expect(turn3.text).toContain("Adrien");
    expect(turn3.text).toContain("Aucun envoi n’est lancé");
    expect(turn3.text.toLowerCase()).not.toContain("quel nom");
    expect(turn3.text.toLowerCase()).not.toContain("newsletter");
    expect(turn3.text.toLowerCase()).not.toContain("source");
    expect(turn3.text.toLowerCase()).not.toContain("created");
    expect(turn3.text).not.toContain("I can guide and analyze, not transact.");
    expect(vi.mocked(prisma.llmRun.create)).not.toHaveBeenCalled();
  });
});
