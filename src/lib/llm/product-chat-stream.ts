import "server-only";

import { VAULTS, VAULT_YIELD, type VaultDefinition } from "@/lib/engine/vaults";
import { classifyProductWorkspaceIntent } from "@/lib/llm/product-workspace-intent";

export const PRODUCT_CHAT_EVENT_PREFIX = "\x00HC_EVENT:";

type ProductChatChartKind = "allocation_stack" | "distribution_range" | "stress_corridor";
type ProductChatChartStatus = "building" | "ready";

interface ProductChatChartSegment {
  label: string;
  value: number;
  color: string;
}

interface ProductChatChartPoint {
  label: string;
  value?: number;
  low?: number;
  high?: number;
}

interface ProductChatChart {
  id: string;
  kind: ProductChatChartKind;
  status: ProductChatChartStatus;
  title: string;
  metric: string;
  note: string;
  provenance: "Estimated";
  progress: number;
  segments?: ProductChatChartSegment[];
  points?: ProductChatChartPoint[];
}

interface ProductChatEvent {
  type: "product_chart";
  chart: ProductChatChart;
}

const BUCKET_LABELS: Record<keyof VaultDefinition["allocationTargets"], string> = {
  mining: "Mining",
  btc_tactical: "BTC tactical",
  usdc_base: "USDC base",
  stable_reserve: "Stable reserve",
};

const ALLOC_COLORS = [
  "var(--ct-accent)",
  "var(--ct-status-info)",
  "var(--ct-status-warning)",
  "var(--ct-text-faint)",
] as const;

export function inferVault(objective: string | undefined): VaultDefinition {
  const lowered = objective?.toLowerCase() ?? "";
  if (/\b(defensive|defensif|défensif|capital preservation|preservation)\b/.test(lowered)) {
    return VAULTS.defensive;
  }
  if (/\b(btc plus|btc-plus|bitcoin plus|hbp|opportunistic|opportuniste)\b/.test(lowered)) {
    return VAULTS["btc-plus"];
  }
  if (/\b(yield|hyv|rendement)\b/.test(lowered)) {
    return VAULTS.yield;
  }
  return VAULT_YIELD;
}

function eventFrame(event: ProductChatEvent): string {
  return `${PRODUCT_CHAT_EVENT_PREFIX}${JSON.stringify(event)}\n`;
}

function allocationChart(vault: VaultDefinition, status: ProductChatChartStatus): ProductChatChart {
  const segments =
    status === "ready"
      ? Object.entries(vault.allocationTargets).map(([bucket, value], index) => ({
          label: BUCKET_LABELS[bucket as keyof VaultDefinition["allocationTargets"]],
          value,
          color: ALLOC_COLORS[index] ?? "var(--ct-accent)",
        }))
      : undefined;
  return {
    id: "capital-stack",
    kind: "allocation_stack",
    status,
    title: "Capital Stack",
    metric: status === "ready" ? `${vault.ticker} target mix` : "Building allocation stack",
    note: "Target weights only; validate bounds and provenance before a vault draft.",
    provenance: "Estimated",
    progress: status === "ready" ? 100 : 35,
    ...(segments ? { segments } : {}),
  };
}

function distributionChart(
  vault: VaultDefinition,
  status: ProductChatChartStatus,
): ProductChatChart {
  const points =
    status === "ready"
      ? Array.from({ length: 6 }, (_, index) => ({
          label: `M${index * 2 + 1}`,
          low: Number((vault.apyTarget.low + index * 0.12).toFixed(2)),
          high: Number((vault.apyTarget.high + index * 0.16).toFixed(2)),
        }))
      : undefined;
  return {
    id: "distribution-path",
    kind: "distribution_range",
    status,
    title: "Distribution Path",
    metric: `${vault.apyTarget.low}-${vault.apyTarget.high}% target APY range`,
    note: "Range only; no single-point yield claim.",
    provenance: "Estimated",
    progress: status === "ready" ? 100 : 60,
    ...(points ? { points } : {}),
  };
}

function stressChart(vault: VaultDefinition): ProductChatChart {
  const reserve = vault.allocationTargets.stable_reserve;
  const mining = vault.allocationTargets.mining;
  return {
    id: "stress-corridor",
    kind: "stress_corridor",
    status: "ready",
    title: "Stress Corridor",
    metric: "PTAI stress corridor",
    note: "Sketches shock, buffer and recovery path before Scenario Lab validation.",
    provenance: "Estimated",
    progress: 100,
    points: [
      { label: "Shock", value: 70 - mining * 0.25 },
      { label: "Buffer", value: 42 + reserve * 0.4 },
      { label: "Recover", value: 58 + reserve * 0.2 },
      { label: "Review", value: 64 + reserve * 0.1 },
    ],
  };
}

function chartsForObjective(objective: string | undefined): ProductChatChart[] {
  const vault = inferVault(objective);
  return [
    allocationChart(vault, "building"),
    allocationChart(vault, "ready"),
    distributionChart(vault, "building"),
    distributionChart(vault, "ready"),
    stressChart(vault),
  ];
}

export function withProductChatStreamEvents(args: {
  stream: ReadableStream<Uint8Array>;
  message: string;
  navProfile: "lp" | "admin";
}): ReadableStream<Uint8Array> {
  const classification = classifyProductWorkspaceIntent(args.message);
  if (args.navProfile !== "admin" || !classification.shouldOpenProductWorkspace) {
    return args.stream;
  }

  const charts = chartsForObjective(classification.objective);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = args.stream.getReader();
  const thresholds = [0, 1, 160, 320, Number.POSITIVE_INFINITY] as const;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let seenChars = 0;
      let nextChartIndex = 0;

      const emitChartsUntil = (threshold: number): void => {
        while (
          nextChartIndex < charts.length &&
          seenChars >= (thresholds[nextChartIndex] ?? threshold)
        ) {
          const chart = charts[nextChartIndex];
          if (chart) {
            controller.enqueue(encoder.encode(eventFrame({ type: "product_chart", chart })));
          }
          nextChartIndex++;
        }
      };

      emitChartsUntil(0);

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            const text = decoder.decode(value, { stream: true });
            seenChars += text.length;
            controller.enqueue(value);
            emitChartsUntil(seenChars);
          }
        }

        seenChars += decoder.decode().length;
        seenChars = Number.POSITIVE_INFINITY;
        emitChartsUntil(seenChars);
      } finally {
        controller.close();
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });
}
