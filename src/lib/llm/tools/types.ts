import type { ChatMode } from "@/lib/llm/chat-modes";
import type { NavProfile } from "@/lib/llm/navigate-tool";

export const ADMIN_READ_TOOL_IDS = [
  "read_allocations_canonical",
  "read_market_snapshot",
  "read_routes_index",
  "read_specs_index",
  "read_runtime_capabilities",
  "generate_chart_spec",
  "generate_demo_plan",
  "export_demo_pack",
  "export_briefing_pack",
] as const;

export type AdminReadToolId = (typeof ADMIN_READ_TOOL_IDS)[number];

export const ADMIN_WRITE_TOOL_IDS = [
  "create_review_note_draft",
  "create_governance_proposal_draft",
] as const;

export type AdminWriteToolId = (typeof ADMIN_WRITE_TOOL_IDS)[number];
export type AdminToolId = AdminReadToolId | AdminWriteToolId;

export const ADMIN_TOOL_RISK_LEVELS = ["low", "medium", "high"] as const;
export type AdminToolRiskLevel = (typeof ADMIN_TOOL_RISK_LEVELS)[number];

export type AdminToolScopeProfile = NavProfile;

export const ADMIN_TOOL_RESULT_FORMATS = [
  "multiline_text_block",
  "json_object",
] as const;
export type AdminToolResultFormat = (typeof ADMIN_TOOL_RESULT_FORMATS)[number];
export type AdminToolKind = "read" | "write";

export interface AdminReadToolParametersSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: readonly string[];
  additionalProperties?: boolean;
}

export interface AdminReadToolExecutionContext {
  chatMode: ChatMode;
  profile: AdminToolScopeProfile;
}

export const ADMIN_TOOL_TELEMETRY_STATUSES = [
  "success",
  "blocked",
  "failed",
  "confirmation_required",
] as const;
export type AdminToolTelemetryStatus =
  (typeof ADMIN_TOOL_TELEMETRY_STATUSES)[number];

export interface AdminReadToolExecutionOptions {
  userId?: string;
}

export interface AdminReadToolResult {
  id: AdminReadToolId;
  title: string;
  lines: string[];
  format: AdminToolResultFormat;
  payload?: Record<string, unknown>;
}

interface AdminBaseToolDefinition<TId extends AdminToolId, TKind extends AdminToolKind> {
  id: TId;
  kind: TKind;
  description: string;
  riskLevel: AdminToolRiskLevel;
  confirmationRequired: boolean;
  allowedChatModes: readonly ChatMode[];
  allowedProfiles: readonly AdminToolScopeProfile[];
}

export interface AdminReadToolDefinition
  extends AdminBaseToolDefinition<AdminReadToolId, "read"> {
  confirmationRequired: false;
  resultFormat: AdminToolResultFormat;
  parameters: AdminReadToolParametersSchema;
  run: (
    context: AdminReadToolExecutionContext,
    input?: unknown,
  ) => Promise<Omit<AdminReadToolResult, "id" | "format">>;
}

export interface AdminWriteToolExecutionResult {
  title: string;
  lines: string[];
  createdEntityId: string;
}

export interface AdminWriteToolDefinition
  extends AdminBaseToolDefinition<AdminWriteToolId, "write"> {
  confirmationRequired: true;
  run: (
    context: AdminReadToolExecutionContext,
    input: unknown,
  ) => Promise<AdminWriteToolExecutionResult>;
}

export interface AdminToolConfirmation {
  token: string;
  expiresAtIso: string;
  summary: string;
}

export interface ExecuteAdminWriteToolRequest {
  input: unknown;
  confirmedToken?: string;
}

export type ExecuteAdminWriteToolResult =
  | {
      status: "confirmation_required";
      toolId: AdminWriteToolId;
      confirmation: AdminToolConfirmation;
    }
  | {
      status: "executed";
      toolId: AdminWriteToolId;
      result: AdminWriteToolExecutionResult;
    };

export type AdminToolDefinition = AdminReadToolDefinition | AdminWriteToolDefinition;

export interface AdminWriteToolExecutionOptions {
  nowMs?: number;
  ttlMs?: number;
  userId?: string;
}
