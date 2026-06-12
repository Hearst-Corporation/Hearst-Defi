import type {
  AdminReadToolExecutionContext,
  AdminToolDefinition,
  AdminWriteToolDefinition,
} from "@/lib/llm/tools/types";

export function isAdminToolAllowed(
  tool: AdminToolDefinition,
  context: AdminReadToolExecutionContext,
): boolean {
  return (
    tool.allowedChatModes.includes(context.chatMode) &&
    tool.allowedProfiles.includes(context.profile)
  );
}

export function isAdminReadToolAllowed(
  tool: AdminToolDefinition,
  context: AdminReadToolExecutionContext,
): boolean {
  return tool.kind === "read" && isAdminToolAllowed(tool, context);
}

export function isAdminWriteToolAllowed(
  tool: AdminWriteToolDefinition,
  context: AdminReadToolExecutionContext,
): boolean {
  return isAdminToolAllowed(tool, context);
}
