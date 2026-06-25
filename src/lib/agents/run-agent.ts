import "server-only";

import { callLlm, type LlmClientLike } from "@/lib/llm/client";
import { parseLlmJsonObject } from "@/lib/agents/parse-llm-json";

export type SystemBlock =
  | { type: "text"; text: string; cache_control: { type: "ephemeral" } }
  | { type: "text"; text: string };

/**
 * Shared executor for the 4 batch agents.
 * Handles LLM call, text block extraction, and JSON parsing.
 */
export async function runAgent<T>(
  agentId: string,
  params: {
    model: string;
    system: string | SystemBlock[];
    prompt: string;
    client?: LlmClientLike;
    schema: {
      safeParse: (
        data: unknown,
      ) =>
        | { success: true; data: T }
        | { success: false; error: { issues: readonly unknown[] } };
    };
    maxTokens?: number;
    timeoutMs?: number;
  },
): Promise<T> {
  const systemBlocks: SystemBlock[] = Array.isArray(params.system)
    ? params.system
    : [
        {
          type: "text",
          text: params.system,
          cache_control: { type: "ephemeral" },
        },
      ];

  const { response } = await callLlm(
    agentId,
    {
      model: params.model,
      max_tokens: params.maxTokens ?? 1024,
      system: systemBlocks,
      messages: [
        {
          role: "user",
          content: params.prompt,
        },
      ],
    },
    { client: params.client, timeoutMs: params.timeoutMs },
  );

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error(`${agentId} agent returned no text block.`);
  }

  const parsed = parseLlmJsonObject(textBlock.text, `${agentId} agent`);
  const result = params.schema.safeParse(parsed);

  if (!result.success) {
    throw new Error(
      `${agentId} agent output failed schema validation: ${JSON.stringify(
        result.error.issues,
      )}`,
    );
  }

  return result.data!;
}
