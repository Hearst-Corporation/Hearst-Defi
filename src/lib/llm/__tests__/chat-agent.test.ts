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
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens?: number;
  } | null;
};

function textChunk(content: string): Chunk {
  return { choices: [{ delta: { content } }] };
}

/** Terminal usage chunk (stream_options.include_usage): empty choices + usage. */
function usageChunk(usage: {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
}): Chunk {
  return { choices: [], usage };
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

  it("streams a text-only answer and resolves final with text", async () => {
    const client = fakeClient([
      textChunk("Note de mining : rendement cible estimé 8 à 15 %, "),
      textChunk("BTC accumulé sur 24 mois."),
    ]);
    const { stream, final } = runChatAgent(client, "gpt-4.1", MSGS);
    const text = await readAll(stream);
    expect(text).toBe("Note de mining : rendement cible estimé 8 à 15 %, BTC accumulé sur 24 mois.");
    const result = await final;
    expect(result.status).toBe("success");
    expect(result.blocked).toBe(false);
  });

  it("captures token usage from the terminal usage chunk and reports success (OBS-03)", async () => {
    const client = fakeClient([
      textChunk("Bonjour. "),
      usageChunk({ prompt_tokens: 12, completion_tokens: 3, total_tokens: 15 }),
    ]);
    const { stream, final } = runChatAgent(client, "gpt-4.1", MSGS);
    await readAll(stream);
    const result = await final;
    expect(result.status).toBe("success");
    expect(result.errorType).toBeNull();
    expect(result.usage).toEqual({
      prompt_tokens: 12,
      completion_tokens: 3,
      total_tokens: 15,
    });
  });

  it("reports a failed status with null usage when create() throws (OBS-01)", async () => {
    const client = fakeClient([], { throwOnCreate: true });
    const { stream, final } = runChatAgent(client, "gpt-4.1", MSGS);
    await readAll(stream);
    const result = await final;
    expect(result.status).toBe("failed");
    expect(result.errorType).toBe("llm_create");
    expect(result.usage).toBeNull();
  });

  it("navigation is fully deterministic — the model has no navigate tool, final is unblocked success", async () => {
    // The model has no navigate tool. The final result must reflect a clean
    // success regardless of what text the model emits.
    const client = fakeClient([
      textChunk("Voici votre portefeuille. "),
    ]);
    const { stream, final } = runChatAgent(client, "gpt-4.1", MSGS);
    await readAll(stream);
    const result = await final;
    expect(result.status).toBe("success");
    expect(result.blocked).toBe(false);
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
      lines: ["- internet_live_outille: yes (coingecko btc price live)"],
    });
    const client = fakeClient([
      toolChunk(0, { name: "read_runtime_capabilities", arguments: "{}" }, "call_read_1"),
      textChunk("Synthese admin: internet live non outille."),
    ]);
    const { stream, final } = runChatAgent(client, "gpt-4.1", MSGS, {
      chatMode: "admin",
    });
    const text = await readAll(stream);
    expect(text).toContain("internet live");
    expect(mockExecuteAdminReadTool).toHaveBeenCalledTimes(1);
    expect((await final).status).toBe("success");
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

  it("coerces non-object tool arguments to {} before the tool runs (P1-001 hardening)", async () => {
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
      // The model emits a JSON ARRAY as the arguments — must never reach the tool.
      toolChunk(0, { name: "read_runtime_capabilities", arguments: '["not","object"]' }, "call_bad"),
      textChunk("ok"),
    ]);
    const { stream } = runChatAgent(client, "gpt-4.1", MSGS, {
      chatMode: "admin",
    });
    await readAll(stream);
    expect(mockExecuteAdminReadTool).toHaveBeenCalledWith(
      expect.objectContaining({ id: "read_runtime_capabilities" }),
      { chatMode: "admin", profile: "admin" },
      {},
      { userId: undefined },
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

    const { stream, final } = runChatAgent(client, "gpt-4.1", MSGS, {
      chatMode: "admin",
    });
    const text = await readAll(stream);

    expect(text).toContain("proposition");
    expect(mockExecuteAdminReadTool).toHaveBeenCalledTimes(1);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "chat-agent: blocked model write tool auto-exec attempt",
      { toolId: "create_governance_proposal_draft" },
    );
    expect((await final).status).toBe("success");
  });

  it("write tool auto-exec stays blocked (navigate tool removed, model unknown tool calls ignored)", async () => {
    mockGetAllowedAdminReadTools.mockReturnValue([]);
    const client = fakeClient([
      toolChunk(
        0,
        {
          name: "create_governance_proposal_draft",
          arguments: '{"vaultDeploymentId":"v1","actionType":"pause"}',
        },
        "call_write_nav_1",
      ),
      textChunk("Je vous dirige vers la gouvernance avec proposition manuelle."),
    ]);
    const { stream, final } = runChatAgent(client, "gpt-4.1", MSGS, {
      chatMode: "admin",
    });
    const text = await readAll(stream);
    expect(text).toContain("gouvernance");
    expect(mockExecuteAdminReadTool).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "chat-agent: blocked model write tool auto-exec attempt",
      { toolId: "create_governance_proposal_draft" },
    );
    // Navigation is deterministic (regex), not model-proposed.
    expect((await final).status).toBe("success");
  });

  it("compliance guard blocks non-compliant answer and final reflects it", async () => {
    const client = fakeClient([
      textChunk("Le rendement est garanti. "),
    ]);
    const { stream, final } = runChatAgent(client, "gpt-4.1", MSGS);
    const text = await readAll(stream);
    expect(text).toContain(BLOCK_SENTINEL);
    const result = await final;
    expect(result.blocked).toBe(true);
    expect(result.status).toBe("success");
  });

  it("surfaces an upstream create() failure as an error sentinel", async () => {
    const client = fakeClient([], { throwOnCreate: true });
    const { stream, final } = runChatAgent(client, "gpt-4.1", MSGS);
    const text = await readAll(stream);
    expect(text).toContain("\x00ERROR:");
    expect((await final).status).toBe("failed");
  });

  // BUG B1 — repro: a stream that yields one chunk then HANGS forever (never
  // returns). Without an internal abort the turn (and nav) would deadlock the
  // route. With a short injected timeout the stream ends and nav resolves.
  it("aborts a hanging upstream stream via internal timeout and settles final", async () => {
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

    const { stream, final } = runChatAgent(hangingClient, "gpt-4.1", MSGS, {
      timeoutMs: 30,
    });
    // Must resolve (not hang). readAll completing IS the assertion the stream
    // ended; the partial text streamed before the stall is preserved.
    const text = await readAll(stream);
    expect(text).toContain("Un instant");
    expect((await final).status).toBe("timeout");
  });

  // The navigate tool is gone, so a tool-call-only first pass (admin read tool)
  // is handled by the second pass. A plain text-only completion is the LP default.
  it("tool-call-only first pass without text: admin second pass provides text", async () => {
    mockGetAllowedAdminReadTools.mockReturnValue([
      {
        id: "read_runtime_capabilities",
        description: "Runtime capabilities matrix",
      },
    ]);
    mockExecuteAdminReadTool.mockResolvedValue({
      id: "read_runtime_capabilities",
      format: "multiline_text_block",
      title: "CAPS",
      lines: ["ok"],
    });
    // First pass: tool call only (no text). Second pass: text.
    let callCount = 0;
    const twoPassClient: StreamingChatClient = {
      chat: {
        completions: {
          create: async () => {
            callCount++;
            if (callCount === 1) {
              return (async function* () {
                yield toolChunk(0, { name: "read_runtime_capabilities", arguments: "{}" }, "call_1");
              })();
            }
            return (async function* () {
              yield textChunk("Caps chargées.");
            })();
          },
        },
      },
    };
    const { stream } = runChatAgent(twoPassClient, "gpt-4.1", MSGS, {
      chatMode: "admin",
    });
    const text = await readAll(stream);
    expect(text).toContain("Caps");
    expect(text).not.toContain(BLOCK_SENTINEL);
  });

  it("resolves `final` with the answer text for persistence (compliant)", async () => {
    const client = fakeClient([textChunk("Réponse compliant.")]);
    const { stream, final } = runChatAgent(client, "gpt-4.1", MSGS);
    await readAll(stream);
    expect(await final).toMatchObject({
      text: "Réponse compliant.",
      blocked: false,
      status: "success",
    });
  });

  it("resolves `final` blocked=true with empty text on a non-compliant answer", async () => {
    const client = fakeClient([textChunk("Le rendement est garanti.")]);
    const { stream, final } = runChatAgent(client, "gpt-4.1", MSGS);
    await readAll(stream);
    // A blocked answer is still a successful model turn — the guard blocked it.
    expect(await final).toMatchObject({ text: "", blocked: true, status: "success" });
  });
});
