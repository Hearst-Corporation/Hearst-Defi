import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import { consumeNav } from "@/lib/llm/nav-channel";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Polled by the client `<ChatNavBridge>` to pick up a pending Master Agent
 * navigation directive for the authenticated user. Read-and-clear (single
 * fire): each pending destination is returned at most once. Scoped to the
 * caller's own channel — no userId is accepted from the request.
 */
export async function GET(): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  try {
    const dest = await consumeNav(userId);
    return NextResponse.json(
      dest
        ? {
            route: dest.route,
            label: dest.label,
            ...(dest.objective ? { objective: dest.objective } : {}),
            ...(dest.autostart ? { autostart: true } : {}),
          }
        : { route: null },
    );
  } catch (err) {
    // A channel hiccup must never break the page — report "nothing pending".
    logger.warn(
      "chat-nav consume failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return NextResponse.json({ route: null });
  }
}
