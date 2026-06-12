import "server-only";

import { logger } from "@/lib/logger";
import {
  executeAdminReadTool,
  getAllowedAdminReadTools,
} from "@/lib/llm/tools/registry";

export async function buildAdminContextBlock(): Promise<string> {
  const context = { chatMode: "admin" as const, profile: "admin" as const };
  const tools = getAllowedAdminReadTools(context);

  const settled = await Promise.allSettled(
    tools.map(async (tool) => executeAdminReadTool(tool, context)),
  );

  const sections: string[] = ["ADMIN LIVE CONTEXT"];
  for (let i = 0; i < settled.length; i += 1) {
    const result = settled[i];
    const tool = tools[i];
    if (!tool) continue;

    if (result?.status === "fulfilled") {
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
