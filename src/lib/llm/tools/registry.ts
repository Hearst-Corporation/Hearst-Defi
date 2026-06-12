import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  VAULT_YIELD,
  VAULT_DEFENSIVE,
  VAULT_BTC_PLUS,
} from "@/lib/engine/vaults";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { getProductRoutes } from "@/lib/product-routes";
import { getSpecIndex } from "@/lib/spec";
import {
  createWriteConfirmation,
  consumeWriteConfirmation,
} from "@/lib/llm/tools/confirmations";
import {
  isAdminReadToolAllowed,
  isAdminWriteToolAllowed,
} from "@/lib/llm/tools/policy";
import { logger } from "@/lib/logger";
import type {
  AdminToolDefinition,
  AdminWriteToolDefinition,
  AdminWriteToolExecutionOptions,
  AdminReadToolDefinition,
  AdminReadToolExecutionContext,
  AdminReadToolResult,
  ExecuteAdminWriteToolRequest,
  ExecuteAdminWriteToolResult,
} from "@/lib/llm/tools/types";

const MAX_ROUTES = 20;
const MAX_SPECS = 12;
const DEFAULT_WRITE_CONFIRMATION_TTL_MS = 5 * 60 * 1000;

const ReviewNoteInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4_000),
  author: z.string().trim().min(1).max(120).optional(),
});

const GovernanceProposalInputSchema = z.object({
  vaultDeploymentId: z.string().trim().min(1).max(120),
  actionType: z.string().trim().min(1).max(80),
  justification: z.string().trim().min(20).max(8_000),
  proposedBy: z.string().trim().min(1).max(120),
  requiredSigners: z.number().int().positive(),
  calldata: z.string().trim().min(1).max(8_000).optional(),
});

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatIso(value: Date | null | undefined): string {
  return value ? value.toISOString() : "unknown";
}

export const ADMIN_READ_TOOLS: readonly AdminReadToolDefinition[] = [
  {
    id: "read_allocations_canonical",
    kind: "read",
    description: "Canonical allocations for all vaults",
    riskLevel: "low",
    confirmationRequired: false,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    resultFormat: "multiline_text_block",
    run: async () => {
      const rows = [
        { key: "HYV", vault: VAULT_YIELD },
        { key: "HDV", vault: VAULT_DEFENSIVE },
        { key: "HBP", vault: VAULT_BTC_PLUS },
      ].map(({ key, vault }) => {
        const a = vault.allocationTargets;
        return `- ${key}: mining ${a.mining}%, btc_tactical ${a.btc_tactical}%, usdc_base ${a.usdc_base}%, stable_reserve ${a.stable_reserve}%`;
      });
      return { title: "ALLOCATIONS CANONIQUES", lines: rows };
    },
  },
  {
    id: "read_market_snapshot",
    kind: "read",
    description: "Latest mining and vault snapshots",
    riskLevel: "low",
    confirmationRequired: false,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    resultFormat: "multiline_text_block",
    run: async () => {
      const [latestMiningMetric, latestVaultSnapshot] = await Promise.all([
        prisma.miningMetric.findFirst({
          orderBy: { takenAt: "desc" },
          select: {
            takenAt: true,
            btcPrice: true,
            hashprice: true,
            difficulty: true,
            energyCost: true,
            uptimePct: true,
            miningMarginScore: true,
          },
        }),
        prisma.vaultSnapshot.findFirst({
          orderBy: { takenAt: "desc" },
          select: {
            takenAt: true,
            aumUsdc: true,
            currentApyLow: true,
            currentApyHigh: true,
            stressedApy: true,
            riskScore: true,
            miningMarginScore: true,
            mode: true,
            source: true,
          },
        }),
      ]);

      const miningLines = latestMiningMetric
        ? [
            "- MARCHE BTC / MINING (latest)",
            `  - taken_at: ${formatIso(latestMiningMetric.takenAt)}`,
            `  - btc_price_usd: ${latestMiningMetric.btcPrice.toString()}`,
            `  - hashprice_usd_th_day: ${latestMiningMetric.hashprice.toString()}`,
            `  - difficulty: ${latestMiningMetric.difficulty.toString()}`,
            `  - energy_cost_usd_kwh: ${latestMiningMetric.energyCost.toString()}`,
            `  - uptime_pct: ${latestMiningMetric.uptimePct.toString()}`,
            `  - mining_margin_score: ${latestMiningMetric.miningMarginScore}`,
          ]
        : [
            "- MARCHE BTC / MINING (latest)",
            "  - unavailable: no MiningMetric row",
          ];

      const snapshotLines = latestVaultSnapshot
        ? [
            "- VAULT SNAPSHOT (latest)",
            `  - taken_at: ${formatIso(latestVaultSnapshot.takenAt)}`,
            `  - aum_usdc: ${latestVaultSnapshot.aumUsdc.toString()}`,
            `  - apy_target_range: ${formatPercent(Number(latestVaultSnapshot.currentApyLow))} to ${formatPercent(Number(latestVaultSnapshot.currentApyHigh))}`,
            `  - stressed_apy_pct: ${formatPercent(Number(latestVaultSnapshot.stressedApy))}`,
            `  - risk_score: ${latestVaultSnapshot.riskScore}`,
            `  - mining_margin_score: ${latestVaultSnapshot.miningMarginScore}`,
            `  - mode: ${latestVaultSnapshot.mode}`,
            `  - source: ${latestVaultSnapshot.source}`,
          ]
        : [
            "- VAULT SNAPSHOT (latest)",
            "  - unavailable: no VaultSnapshot row",
          ];

      return {
        title: "MARKET SNAPSHOT",
        lines: [...miningLines, ...snapshotLines],
      };
    },
  },
  {
    id: "read_routes_index",
    kind: "read",
    description: "Product routes index sample",
    riskLevel: "low",
    confirmationRequired: false,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    resultFormat: "multiline_text_block",
    run: async () => {
      const routes = await getProductRoutes();
      const lines = routes.slice(0, MAX_ROUTES).map((route) => `- ${route}`);
      return {
        title: "ROUTES INDEX (sample)",
        lines: lines.length > 0 ? lines : ["- unavailable: no routes indexed"],
      };
    },
  },
  {
    id: "read_specs_index",
    kind: "read",
    description: "Spec documents index sample",
    riskLevel: "low",
    confirmationRequired: false,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    resultFormat: "multiline_text_block",
    run: async () => {
      const specs = await getSpecIndex();
      const lines = specs
        .slice(0, MAX_SPECS)
        .map((s) => `- ${String(s.order).padStart(2, "0")} · ${s.slug} · ${s.title}`);
      return {
        title: "SPEC INDEX (sample)",
        lines: lines.length > 0 ? lines : ["- unavailable: no specs indexed"],
      };
    },
  },
  {
    id: "read_runtime_capabilities",
    kind: "read",
    description: "Runtime capabilities matrix",
    riskLevel: "low",
    confirmationRequired: false,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    resultFormat: "multiline_text_block",
    run: async () => ({
      title: "CAPACITES OUTILLEES (RUNTIME APP)",
      lines: [
        `- navigation_outillee: ${FEATURE_FLAGS.CHAT_MASTER_AGENT ? "yes" : "no"} (navigate whitelist seulement)`,
        "- internet_live_outille: no",
        "- deploy_execute_outille: no",
        "- db_write_outille: no",
        "- fireblocks_sign_outille: no",
        "- chart_renderer_outille: no",
        "- demo_runner_outille: no",
      ],
    }),
  },
] as const;

export const ADMIN_WRITE_TOOLS: readonly AdminWriteToolDefinition[] = [
  {
    id: "create_review_note_draft",
    kind: "write",
    description: "Create admin review note draft",
    riskLevel: "medium",
    confirmationRequired: true,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    run: async (_context, input) => {
      const payload = parseReviewNoteInput(input);
      const row = await prisma.feedback.create({
        data: {
          message: `[DRAFT][AI_REVIEW_NOTE]\nTitle: ${payload.title}\n${payload.body}`,
          author: payload.author,
          pathname: "/admin",
          resolved: false,
        },
        select: { id: true },
      });
      return {
        title: "REVIEW NOTE DRAFT CREATED",
        lines: [
          `- id: ${row.id}`,
          `- title: ${payload.title}`,
          `- author: ${payload.author ?? "unknown"}`,
          "- persisted_as: Feedback draft row",
        ],
        createdEntityId: row.id,
      };
    },
  },
  {
    id: "create_governance_proposal_draft",
    kind: "write",
    description: "Create governance proposal draft only",
    riskLevel: "high",
    confirmationRequired: true,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    run: async (_context, input) => {
      const payload = parseGovernanceProposalInput(input);
      const row = await prisma.governanceProposal.create({
        data: {
          vaultDeploymentId: payload.vaultDeploymentId,
          actionType: payload.actionType,
          calldata: payload.calldata ?? null,
          justification: payload.justification,
          proposedBy: payload.proposedBy,
          requiredSigners: payload.requiredSigners,
          state: "DRAFT",
        },
        select: { id: true, state: true },
      });
      return {
        title: "GOVERNANCE PROPOSAL DRAFT CREATED",
        lines: [
          `- id: ${row.id}`,
          `- state: ${row.state}`,
          `- action_type: ${payload.actionType}`,
          `- vault_deployment_id: ${payload.vaultDeploymentId}`,
          "- execution: not performed (draft only)",
        ],
        createdEntityId: row.id,
      };
    },
  },
] as const;

export const ADMIN_TOOLS: readonly AdminToolDefinition[] = [
  ...ADMIN_READ_TOOLS,
  ...ADMIN_WRITE_TOOLS,
] as const;

function parseReviewNoteInput(input: unknown): {
  title: string;
  body: string;
  author?: string;
} {
  const parsed = ReviewNoteInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("invalid_create_review_note_draft_input");
  }
  return parsed.data;
}

function parseGovernanceProposalInput(input: unknown): {
  vaultDeploymentId: string;
  actionType: string;
  justification: string;
  proposedBy: string;
  requiredSigners: number;
  calldata?: string;
} {
  const parsed = GovernanceProposalInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("invalid_create_governance_proposal_draft_input");
  }
  return parsed.data;
}

export function getAllowedAdminReadTools(
  context: AdminReadToolExecutionContext,
): AdminReadToolDefinition[] {
  return ADMIN_READ_TOOLS.filter((tool) => isAdminReadToolAllowed(tool, context));
}

export function getAllowedAdminWriteTools(
  context: AdminReadToolExecutionContext,
): AdminWriteToolDefinition[] {
  return ADMIN_WRITE_TOOLS.filter((tool) => isAdminWriteToolAllowed(tool, context));
}

export async function executeAdminReadTool(
  tool: AdminReadToolDefinition,
  context: AdminReadToolExecutionContext,
): Promise<AdminReadToolResult> {
  const result = await tool.run(context);
  return {
    id: tool.id,
    format: tool.resultFormat,
    title: result.title,
    lines: result.lines,
  };
}

export async function executeAdminWriteTool(
  tool: AdminWriteToolDefinition,
  context: AdminReadToolExecutionContext,
  request: ExecuteAdminWriteToolRequest,
  options?: AdminWriteToolExecutionOptions,
): Promise<ExecuteAdminWriteToolResult> {
  if (!isAdminWriteToolAllowed(tool, context)) {
    throw new Error("admin_write_tool_not_allowed");
  }

  const nowMs = options?.nowMs ?? Date.now();
  const ttlMs = options?.ttlMs ?? DEFAULT_WRITE_CONFIRMATION_TTL_MS;

  if (!request.confirmedToken) {
    const confirmation = createWriteConfirmation({
      toolId: tool.id,
      input: request.input,
      ttlMs,
      nowMs,
    });
    return {
      status: "confirmation_required",
      toolId: tool.id,
      confirmation: {
        token: confirmation.token,
        expiresAtIso: new Date(confirmation.expiresAtMs).toISOString(),
        summary: `${tool.id} requires explicit confirmation`,
      },
    };
  }

  const consume = consumeWriteConfirmation({
    token: request.confirmedToken,
    toolId: tool.id,
    input: request.input,
    nowMs,
  });
  if (!consume.ok) {
    logger.warn("admin write confirmation rejected", {
      toolId: tool.id,
      reason: consume.reason,
    });
    throw new Error(`admin_write_confirmation_${consume.reason}`);
  }

  try {
    const result = await tool.run(context, request.input);
    return {
      status: "executed",
      toolId: tool.id,
      result,
    };
  } catch (error) {
    logger.error(
      "admin write tool execution failed",
      { toolId: tool.id },
      error instanceof Error ? error : undefined,
    );
    throw error;
  }
}
