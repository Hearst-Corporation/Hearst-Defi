import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mockLoggerWarn = vi.fn();
const mockGetAllowedAdminReadTools = vi.fn();
const mockExecuteAdminReadTool = vi.fn();
vi.mock("@/lib/logger", () => ({
  logger: {
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: vi.fn(),
  },
}));
vi.mock("@/lib/llm/tools/registry", () => ({
  getAllowedAdminReadTools: (...args: unknown[]) => mockGetAllowedAdminReadTools(...args),
  executeAdminReadTool: (...args: unknown[]) => mockExecuteAdminReadTool(...args),
}));

import { runChatAgent, type StreamingChatClient } from "@/lib/llm/chat-agent";
import { BLOCK_SENTINEL } from "@/lib/llm/output-guard";

type Chunk = {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
};

function textChunk(content: string): Chunk {
  return { choices: [{ delta: { content } }] };
}

function toolChunk(
  index: number,
  fn: { name?: string; arguments?: string },
  id?: string,
): Chunk {
  return { choices: [{ delta: { tool_calls: [{ index, id, function: fn }] } }] };
}

function fakeClient(
  chunks: Chunk[],
  opts?: { throwOnCreate?: boolean },
): StreamingChatClient {
  return {
    chat: {
      completions: {
        create: async () => {
          if (opts?.throwOnCreate) throw new Error("upstream down");
          return (async function* () {
            for (const c of chunks) yield c;
          })();
        },
      },
    },
  };
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
  }
  out += dec.decode();
  return out;
}

const MSGS = [
  { role: "system" as const, content: "sys" },
  { role: "user" as const, content: "hi" },
];

describe("runChatAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllowedAdminReadTools.mockReturnValue([]);
  });

  it("streams a text-only answer and resolves nav=null", async () => {
    const client = fakeClient([
      textChunk("Target 8 à 15 % annualisé, "),
      textChunk("distributions mensuelles."),
    ]);
    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS);
    const text = await readAll(stream);
    expect(text).toBe("Target 8 à 15 % annualisé, distributions mensuelles.");
    expect(await nav).toBeNull();
  });

  it("captures a navigate tool call (fragmented args) and resolves the destination", async () => {
    const client = fakeClient([
      textChunk("Voici votre portefeuille. "),
      toolChunk(0, { name: "navigate", arguments: '{"desti' }),
      toolChunk(0, { arguments: 'nation":"portfolio"}' }),
    ]);
    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS);
    const text = await readAll(stream);
    expect(text).toBe("Voici votre portefeuille. ");
    const dest = await nav;
    expect(dest?.route).toBe("/portfolio");
  });

  it("ignores an unknown navigate destination", async () => {
    const client = fakeClient([
      textChunk("D'accord. "),
      toolChunk(0, { name: "navigate", arguments: '{"destination":"admin"}' }),
    ]);
    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS);
    await readAll(stream);
    expect(await nav).toBeNull();
  });

  it("scopes destinations to LP profile by default (admin key rejected)", async () => {
    const client = fakeClient([
      toolChunk(0, { name: "navigate", arguments: '{"destination":"admin-dashboard"}' }),
    ]);
    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS);
    await readAll(stream);
    expect(await nav).toBeNull();
  });

  it("accepts admin destinations when navProfile=admin", async () => {
    const client = fakeClient([
      textChunk("Je t'ouvre la gouvernance. "),
      toolChunk(0, { name: "navigate", arguments: '{"destination":"admin-governance"}' }),
    ]);
    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS, {
      navProfile: "admin",
    });
    const text = await readAll(stream);
    expect(text).toContain("gouvernance");
    expect((await nav)?.route).toBe("/admin/governance");
  });

  it("admin mode executes allowed read tool and uses it in same response", async () => {
    mockGetAllowedAdminReadTools.mockReturnValue([
      {
        id: "read_runtime_capabilities",
        description: "Runtime capabilities matrix",
      },
    ]);
    mockExecuteAdminReadTool.mockResolvedValue({
      id: "read_runtime_capabilities",
      format: "multiline_text_block",
      title: "CAPACITES OUTILLEES (RUNTIME APP)",
      lines: ["- internet_live_outille: no"],
    });
    const client = fakeClient([
      toolChunk(0, { name: "read_runtime_capabilities", arguments: "{}" }, "call_read_1"),
      textChunk("Synthese admin: internet live non outille."),
    ]);
    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS, {
      navProfile: "admin",
      chatMode: "admin",
    });
    const text = await readAll(stream);
    expect(text).toContain("internet live non outille");
    expect(mockExecuteAdminReadTool).toHaveBeenCalledTimes(1);
    expect(await nav).toBeNull();
  });

  it("admin mode invokes generate_chart_spec with parsed args", async () => {
    mockGetAllowedAdminReadTools.mockReturnValue([
      {
        id: "generate_chart_spec",
        description: "Generate deterministic chart specification from available data",
        parameters: {
          type: "object",
          properties: {
            intent: { type: "string" },
            chartType: { type: "string" },
          },
          required: ["intent", "chartType"],
          additionalProperties: false,
        },
      },
    ]);
    mockExecuteAdminReadTool.mockResolvedValue({
      id: "generate_chart_spec",
      format: "json_object",
      title: "CHART SPEC",
      lines: ["- intent: APY trend", "- type: line"],
      payload: { chart: { title: "APY trend (30d)" } },
    });
    const client = fakeClient([
      toolChunk(
        0,
        {
          name: "generate_chart_spec",
          arguments: '{"intent":"APY trend","chartType":"line","timeframe":"30d"}',
        },
        "call_chart_1",
      ),
      textChunk("Spec de chart préparée."),
    ]);
    const { stream } = runChatAgent(client, "gpt-4.1", MSGS, {
      navProfile: "admin",
      chatMode: "admin",
    });
    const text = await readAll(stream);
    expect(text).toContain("Spec de chart");
    expect(mockExecuteAdminReadTool).toHaveBeenCalledWith(
      expect.objectContaining({ id: "generate_chart_spec" }),
      { chatMode: "admin", profile: "admin" },
      { intent: "APY trend", chartType: "line", timeframe: "30d" },
      { userId: undefined },
    );
  });

  it("passes userId to admin read tool execution for telemetry attribution", async () => {
    mockGetAllowedAdminReadTools.mockReturnValue([
      {
        id: "read_runtime_capabilities",
        description: "caps",
        parameters: { type: "object", properties: {}, additionalProperties: false },
      },
    ]);
    mockExecuteAdminReadTool.mockResolvedValue({
      id: "read_runtime_capabilities",
      format: "multiline_text_block",
      title: "CAPS",
      lines: ["ok"],
    });
    const client = fakeClient([
      toolChunk(0, { name: "read_runtime_capabilities", arguments: "{}" }, "call_read_uid"),
      textChunk("Caps user-bound."),
    ]);
    const { stream } = runChatAgent(client, "gpt-4.1", MSGS, {
      navProfile: "admin",
      chatMode: "admin",
      userId: "user_admin_42",
    });
    await readAll(stream);
    expect(mockExecuteAdminReadTool).toHaveBeenCalledWith(
      expect.objectContaining({ id: "read_runtime_capabilities" }),
      { chatMode: "admin", profile: "admin" },
      {},
      { userId: "user_admin_42" },
    );
  });

  it("normal mode does not execute admin read tools", async () => {
    mockGetAllowedAdminReadTools.mockReturnValue([
      {
        id: "read_runtime_capabilities",
        description: "Runtime capabilities matrix",
      },
    ]);
    const client = fakeClient([
      toolChunk(0, { name: "read_runtime_capabilities", arguments: "{}" }, "call_read_1"),
      textChunk("Mode normal sans outils admin."),
    ]);
    const { stream } = runChatAgent(client, "gpt-4.1", MSGS, {
      chatMode: "normal",
    });
    const text = await readAll(stream);
    expect(text).toContain("Mode normal");
    expect(mockExecuteAdminReadTool).not.toHaveBeenCalled();
  });

  it("blocks attempted write tool auto-exec in admin mode", async () => {
    mockGetAllowedAdminReadTools.mockReturnValue([]);
    const client = fakeClient([
      toolChunk(0, {
        name: "create_review_note_draft",
        arguments: '{"title":"x","body":"y"}',
      }, "call_write_1"),
      textChunk("Je propose de creer un draft a confirmer."),
    ]);
    const { stream } = runChatAgent(client, "gpt-4.1", MSGS, {
      chatMode: "admin",
      navProfile: "admin",
    });
    const text = await readAll(stream);
    expect(text).toContain("draft");
    expect(mockExecuteAdminReadTool).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "chat-agent: blocked model write tool auto-exec attempt",
      { toolId: "create_review_note_draft" },
    );
  });

  it("keeps write tool auto-exec blocked across first and second pass in admin mode", async () => {
    mockGetAllowedAdminReadTools.mockReturnValue([
      {
        id: "read_runtime_capabilities",
        description: "Runtime capabilities matrix",
      },
    ]);
    mockExecuteAdminReadTool.mockResolvedValue({
      id: "read_runtime_capabilities",
      format: "multiline_text_block",
      title: "CAPACITES OUTILLEES (RUNTIME APP)",
      lines: ["- db_write_outille: no"],
    });

    const client = fakeClient([
      toolChunk(0, { name: "read_runtime_capabilities", arguments: "{}" }, "call_read_1"),
      toolChunk(
        1,
        {
          name: "create_governance_proposal_draft",
          arguments: '{"vaultDeploymentId":"v1","actionType":"pause"}',
        },
        "call_write_1",
      ),
      textChunk("Je fournis une proposition a confirmer manuellement."),
    ]);

    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS, {
      chatMode: "admin",
      navProfile: "admin",
    });
    const text = await readAll(stream);

    expect(text).toContain("proposition");
    expect(mockExecuteAdminReadTool).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "chat-agent: blocked model write tool auto-exec attempt",
      { toolId: "create_governance_proposal_draft" },
    );
    expect(await nav).toBeNull();
  });

  it("does NOT navigate when the answer is non-compliant (blocked)", async () => {
    const client = fakeClient([
      textChunk("Le rendement est garanti. "),
      toolChunk(0, { name: "navigate", arguments: '{"destination":"portfolio"}' }),
    ]);
    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS);
    const text = await readAll(stream);
    expect(text).toContain(BLOCK_SENTINEL);
    expect(await nav).toBeNull();
  });

  it("surfaces an upstream create() failure as an error sentinel, nav=null", async () => {
    const client = fakeClient([], { throwOnCreate: true });
    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS);
    const text = await readAll(stream);
    expect(text).toContain("\x00ERROR:");
    expect(await nav).toBeNull();
  });

  // BUG B1 — repro: a stream that yields one chunk then HANGS forever (never
  // returns). Without an internal abort the turn (and nav) would deadlock the
  // route. With a short injected timeout the stream ends and nav resolves.
  it("aborts a hanging upstream stream via internal timeout and settles nav", async () => {
    const hangingClient: StreamingChatClient = {
      chat: {
        completions: {
          create: async (_params, options) =>
            (async function* () {
              yield textChunk("Un instant");
              // Stall forever unless the injected AbortSignal fires.
              await new Promise<void>((_resolve, reject) => {
                const signal = options?.signal;
                if (signal) {
                  if (signal.aborted) {
                    reject(new Error("aborted"));
                    return;
                  }
                  signal.addEventListener(
                    "abort",
                    () => reject(new Error("aborted")),
                    { once: true },
                  );
                }
              });
            })(),
        },
      },
    };

    const { stream, nav } = runChatAgent(hangingClient, "gpt-4.1", MSGS, {
      timeoutMs: 30,
    });
    // Must resolve (not hang). readAll completing IS the assertion the stream
    // ended; the partial text streamed before the stall is preserved.
    const text = await readAll(stream);
    expect(text).toContain("Un instant");
    expect(await nav).toBeNull();
  });

  // BUG B2 — repro: tool-call-only completion with NO text content. The bubble
  // must not be empty — a short FR fallback sentence is emitted, and nav still
  // resolves the chosen destination.
  it("emits a fallback sentence when the model returns a tool call with no text", async () => {
    const client = fakeClient([
      toolChunk(0, { name: "navigate", arguments: '{"destination":"portfolio"}' }),
    ]);
    const { stream, nav } = runChatAgent(client, "gpt-4.1", MSGS);
    const text = await readAll(stream);
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text).not.toContain(BLOCK_SENTINEL);
    const dest = await nav;
    expect(dest?.route).toBe("/portfolio");
  });

  it("resolves `final` with the answer text for persistence (compliant)", async () => {
    const client = fakeClient([textChunk("Réponse compliant.")]);
    const { stream, final } = runChatAgent(client, "gpt-4.1", MSGS);
    await readAll(stream);
    expect(await final).toEqual({ text: "Réponse compliant.", blocked: false });
  });

  it("resolves `final` blocked=true with empty text on a non-compliant answer", async () => {
    const client = fakeClient([textChunk("Le rendement est garanti.")]);
    const { stream, final } = runChatAgent(client, "gpt-4.1", MSGS);
    await readAll(stream);
    expect(await final).toEqual({ text: "", blocked: true });
  });
});
