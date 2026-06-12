import "server-only";

import { createHash } from "node:crypto";

import { captureError } from "./error-tracking";
import { env } from "./env";
import { getRequestContext } from "./request-context";

/**
 * Structured JSON logger.
 *
 * Every log line is a single JSON object so it can be ingested by
 * Datadog, Grafana Loki, or CloudWatch without parsing.
 *
 * Automatically includes `requestId`, `userId`, `runId`, and `jobId`
 * from the async request context when available.
 *
 * Usage:
 *   logger.info("memo generated", { userId: "...", runId: "..." });
 *   logger.error("anthropic failed", { error: err.message }, err);
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  env: string;
  requestId?: string;
  userId?: string;
  runId?: string;
  jobId?: string;
  durationMs?: number;
  errorType?: string;
  errorMessage?: string;
  stack?: string;
  [key: string]: unknown;
}

const SERVICE = "hearst-connect";

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export function hashId(id: string): string {
  return createHash("sha256").update(id).digest("hex").slice(0, 8);
}

function write(level: LogLevel, message: string, context?: LogContext, error?: unknown): void {
  const minLevel = (env.LOG_LEVEL ?? "info") as LogLevel;
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) return;

  const ctx = getRequestContext();

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE,
    message,
    env: process.env.NODE_ENV ?? "unknown",
    ...(ctx?.requestId ? { requestId: ctx.requestId } : {}),
    ...(ctx?.userId ? { userId: ctx.userId } : {}),
    ...(ctx?.runId ? { runId: ctx.runId } : {}),
    ...(ctx?.jobId ? { jobId: ctx.jobId } : {}),
    ...context,
  };

  // PII guard: hash `userId` LAST — AFTER the `...context` spread. Many
  // call-sites pass a raw `{ userId }` in their context, which (object spread
  // is last-wins) would otherwise clobber the request-context value and emit
  // the plaintext id to logs AND Sentry. Hashing here, once, after every
  // possible writer, makes the protection hold regardless of who set it.
  if (typeof entry.userId === "string") {
    entry.userId = hashId(entry.userId);
  }

  if (error instanceof Error) {
    entry.errorType = error.name;
    entry.errorMessage = error.message;
    if (process.env.NODE_ENV !== "production") {
      entry.stack = error.stack;
    }
  }

  const serialized = JSON.stringify(entry);

  // Auto-forward errors to Sentry (no-op when DSN is absent). Forward the
  // ALREADY-HASHED userId (entry.userId), never the raw `context.userId`.
  if (level === "error") {
    captureError(error ?? new Error(message), {
      ...context,
      ...(typeof entry.userId === "string" ? { userId: entry.userId } : {}),
      requestId: ctx?.requestId,
      runId: ctx?.runId,
      jobId: ctx?.jobId,
    });
  }

  switch (level) {
    case "debug":
      console.debug(serialized);
      break;
    case "info":
      console.info(serialized);
      break;
    case "warn":
      console.warn(serialized);
      break;
    case "error":
      console.error(serialized);
      break;
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext, error?: unknown) => write("warn", message, context, error),
  error: (message: string, context?: LogContext, error?: unknown) => write("error", message, context, error),
};
