import "server-only";

import { logger } from "@/lib/logger";
import { chatOutputViolation } from "@/lib/llm/output-guard";
import {
  executeAdminReadTool,
  getAllowedAdminReadTools,
} from "@/lib/llm/tools/registry";

/**
 * Only the no-parameter SNAPSHOT read tools feed the always-on admin context
 * block. On-demand tools (chart/demo/export specs, outreach_*) are NOT
 * auto-executed here — the model calls them explicitly when needed — so an admin
 * turn never pays for an Apollo / prospect query it did not ask for, and the
 * injected context stays a stable platform snapshot.
 */
const CONTEXT_SNAPSHOT_TOOL_IDS: ReadonlySet<string> = new Set([
  "read_allocations_canonical",
  "read_market_snapshot",
  "read_routes_index",
  "read_specs_index",
  "read_runtime_capabilities",
]);

export async function buildAdminContextBlock(): Promise<string> {
  const context = { chatMode: "admin" as const, profile: "admin" as const };
  const tools = getAllowedAdminReadTools(context).filter((tool) =>
    CONTEXT_SNAPSHOT_TOOL_IDS.has(tool.id),
  );

  const settled = await Promise.allSettled(
    tools.map(async (tool) => executeAdminReadTool(tool, context)),
  );

  const sections: string[] = ["ADMIN LIVE CONTEXT"];
  for (let i = 0; i < settled.length; i += 1) {
    const result = settled[i];
    const tool = tools[i];
    if (!tool) continue;

    if (result?.status === "fulfilled") {
      // Defence-in-depth: a read-tool result is DB/market data, not model
      // output, but it is injected VERBATIM into the admin system prompt. Lint
      // it with the same output guard so a non-compliant value (e.g. a vault
      // manually named with a forbidden word) can never reshape the prompt as
      // an attested claim. Redact the whole section on violation.
      const block = [result.value.title, ...result.value.lines].join("\n");
      if (chatOutputViolation(block, true)) {
        logger.warn(
          "admin-context tool result failed compliance lint — redacted",
          { toolId: tool.id },
        );
        sections.push(
          `TOOL REDACTED (${tool.id})`,
          "- omitted: result failed the output compliance guard",
        );
        continue;
      }
      sections.push(result.value.title, ...result.value.lines);
      continue;
    }

    logger.warn(
      "admin-context tool execution failed — continuing with partial context",
      { toolId: tool.id },
      result?.reason instanceof Error ? result.reason : undefined,
    );
    sections.push(
      `TOOL UNAVAILABLE (${tool.id})`,
      "- unavailable: tool execution failed",
    );
  }

  return sections.join("\n");
}
