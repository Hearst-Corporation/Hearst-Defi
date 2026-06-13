import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { ProductWorkspaceIntentKind } from "@/lib/llm/product-workspace-intent";

export interface ProductWorkspaceDraft {
  objective?: string;
  vaultTicker: string;
  vaultLabel: string;
  intentKind?: ProductWorkspaceIntentKind;
  scenarioValidationQueued: boolean;
  updatedAtIso: string;
}

const FORM_STATE_KEY = "productWorkspace";

function parseFormState(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

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
  now?: Date;
}): Promise<ProductWorkspaceDraft | null> {
  const draft: ProductWorkspaceDraft = {
    ...(args.objective ? { objective: args.objective } : {}),
    vaultTicker: args.vaultTicker,
    vaultLabel: args.vaultLabel,
    ...(args.intentKind ? { intentKind: args.intentKind } : {}),
    scenarioValidationQueued: args.scenarioValidationQueued,
    updatedAtIso: (args.now ?? new Date()).toISOString(),
  };

  try {
    const existing = await prisma.vaultDraft.findUnique({
      where: { userId: args.userId },
    });
    const merged = {
      ...parseFormState(existing?.formState),
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
