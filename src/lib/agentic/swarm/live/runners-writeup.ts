import "server-only";

/**
 * Live-read swarm runner — F · writeup (server-only, LLM).
 *
 * Composes a long-form institutional framing brief from the numeric artifacts.
 * The prose is authored by the LLM (GPT-4.1) and then PASSED THROUGH the output
 * compliance checks (forbidden words + APY-always-a-range) before it is allowed
 * out; a non-compliant or unavailable LLM result falls back to the deterministic
 * write-up so a brief always exists. Draft text only — nothing is created, sent,
 * or deployed.
 *
 * Note on `LlmRun`: `callLlm` records a billing/telemetry `LlmRun` row (standard
 * cost tracking for any model call). That is NOT a business/custodial write — no
 * vault, draft, email, or projection run is persisted by this stage.
 */

import { callLlm } from "@/lib/llm/client";
import { LLM_MODEL } from "@/lib/llm/openai";
import { containsForbidden } from "@/lib/agents/forbidden-words";
import { hasSinglePointApy } from "@/lib/agents/apy-range";
import { logger } from "@/lib/logger";

import { buildDeterministicWriteup } from "./runners-artifacts";
import type {
  LiveSwarmStepAudit,
  QuantArtifact,
  StrategyCrossArtifact,
  WriteupArtifact,
} from "./types";

const MAX_PROSE_TOKENS = 900;

function buildWriteupSystemPrompt(): string {
  return [
    "Tu es le copilote produit interne de Hearst Connect (équipe admin). Tu rédiges un BRIEF DE CADRAGE long, institutionnel et sobre, pour un nouveau produit/vault, à partir de chiffres DÉJÀ CALCULÉS qu'on te fournit.",
    "",
    "# Règles dures (non négociables)",
    "- N'invente AUCUN chiffre. Utilise UNIQUEMENT les valeurs fournies.",
    "- APY TOUJOURS en fourchette (jamais un point unique). Reprends la fourchette fournie.",
    "- Mots interdits: « garantie », « promesse », « certain », « sans risque », « risk-free », « guarantee », « will deliver ». Utilise « cible », « projection conditionnelle », « fourchette cible ».",
    "- Toute projection est conditionnelle aux hypothèses, sans engagement de résultat.",
    "- Rien n'est créé/déployé: cadrage + documentation seulement.",
    "- Prose riche et structurée (titres ##, listes), française, institutionnelle. Pas de méta-IA, pas de salutations.",
    "- Termine par une note explicite « non garanti » et les hypothèses.",
  ].join("\n");
}

function buildWriteupUserPrompt(args: {
  objective: string;
  vaultLabel: string;
  strategy: StrategyCrossArtifact;
  quant: QuantArtifact;
  market: { btcUsd: number; hashpriceUsdPerThDay: number };
}): string {
  const { objective, vaultLabel, strategy, quant, market } = args;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return [
    `Vault: ${vaultLabel}`,
    `Objectif: ${objective}`,
    "",
    "Chiffres calculés (à reprendre tels quels, fourchettes incluses):",
    `- BTC spot: $${Math.round(market.btcUsd).toLocaleString("en-US")}`,
    `- Hashprice: $${market.hashpriceUsdPerThDay.toFixed(3)}/TH/jour`,
    `- APY headline (fourchette): ${r1(quant.headlineRange.low * 100)}–${r1(quant.headlineRange.high * 100)}%`,
    `- Monte-Carlo p5/p50/p95: ${r1(quant.percentiles.p5 * 100)}% / ${r1(quant.percentiles.p50 * 100)}% / ${r1(quant.percentiles.p95 * 100)}% (seed ${quant.seed}, ${quant.paths} chemins, ${quant.horizonMonths} mois)`,
    `- P(sous le plancher ${quant.floorApyPct}%): ${quant.probBelowFloorPct}%`,
    `- Rendement mining: ${r1(strategy.miningYieldPct)}% · USDC: ${r1(strategy.usdcYieldPct)}% (source ${strategy.usdcSource})`,
    `- Leviers entreprise: markup ${strategy.companyLevers.markupPct}%, revenue-share ${strategy.companyLevers.revenueSharePct}%, énergie $${strategy.companyLevers.energyCostUsdPerKwh}/kWh, frais ${strategy.companyLevers.feePct}%`,
    "",
    "Hypothèses à intégrer:",
    ...strategy.assumptions.map((a) => `- ${a}`),
    "",
    "Rédige le brief de cadrage complet maintenant.",
  ].join("\n");
}

/** True when the prose passes the same compliance bar as any human-facing text. */
function proseIsCompliant(text: string): boolean {
  if (containsForbidden(text) !== null) return false;
  // `final = true`: judge the completed text; a single-point APY is non-compliant.
  if (hasSinglePointApy(text, true)) return false;
  return true;
}

export async function runWriteup(args: {
  objective: string;
  vaultLabel: string;
  strategy: StrategyCrossArtifact;
  quant: QuantArtifact;
  market: { btcUsd: number; hashpriceUsdPerThDay: number };
}): Promise<{ artifact: WriteupArtifact; audit: LiveSwarmStepAudit }> {
  const fallback = buildDeterministicWriteup(args);

  try {
    const result = await callLlm("product-construction-writeup", {
      model: LLM_MODEL,
      max_tokens: MAX_PROSE_TOKENS,
      system: buildWriteupSystemPrompt(),
      messages: [{ role: "user", content: buildWriteupUserPrompt(args) }],
    });
    const text = result.response.content
      .map((b) => b.text)
      .join("")
      .trim();

    if (text.length > 0 && proseIsCompliant(text)) {
      return {
        artifact: {
          title: fallback.title,
          prose: text,
          llmAuthored: true,
          provenance: args.strategy.provenance,
        },
        audit: {
          stageId: "writeup",
          mode: "live_read",
          ok: true,
          reasonCode: "writeup_llm_ok",
          provenance: args.strategy.provenance,
          degraded: false,
        },
      };
    }
    // LLM produced empty or non-compliant prose → use the safe deterministic one.
    logger.warn("[live-swarm] writeup LLM non-compliant — using fallback", {
      empty: text.length === 0,
    });
  } catch (err) {
    logger.warn(
      "[live-swarm] writeup LLM unavailable — using fallback",
      {},
      err instanceof Error ? err : undefined,
    );
  }

  return {
    artifact: fallback,
    audit: {
      stageId: "writeup",
      mode: "live_read",
      ok: true,
      reasonCode: "writeup_deterministic_fallback",
      provenance: args.strategy.provenance,
      degraded: false,
    },
  };
}
