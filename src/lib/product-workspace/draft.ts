import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { ProductWorkspaceIntentKind } from "@/lib/llm/product-workspace-intent";
import { parseFormState } from "./form-state";

export interface ProductWorkspaceDraft {
  objective?: string;
  vaultTicker: string;
  vaultLabel: string;
  intentKind?: ProductWorkspaceIntentKind;
  scenarioValidationQueued: boolean;
  /** Framing brief authored by the cockpit agent for THIS objective. The chat
   *  bubble stays a short fixed acknowledgement; the agent's full reasoning is
   *  routed here and rendered in the workspace instead of the conversation. */
  agentBrief?: string;
  updatedAtIso: string;
}

const FORM_STATE_KEY = "productWorkspace";
/** Hard cap on the persisted brief — bounds the JSON blob in vaultDraft.formState. */
const MAX_AGENT_BRIEF_LEN = 6_000;

function parseStoredDraft(value: unknown): ProductWorkspaceDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.vaultTicker !== "string" || typeof raw.vaultLabel !== "string") {
    return null;
  }
  return {
    ...(typeof raw.objective === "string" ? { objective: raw.objective } : {}),
    vaultTicker: raw.vaultTicker,
    vaultLabel: raw.vaultLabel,
    ...(typeof raw.intentKind === "string"
      ? { intentKind: raw.intentKind as ProductWorkspaceIntentKind }
      : {}),
    ...(typeof raw.agentBrief === "string" && raw.agentBrief.trim().length > 0
      ? { agentBrief: raw.agentBrief }
      : {}),
    scenarioValidationQueued: raw.scenarioValidationQueued === true,
    updatedAtIso:
      typeof raw.updatedAtIso === "string"
        ? raw.updatedAtIso
        : new Date(0).toISOString(),
  };
}

export async function upsertProductWorkspaceDraft(args: {
  userId: string;
  objective?: string;
  vaultTicker: string;
  vaultLabel: string;
  intentKind?: ProductWorkspaceIntentKind;
  scenarioValidationQueued: boolean;
  /** Agent framing brief. When omitted, a brief already persisted for the same
   *  objective is PRESERVED — the page seeds the draft on arrival (no brief yet,
   *  the route writes it after the turn), and a later page render must not wipe
   *  a brief the route added in between. A different objective drops the stale
   *  brief so it never leaks across products. */
  agentBrief?: string;
  now?: Date;
}): Promise<ProductWorkspaceDraft | null> {
  try {
    const existing = await prisma.vaultDraft.findUnique({
      where: { userId: args.userId },
    });
    const existingState = parseFormState(existing?.formState);
    const existingDraft = parseStoredDraft(existingState[FORM_STATE_KEY]);

    // Preserve a previously-stored brief only when this upsert is for the SAME
    // objective and doesn't supply a new one. Otherwise the brief follows the
    // new objective (or is replaced).
    const sameObjective =
      existingDraft?.objective !== undefined &&
      existingDraft.objective === args.objective;
    const resolvedBrief =
      args.agentBrief !== undefined
        ? args.agentBrief.trim().slice(0, MAX_AGENT_BRIEF_LEN)
        : sameObjective
          ? existingDraft?.agentBrief
          : undefined;

    const draft: ProductWorkspaceDraft = {
      ...(args.objective ? { objective: args.objective } : {}),
      vaultTicker: args.vaultTicker,
      vaultLabel: args.vaultLabel,
      ...(args.intentKind ? { intentKind: args.intentKind } : {}),
      ...(resolvedBrief && resolvedBrief.length > 0
        ? { agentBrief: resolvedBrief }
        : {}),
      scenarioValidationQueued: args.scenarioValidationQueued,
      updatedAtIso: (args.now ?? new Date()).toISOString(),
    };

    const merged = {
      ...existingState,
      [FORM_STATE_KEY]: draft,
    };

    await prisma.vaultDraft.upsert({
      where: { userId: args.userId },
      create: {
        userId: args.userId,
        formState: JSON.stringify(merged),
        step: "product-workspace",
      },
      update: {
        formState: JSON.stringify(merged),
        step: existing?.step ?? "product-workspace",
      },
    });
    return draft;
  } catch (err) {
    logger.warn(
      "product-workspace draft persistence failed",
      { userId: args.userId },
      err instanceof Error ? err : undefined,
    );
    return null;
  }
}

export async function loadProductWorkspaceDraft(
  userId: string,
): Promise<ProductWorkspaceDraft | null> {
  try {
    const row = await prisma.vaultDraft.findUnique({
      where: { userId },
    });
    const state = parseFormState(row?.formState);
    return parseStoredDraft(state[FORM_STATE_KEY]);
  } catch (err) {
    logger.warn(
      "product-workspace draft load failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return null;
  }
}
