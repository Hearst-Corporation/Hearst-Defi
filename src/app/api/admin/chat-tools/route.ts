import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import {
  ADMIN_READ_TOOL_IDS,
  ADMIN_WRITE_TOOL_IDS,
  executeAdminReadTool,
  executeAdminWriteTool,
  getAllowedAdminReadTools,
  getAllowedAdminWriteTools,
  type AdminReadToolExecutionContext,
} from "@/lib/llm/tools";
import { assertBodySize } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ExecuteReadSchema = z.object({
  action: z.literal("execute_read"),
  toolId: z.enum(ADMIN_READ_TOOL_IDS),
  input: z.unknown().optional(),
});

const ExecuteWriteSchema = z.object({
  action: z.literal("execute_write"),
  toolId: z.enum(ADMIN_WRITE_TOOL_IDS),
  input: z.unknown(),
  confirmedToken: z.string().trim().min(1).max(200).optional(),
});

const AdminToolsRequestSchema = z.discriminatedUnion("action", [
  ExecuteReadSchema,
  ExecuteWriteSchema,
]);

function toAdminContext(): AdminReadToolExecutionContext {
  return { chatMode: "admin", profile: "admin" };
}

async function requireAdminUser(): Promise<string> {
  const auth = await requireAdmin();
  return auth.userId;
}

function adminError(err: unknown): NextResponse<{ error: string }> {
  const message = err instanceof Error ? err.message : "Admin access required";
  const isAuthRequired = message.toLowerCase().includes("authentication required");
  return NextResponse.json(
    { error: message },
    { status: isAuthRequired ? 401 : 403 },
  );
}

function mapWriteConfirmationError(
  toolId: string,
  err: Error,
): NextResponse<{ error: string; code: string }> | null {
  const message = err.message;
  if (!message.startsWith("admin_write_confirmation_")) return null;

  const reason = message.replace("admin_write_confirmation_", "");
  const status = reason === "expired" ? 410 : 409;
  logger.warn("admin chat tool confirmation denied", { toolId, reason });
  return NextResponse.json(
    { error: "Write confirmation rejected", code: reason },
    { status },
  );
}

export async function GET(): Promise<
  NextResponse<
    | {
        readTools: Array<{
          id: string;
          kind: "read";
          description: string;
          riskLevel: "low" | "medium" | "high";
          confirmationRequired: false;
          parameters: unknown;
        }>;
        writeTools: Array<{
          id: string;
          kind: "write";
          description: string;
          riskLevel: "low" | "medium" | "high";
          confirmationRequired: true;
        }>;
      }
    | { error: string }
  >
> {
  try {
    await requireAdminUser();
  } catch (err) {
    return adminError(err);
  }

  const context = toAdminContext();
  const readTools = getAllowedAdminReadTools(context).map((tool) => ({
    id: tool.id,
    kind: tool.kind,
    description: tool.description,
    riskLevel: tool.riskLevel,
    confirmationRequired: tool.confirmationRequired,
    parameters: tool.parameters,
  }));
  const writeTools = getAllowedAdminWriteTools(context).map((tool) => ({
    id: tool.id,
    kind: tool.kind,
    description: tool.description,
    riskLevel: tool.riskLevel,
    confirmationRequired: tool.confirmationRequired,
  }));

  return NextResponse.json({ readTools, writeTools });
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<object>> {
  let userId: string;
  try {
    userId = await requireAdminUser();
  } catch (err) {
    return adminError(err);
  }

  try {
    await assertBodySize(request);
  } catch {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AdminToolsRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const context = toAdminContext();
  const payload = parsed.data;

  if (payload.action === "execute_read") {
    const tool = getAllowedAdminReadTools(context).find(
      (candidate) => candidate.id === payload.toolId,
    );
    if (!tool) {
      logger.warn("admin chat read tool denied", {
        userId,
        toolId: payload.toolId,
      });
      return NextResponse.json({ error: "Tool not allowed" }, { status: 403 });
    }

    try {
      const result = await executeAdminReadTool(tool, context, payload.input);
      return NextResponse.json({ status: "executed", toolId: tool.id, result });
    } catch (err) {
      logger.error(
        "admin chat read tool failed",
        { userId, toolId: tool.id },
        err instanceof Error ? err : undefined,
      );
      return NextResponse.json({ error: "Read tool execution failed" }, { status: 500 });
    }
  }

  const writeTool = getAllowedAdminWriteTools(context).find(
    (candidate) => candidate.id === payload.toolId,
  );
  if (!writeTool) {
    logger.warn("admin chat write tool denied", {
      userId,
      toolId: payload.toolId,
    });
    return NextResponse.json({ error: "Tool not allowed" }, { status: 403 });
  }

  try {
    const result = await executeAdminWriteTool(
      writeTool,
      context,
      { input: payload.input, confirmedToken: payload.confirmedToken },
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error) {
      const confirmationError = mapWriteConfirmationError(writeTool.id, err);
      if (confirmationError) return confirmationError;
      if (err.message.startsWith("invalid_")) {
        logger.warn("admin chat write tool input invalid", {
          userId,
          toolId: writeTool.id,
        });
        return NextResponse.json({ error: "Invalid write input" }, { status: 400 });
      }
      if (err.message === "admin_write_tool_not_allowed") {
        logger.warn("admin chat write tool not allowed", {
          userId,
          toolId: writeTool.id,
        });
        return NextResponse.json({ error: "Tool not allowed" }, { status: 403 });
      }
    }

    logger.error(
      "admin chat write tool failed",
      { userId, toolId: writeTool.id },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ error: "Write tool execution failed" }, { status: 500 });
  }
}
