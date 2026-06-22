import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import { createTurnId } from "@/lib/trace-ids";

/**
 * Request-scoped context for tracing and logging.
 *
 * Propagates a `requestId` (and optionally `userId`, `runId`) through the
 * async call stack without passing it manually to every function.
 *
 * Usage in a Server Component / Server Action:
 *   import { withRequestContext, getRequestContext } from "@/lib/request-context";
 *   import { headers } from "next/headers";
 *
 *   export default async function Page() {
 *     const h = await headers();
 *     const requestId = h.get("x-request-id") ?? crypto.randomUUID();
 *     return withRequestContext({ requestId }, async () => {
 *       // Everything inside here can call getRequestContext()
 *       const data = await loadData();
 *       return <View data={data} />;
 *     });
 *   }
 *
 * The logger automatically reads the current context and includes
 * `requestId`, `userId`, and `runId` in every log entry.
 */

export interface RequestContext {
  requestId: string;
  userId?: string;
  runId?: string;
  jobId?: string;
}

interface CreateRequestContextArgs {
  requestId?: string | null;
  userId?: string;
  runId?: string;
  jobId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export function createRequestContext(
  args: CreateRequestContextArgs = {},
): RequestContext {
  return {
    requestId: args.requestId ?? randomUUID(),
    ...(args.userId ? { userId: args.userId } : {}),
    runId: args.runId ?? createTurnId(),
    ...(args.jobId ? { jobId: args.jobId } : {}),
  };
}

/**
 * Runs the given function inside a request context.
 */
export function withRequestContext<T>(
  ctx: RequestContext,
  fn: () => T | Promise<T>,
): T | Promise<T> {
  return asyncLocalStorage.run(ctx, fn);
}

/**
 * Returns the current request context, or null if outside a context.
 */
export function getRequestContext(): RequestContext | null {
  return asyncLocalStorage.getStore() ?? null;
}

/**
 * Sets the request context for the current async execution scope.
 * Unlike `withRequestContext`, this does NOT create a new scope — it mutates
 * the current one. Use this in Server Actions where you want downstream
 * logging to include requestId/userId without wrapping the entire action body.
 */
export function enterRequestContext(ctx: RequestContext): void {
  asyncLocalStorage.enterWith(ctx);
}
