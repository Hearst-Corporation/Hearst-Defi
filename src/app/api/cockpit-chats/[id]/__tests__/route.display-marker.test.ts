import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

import { canvasOpenMarker } from "@/lib/canvas/intent";

/**
 * Regression: GET /api/cockpit-chats/[id] must STRIP the hidden canvas
 * open-marker from assistant turns before returning them for display.
 *
 * The marker ("[[canvas-open:<id>]]") is appended to the PERSISTED assistant
 * turn by the chat route purely so the next turn's cross-turn detection
 * (which reads its own DB load) knows a workshop is still on screen. It must
 * never reach the chat bubble. A prior bug returned `content` verbatim, so the
 * literal marker leaked into the rendered transcript on reload/reconciliation.
 *
 * This pins the strip at the display boundary while leaving user turns intact.
 */

vi.mock("server-only", () => ({}));

const { requireAuthMock } = vi.hoisted(() => ({ requireAuthMock: vi.fn() }));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: requireAuthMock }));

vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { findUniqueMock, findManyMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  findManyMock: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    cockpitChat: { findUnique: findUniqueMock },
    cockpitMessage: { findMany: findManyMock },
  },
}));

import { GET } from "../route";

interface MsgRow {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
}

function makeReq(): NextRequest {
  return {} as unknown as NextRequest;
}

const OWNER = "user-1";

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue({ userId: OWNER });
  findUniqueMock.mockResolvedValue({ userId: OWNER, title: "Outreach" });
});

async function loadMessages(rows: MsgRow[]) {
  findManyMock.mockResolvedValue(rows);
  const res = await GET(makeReq(), { params: Promise.resolve({ id: "chat-1" }) });
  const body = (await res.json()) as {
    messages: { id: string; role: string; content: string }[];
  };
  return body.messages;
}

describe("GET /api/cockpit-chats/[id] — canvas marker stripping", () => {
  it("strips the canvas open-marker from an assistant turn", async () => {
    const marker = canvasOpenMarker("outreach");
    const msgs = await loadMessages([
      {
        id: "m1",
        role: "assistant",
        content: `C'est noté : campagne « Debug QA Q3 », type cold.\n${marker}`,
        createdAt: new Date("2026-06-25T00:00:00Z"),
      },
    ]);

    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.content).not.toContain("canvas-open");
    expect(msgs[0]?.content).not.toContain("[[");
    expect(msgs[0]?.content).toBe(
      "C'est noté : campagne « Debug QA Q3 », type cold.",
    );
  });

  it("leaves user turns and marker-free assistant turns unchanged", async () => {
    const msgs = await loadMessages([
      {
        id: "m1",
        role: "user",
        content: "lance une campagne outreach pour Hearst Yield",
        createdAt: new Date("2026-06-25T00:00:00Z"),
      },
      {
        id: "m2",
        role: "assistant",
        content: "Le rendement cible est compris entre 8 et 15 %.",
        createdAt: new Date("2026-06-25T00:00:01Z"),
      },
    ]);

    expect(msgs[0]?.content).toBe(
      "lance une campagne outreach pour Hearst Yield",
    );
    expect(msgs[1]?.content).toBe(
      "Le rendement cible est compris entre 8 et 15 %.",
    );
  });
});
