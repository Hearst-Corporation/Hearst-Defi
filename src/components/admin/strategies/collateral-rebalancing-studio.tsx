"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AdminSectionCard } from "@/components/admin/admin-page-shell";
import { BentoKpiStrip } from "@/components/catalyst/bento";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { Input } from "@/components/catalyst/input";
import { Metric } from "@/components/catalyst/metric";
import {
  SegmentedControl,
  type SegmentedItem,
} from "@/components/catalyst/segmented-control";
import type { CollateralConfig, RebalancingRule } from "@/lib/scenario-runner";
import {
  optimizeCollateralStrategy,
  summarizeCollateralOptimization,
  toCollateralStudioViewModel,
  validateCollateralInput,
  type CollateralOptimizationSummary,
  type CollateralRebalancingInput,
} from "@/lib/strategy-data-lab";
import { CollateralBuybackLadder } from "@/components/admin/strategies/collateral-buyback-ladder";
import { CollateralSellLadder } from "@/components/admin/strategies/collateral-sell-ladder";
import { CollateralTimeline } from "@/components/admin/strategies/collateral-timeline";
import {
  COLLATERAL_PATH_PRESET_OPTIONS,
  applyCollateralPathPreset,
  buildCollateralOptimizerSearchConfig,
  buildCollateralStudioInitialInput,
  flattenCollateralValidationMessages,
  type CollateralPathPresetId,
} from "@/components/admin/strategies/collateral-rebalancing-studio.helpers";

const COLLATERAL_STUDIO_SECTION_ID = "collateral-rebalancing-studio";

type ControlField =
  | "investmentUsdc"
  | "btcSpotPriceUsd"
  | "openingLtvPct"
  | "liquidationLtvPct"
  | "deRiskTriggerLtvPct"
  | "postSellTargetLtvPct"
  | "reRiskTriggerDistancePct"
  | "maxLtvAfterBuyPct"
  | "minimumReserveUsdc"
  | "repayRatioPct"
  | "sellStepPctOfCollateral"
  | "buyStepPctOfReserve"
  | "buySpacingPct"
  | "borrowAprPct"
  | "usdcReserveYieldPct"
  | "wbtcYieldPct"
  | "miningYieldPct"
  | "electricityMonthlyUsdc"
  | "timelineMonths"
  | "miningAllocationPct"
  | "btcAllocationPct"
  | "usdcAllocationPct";

const PATH_PRESET_ITEMS: ReadonlyArray<SegmentedItem<CollateralPathPresetId>> =
  COLLATERAL_PATH_PRESET_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));

function usd(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function usdCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${Math.round(value / 1_000)}k`;
  }
  return usd(value);
}

function pct(value: number, digits: number = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function pctInputValue(value: number): string {
  return (value * 100).toFixed(1);
}

function btc(value: number): string {
  return `${value.toFixed(3)} BTC`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseInputNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nextNumericInput(
  current: CollateralRebalancingInput,
  field: ControlField,
  value: string,
): CollateralRebalancingInput {
  const raw = parseInputNumber(value);
  const next = { ...current };

  if (
    field === "openingLtvPct" ||
    field === "liquidationLtvPct" ||
    field === "deRiskTriggerLtvPct" ||
    field === "postSellTargetLtvPct" ||
    field === "reRiskTriggerDistancePct" ||
    field === "maxLtvAfterBuyPct" ||
    field === "repayRatioPct" ||
    field === "sellStepPctOfCollateral" ||
    field === "buyStepPctOfReserve" ||
    field === "buySpacingPct" ||
    field === "borrowAprPct" ||
    field === "usdcReserveYieldPct" ||
    field === "wbtcYieldPct" ||
    field === "miningYieldPct" ||
    field === "miningAllocationPct" ||
    field === "btcAllocationPct" ||
    field === "usdcAllocationPct"
  ) {
    next[field] = Math.max(0, raw) / 100;
    return next;
  }

  if (field === "timelineMonths") {
    next.timelineMonths = Math.max(1, Math.round(raw));
    return next;
  }

  next[field] = Math.max(0, raw);
  return next;
}

function determineRiskZoneLabel(summary: CollateralOptimizationSummary): string {
  const ltv = summary.base.currentLtvPct;
  const liquidationLtv = summary.timeline[0]?.ltvPct ?? summary.base.currentLtvPct;
  void liquidationLtv;
  if (ltv >= 0.8) return "Liquidation risk";
  if (ltv >= 0.45) return "De-risk zone";
  if (summary.base.distanceToLiquidationPct >= 0.45) return "Safe";
  return "Watch";
}

function buildPriceRailContext(
  input: CollateralRebalancingInput,
  summary: CollateralOptimizationSummary,
): {
  liquidationPriceUsd: number;
  firstSellTriggerUsd: number | null;
  distanceSafePriceUsd: number | null;
  buybackExecutionTriggerUsd: number | null;
} {
  const firstSell = summary.sellLadder[0] ?? null;
  const firstFeasibleSell =
    summary.sellLadder.find((step) => step.feasible) ?? firstSell;
  const debtAfterSell = firstFeasibleSell?.debtAfterUsdc ?? summary.base.debtUsdc;
  const collateralAfterSell =
    firstFeasibleSell?.wbtcCollateralAfter ?? summary.base.wbtcCollateralAmount;
  const safeLtv = input.liquidationLtvPct - input.reRiskTriggerDistancePct;
  const distanceSafePriceUsd =
    debtAfterSell > 0 && collateralAfterSell > 0 && safeLtv > 0
      ? debtAfterSell / (collateralAfterSell * safeLtv)
      : null;
  return {
    liquidationPriceUsd: summary.base.liquidationPriceUsd,
    firstSellTriggerUsd: firstSell?.triggerPriceUsd ?? null,
    distanceSafePriceUsd,
    buybackExecutionTriggerUsd: summary.buybackLadder[0]?.triggerPriceUsd ?? null,
  };
}

function renderLtvGauge(
  input: CollateralRebalancingInput,
  summary: CollateralOptimizationSummary,
): ReactNode {
  const currentPct = summary.base.currentLtvPct;
  const watchStart = clamp(
    input.liquidationLtvPct - input.reRiskTriggerDistancePct,
    0,
    input.deRiskTriggerLtvPct,
  );
  const size = 240;
  const stroke = 16;
  const radius = 84;
  const cx = 120;
  const cy = 126;
  const angleOf = (value: number) => Math.PI * (1 + value);
  const pointAt = (value: number, r: number) => ({
    x: cx + r * Math.cos(angleOf(value)),
    y: cy + r * Math.sin(angleOf(value)),
  });
  const arcPath = (from: number, to: number) => {
    const start = pointAt(from, radius);
    const end = pointAt(to, radius);
    const largeArc = to - from > 0.5 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  };
  const needle = pointAt(clamp(currentPct, 0, 1), radius - 10);

  return (
    <svg viewBox={`0 0 ${size} ${size - 12}`} className="w-full" aria-label="LTV gauge">
      <path
        d={arcPath(0, watchStart)}
        fill="none"
        stroke="var(--ct-accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <path
        d={arcPath(watchStart, input.deRiskTriggerLtvPct)}
        fill="none"
        stroke="var(--ct-status-warning)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <path
        d={arcPath(input.deRiskTriggerLtvPct, input.liquidationLtvPct)}
        fill="none"
        stroke="var(--ct-status-danger)"
        strokeWidth={stroke}
        strokeLinecap="round"
        opacity={0.7}
      />
      <path
        d={arcPath(input.liquidationLtvPct, 1)}
        fill="none"
        stroke="var(--ct-status-danger)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <line
        x1={cx}
        y1={cy}
        x2={needle.x}
        y2={needle.y}
        stroke="var(--ct-text-strong)"
        strokeWidth={2}
      />
      <circle cx={cx} cy={cy} r={5} fill="var(--ct-text-strong)" />
      <text
        x={cx}
        y={70}
        textAnchor="middle"
        fontSize="12"
        fill="var(--ct-text-muted)"
      >
        Current LTV
      </text>
      <text
        x={cx}
        y={92}
        textAnchor="middle"
        fontSize="26"
        fontWeight="700"
        fill="var(--ct-text-strong)"
      >
        {pct(currentPct)}
      </text>
      <text
        x={cx}
        y={108}
        textAnchor="middle"
        fontSize="11"
        fill="var(--ct-text-tertiary)"
      >
        {determineRiskZoneLabel(summary)}
      </text>
      <text x={20} y={154} fontSize="10" fill="var(--ct-status-warning)">
        De-risk {pct(input.deRiskTriggerLtvPct, 0)}
      </text>
      <text x={146} y={154} fontSize="10" fill="var(--ct-status-danger)">
        Liq. {pct(input.liquidationLtvPct, 0)}
      </text>
    </svg>
  );
}

function renderPriceRail(
  input: CollateralRebalancingInput,
  summary: CollateralOptimizationSummary,
): ReactNode {
  const rail = buildPriceRailContext(input, summary);
  const items = [
    {
      key: "spot",
      label: "Spot",
      value: input.btcSpotPriceUsd,
      tone: "var(--ct-text-strong)",
    },
    {
      key: "sell",
      label: "First sell",
      value: rail.firstSellTriggerUsd,
      tone: "var(--ct-status-danger)",
    },
    {
      key: "safe",
      label: "Distance-safe",
      value: rail.distanceSafePriceUsd,
      tone: "var(--ct-status-warning)",
    },
    {
      key: "buy",
      label: "First buyback",
      value: rail.buybackExecutionTriggerUsd,
      tone: "var(--ct-accent)",
    },
    {
      key: "liq",
      label: "Liquidation",
      value: rail.liquidationPriceUsd,
      tone: "var(--ct-status-danger)",
    },
  ].filter((item) => item.value != null) as Array<{
    key: string;
    label: string;
    value: number;
    tone: string;
  }>;

  const maxValue = Math.max(...items.map((item) => item.value)) * 1.05;
  const minValue = Math.min(...items.map((item) => item.value)) * 0.9;
  const yFor = (value: number) => {
    const span = maxValue - minValue || 1;
    return 18 + (1 - (value - minValue) / span) * 220;
  };

  return (
    <svg viewBox="0 0 240 260" className="w-full" aria-label="Price rail">
      <line
        x1="120"
        y1="18"
        x2="120"
        y2="238"
        stroke="var(--ct-border-soft)"
        strokeWidth="1"
      />
      {items.map((item, index) => {
        const y = yFor(item.value);
        const right = index % 2 === 0;
        return (
          <g key={item.key}>
            <circle cx="120" cy={y} r="4" fill={item.tone} />
            <line
              x1="120"
              y1={y}
              x2={right ? 184 : 56}
              y2={y}
              stroke={item.tone}
              strokeWidth="1"
              opacity="0.7"
            />
            <text
              x={right ? 188 : 52}
              y={y - 4}
              textAnchor={right ? "start" : "end"}
              fontSize="10"
              fill={item.tone}
            >
              {item.label}
            </text>
            <text
              x={right ? 188 : 52}
              y={y + 10}
              textAnchor={right ? "start" : "end"}
              fontSize="10"
              fill="var(--ct-text-tertiary)"
            >
              {usd(item.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function buildHeaderActions(
  onReset: () => void,
  onCopyConfig: () => void,
  extraActions?: ReactNode,
): ReactNode {
  return (
    <div className="flex flex-wrap items-center justify-end gap-(--ct-space-2)">
      <CockpitButton variant="ghost" size="sm" onClick={onReset}>
        Reset defaults
      </CockpitButton>
      <CockpitButton variant="secondary" size="sm" onClick={onCopyConfig}>
        Copy config JSON
      </CockpitButton>
      {extraActions}
    </div>
  );
}

export function CollateralRebalancingStudio({
  strategyName,
  statusLabel,
  collateral,
  rules,
  initialBtcSpotPriceUsd,
  headerActions,
  initialAdvancedOpen = false,
  initialScrollToStudio = false,
}: {
  strategyName: string;
  statusLabel: string;
  collateral: CollateralConfig;
  rules: readonly RebalancingRule[];
  initialBtcSpotPriceUsd?: number;
  headerActions?: ReactNode;
  initialAdvancedOpen?: boolean;
  initialScrollToStudio?: boolean;
}) {
  const defaults = useMemo(
    () =>
      buildCollateralStudioInitialInput(
        collateral,
        rules,
        initialBtcSpotPriceUsd,
      ),
    [collateral, rules, initialBtcSpotPriceUsd],
  );
  const [pathPreset, setPathPreset] = useState<CollateralPathPresetId>(
    defaults.preset,
  );
  const [draftInput, setDraftInput] = useState<CollateralRebalancingInput>(
    defaults.input,
  );

  useEffect(() => {
    if (!initialScrollToStudio || typeof document === "undefined") return;
    document.getElementById(COLLATERAL_STUDIO_SECTION_ID)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [initialScrollToStudio]);

  const validation = useMemo(
    () => validateCollateralInput(draftInput),
    [draftInput],
  );
  const summary = useMemo(
    () =>
      validation.isValid
        ? summarizeCollateralOptimization(validation.normalizedInput)
        : null,
    [validation],
  );
  const studioViewModel = useMemo(
    () => (summary ? toCollateralStudioViewModel(summary) : null),
    [summary],
  );
  const optimizerResult = useMemo(() => {
    if (!validation.isValid) return null;
    return optimizeCollateralStrategy(
      validation.normalizedInput,
      buildCollateralOptimizerSearchConfig(validation.normalizedInput),
    );
  }, [validation]);

  const warnings = [
    ...flattenCollateralValidationMessages(validation),
    ...(studioViewModel?.warnings ?? []),
  ];

  const handlePathPresetChange = (preset: CollateralPathPresetId) => {
    setPathPreset(preset);
    setDraftInput((current) => applyCollateralPathPreset(current, preset));
  };

  const handleFieldChange = (field: ControlField, value: string) => {
    setDraftInput((current) =>
      applyCollateralPathPreset(nextNumericInput(current, field, value), pathPreset),
    );
  };

  const handleReset = () => {
    setPathPreset(defaults.preset);
    setDraftInput(defaults.input);
  };

  const handleCopyConfig = () => {
    const payload = {
      pathPreset,
      input: draftInput,
      validation: {
        isValid: validation.isValid,
        warnings: validation.warnings,
        errors: validation.errors,
      },
    };
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  const firstSellStep = summary?.sellLadder[0] ?? null;
  const firstBuybackStep = summary?.buybackLadder[0] ?? null;
  const topSummaryItems =
    summary == null
      ? []
      : [
          {
            label: "Invested USDC",
            value: usd(summary.base.investmentUsdc),
            accent: true,
          },
          {
            label: "Mining allocation",
            value: `${pct(summary.base.miningAllocatedUsdc / summary.base.investmentUsdc, 0)} · ${usdCompact(summary.base.miningAllocatedUsdc)}`,
          },
          {
            label: "wBTC bought",
            value: btc(summary.base.wbtcCollateralAmount),
          },
          {
            label: "USDC borrowed",
            value: usdCompact(summary.base.debtUsdc),
          },
          {
            label: "Working USDC reserve",
            value: usdCompact(summary.base.workingReserveUsdc),
          },
          {
            label: "Current LTV",
            value: pct(summary.base.currentLtvPct),
          },
          {
            label: "First sell trigger",
            value: firstSellStep ? usd(firstSellStep.triggerPriceUsd) : "—",
          },
          {
            label: "First buyback trigger",
            value: firstBuybackStep ? usd(firstBuybackStep.triggerPriceUsd) : "—",
          },
          {
            label: "Liquidation price",
            value: usd(summary.base.liquidationPriceUsd),
          },
        ];

  const buybackContext = summary ? buildPriceRailContext(validation.normalizedInput, summary) : null;

  return (
    <div
      id={COLLATERAL_STUDIO_SECTION_ID}
      className="flex min-w-0 flex-col gap-(--ct-space-5) scroll-mt-24"
    >
      <AdminSectionCard
        title="Collateral Rebalancing Studio"
        subtitle={`${strategyName} · ${statusLabel} — USDC-funded collateral rebalancing · local draft only in Phase 2`}
        headerTrailing={buildHeaderActions(handleReset, handleCopyConfig, headerActions)}
      >
        <div className="flex flex-col gap-(--ct-space-4)">
          {topSummaryItems.length > 0 ? (
            <BentoKpiStrip
              ariaLabel="Top decision summary"
              items={topSummaryItems}
              title="Top Decision Summary"
              subtitle="Understand the full USDC-funded collateral loop in one pass: where the cash goes, how much wBTC is posted, how much USDC is borrowed, and where the first sell / buyback / liquidation thresholds sit."
            />
          ) : null}

          <div className="grid gap-(--ct-space-4) px-5 pb-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] lg:px-6 lg:pb-6">
            <div className="flex min-w-0 flex-col gap-(--ct-space-4)">
              {warnings.length > 0 ? (
                <div className="rounded-(--ct-radius-md) border border-[var(--ct-status-warning-border)] bg-[var(--ct-status-warning-soft)] px-(--ct-space-3) py-(--ct-space-3)">
                  <div className="text-[length:var(--ct-text-2xs)] font-medium uppercase tracking-wide text-[var(--ct-status-warning)]">
                    Validation warnings
                  </div>
                  <ul className="mt-(--ct-space-2) flex list-disc flex-col gap-(--ct-space-1) pl-(--ct-space-4) text-[length:var(--ct-text-xs)] ct-text-body">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="grid gap-(--ct-space-4) md:grid-cols-3">
                <div className="flex flex-col gap-(--ct-space-2)">
                  <label className="ct-bento-label" htmlFor="investmentUsdc">
                    Invested USDC
                  </label>
                  <Input
                    id="investmentUsdc"
                    type="number"
                    value={String(Math.round(draftInput.investmentUsdc))}
                    onChange={(event) =>
                      handleFieldChange("investmentUsdc", event.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-(--ct-space-2)">
                  <label className="ct-bento-label" htmlFor="btcSpotPriceUsd">
                    BTC spot price
                  </label>
                  <Input
                    id="btcSpotPriceUsd"
                    type="number"
                    value={String(Math.round(draftInput.btcSpotPriceUsd))}
                    onChange={(event) =>
                      handleFieldChange("btcSpotPriceUsd", event.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-(--ct-space-2)">
                  <span className="ct-bento-label">BTC path preset</span>
                  <SegmentedControl
                    items={PATH_PRESET_ITEMS}
                    value={pathPreset}
                    onChange={handlePathPresetChange}
                    ariaLabel="BTC path preset"
                    variant="radiogroup"
                  />
                </div>
              </div>

              <div className="grid gap-(--ct-space-4) md:grid-cols-3">
                <div className="flex flex-col gap-(--ct-space-2)">
                  <label className="ct-bento-label" htmlFor="miningAllocationPct">
                    Mining allocation %
                  </label>
                  <Input
                    id="miningAllocationPct"
                    type="number"
                    value={pctInputValue(draftInput.miningAllocationPct)}
                    onChange={(event) =>
                      handleFieldChange("miningAllocationPct", event.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-(--ct-space-2)">
                  <label className="ct-bento-label" htmlFor="btcAllocationPct">
                    BTC / wBTC allocation %
                  </label>
                  <Input
                    id="btcAllocationPct"
                    type="number"
                    value={pctInputValue(draftInput.btcAllocationPct)}
                    onChange={(event) =>
                      handleFieldChange("btcAllocationPct", event.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-(--ct-space-2)">
                  <label className="ct-bento-label" htmlFor="usdcAllocationPct">
                    USDC allocation %
                  </label>
                  <Input
                    id="usdcAllocationPct"
                    type="number"
                    value={pctInputValue(draftInput.usdcAllocationPct)}
                    onChange={(event) =>
                      handleFieldChange("usdcAllocationPct", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-(--ct-space-4) md:grid-cols-4">
                <div className="flex flex-col gap-(--ct-space-2)">
                  <label className="ct-bento-label" htmlFor="openingLtvPct">
                    Opening LTV %
                  </label>
                  <Input
                    id="openingLtvPct"
                    type="number"
                    value={pctInputValue(draftInput.openingLtvPct)}
                    onChange={(event) =>
                      handleFieldChange("openingLtvPct", event.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-(--ct-space-2)">
                  <label className="ct-bento-label" htmlFor="liquidationLtvPct">
                    Liquidation LTV %
                  </label>
                  <Input
                    id="liquidationLtvPct"
                    type="number"
                    value={pctInputValue(draftInput.liquidationLtvPct)}
                    onChange={(event) =>
                      handleFieldChange("liquidationLtvPct", event.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-(--ct-space-2)">
                  <label className="ct-bento-label" htmlFor="deRiskTriggerLtvPct">
                    De-risk trigger %
                  </label>
                  <Input
                    id="deRiskTriggerLtvPct"
                    type="number"
                    value={pctInputValue(draftInput.deRiskTriggerLtvPct)}
                    onChange={(event) =>
                      handleFieldChange("deRiskTriggerLtvPct", event.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-(--ct-space-2)">
                  <label className="ct-bento-label" htmlFor="postSellTargetLtvPct">
                    Post-sell target %
                  </label>
                  <Input
                    id="postSellTargetLtvPct"
                    type="number"
                    value={pctInputValue(draftInput.postSellTargetLtvPct)}
                    onChange={(event) =>
                      handleFieldChange("postSellTargetLtvPct", event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="grid gap-(--ct-space-4) md:grid-cols-3">
                <div className="flex flex-col gap-(--ct-space-2)">
                  <label className="ct-bento-label" htmlFor="reRiskTriggerDistancePct">
                    Re-risk distance %
                  </label>
                  <Input
                    id="reRiskTriggerDistancePct"
                    type="number"
                    value={pctInputValue(draftInput.reRiskTriggerDistancePct)}
                    onChange={(event) =>
                      handleFieldChange(
                        "reRiskTriggerDistancePct",
                        event.target.value,
                      )
                    }
                  />
                </div>
                <div className="flex flex-col gap-(--ct-space-2)">
                  <label className="ct-bento-label" htmlFor="maxLtvAfterBuyPct">
                    Max LTV after buy %
                  </label>
                  <Input
                    id="maxLtvAfterBuyPct"
                    type="number"
                    value={pctInputValue(draftInput.maxLtvAfterBuyPct)}
                    onChange={(event) =>
                      handleFieldChange("maxLtvAfterBuyPct", event.target.value)
                    }
                  />
                </div>
                <div className="flex flex-col gap-(--ct-space-2)">
                  <label className="ct-bento-label" htmlFor="minimumReserveUsdc">
                    Minimum reserve USDC
                  </label>
                  <Input
                    id="minimumReserveUsdc"
                    type="number"
                    value={String(Math.round(draftInput.minimumReserveUsdc))}
                    onChange={(event) =>
                      handleFieldChange("minimumReserveUsdc", event.target.value)
                    }
                  />
                </div>
              </div>

              <details
                className="group rounded-(--ct-radius-md) border border-[var(--ct-border-soft)]"
                {...(initialAdvancedOpen ? { open: true } : {})}
              >
                <summary className="flex cursor-pointer list-none items-center gap-(--ct-space-2) px-(--ct-space-3) py-(--ct-space-2) text-[length:var(--ct-text-xs)] ct-text-tertiary select-none hover:ct-text-body">
                  <span className="transition-transform group-open:rotate-90">▶</span>
                  Advanced controls
                </summary>
                <div className="grid gap-(--ct-space-4) border-t border-[var(--ct-border-soft)] p-(--ct-space-3) md:grid-cols-3">
                  {[
                    ["repayRatioPct", "Repay ratio %"],
                    ["sellStepPctOfCollateral", "Fixed sell step %"],
                    ["buyStepPctOfReserve", "Buy step % of reserve"],
                    ["buySpacingPct", "Buy spacing %"],
                    ["borrowAprPct", "Borrow APR %"],
                    ["usdcReserveYieldPct", "USDC reserve yield %"],
                    ["wbtcYieldPct", "wBTC yield %"],
                    ["miningYieldPct", "Mining yield %"],
                    ["electricityMonthlyUsdc", "Electricity monthly USDC"],
                    ["timelineMonths", "Timeline months"],
                  ].map(([field, label]) => (
                    <div key={field} className="flex flex-col gap-(--ct-space-2)">
                      <label className="ct-bento-label" htmlFor={field}>
                        {label}
                      </label>
                      <Input
                        id={field}
                        type="number"
                        value={
                          field === "electricityMonthlyUsdc" ||
                          field === "timelineMonths"
                            ? String(
                                Math.round(
                                  draftInput[field as ControlField] as number,
                                ),
                              )
                            : pctInputValue(
                                draftInput[field as ControlField] as number,
                              )
                        }
                        onChange={(event) =>
                          handleFieldChange(field as ControlField, event.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>
              </details>
            </div>

            <div className="flex min-w-0 flex-col gap-(--ct-space-3)">
              <Metric
                variant="nested"
                label="Allocation sum"
                value={pct(
                  draftInput.miningAllocationPct +
                    draftInput.btcAllocationPct +
                    draftInput.usdcAllocationPct,
                )}
                sublabel="Must stay at 100%"
              />
              <Metric
                variant="nested"
                label="Borrowed working liquidity"
                value={summary ? usd(summary.base.debtUsdc) : "—"}
                sublabel="Debt is excluded from invested capital"
              />
              <Metric
                variant="nested"
                label="Working reserve identity"
                value={
                  summary
                    ? `${usd(summary.base.reserveAllocatedUsdc)} + ${usd(summary.base.debtUsdc)}`
                    : "—"
                }
                sublabel="reserveAllocatedUsdc + debtUsdc"
              />
              <Metric
                variant="nested"
                label="BTC path preset"
                value={
                  COLLATERAL_PATH_PRESET_OPTIONS.find(
                    (option) => option.value === pathPreset,
                  )?.label ?? "—"
                }
                sublabel={
                  COLLATERAL_PATH_PRESET_OPTIONS.find(
                    (option) => option.value === pathPreset,
                  )?.description
                }
              />
            </div>
          </div>
        </div>
      </AdminSectionCard>

      {summary ? (
        <>
          <AdminSectionCard
            title="USDC Investment Flow"
            subtitle="Everything starts with the USDC subscription; borrowed USDC becomes working liquidity, not invested capital."
          >
            <div className="flex flex-col gap-(--ct-space-3) p-5 lg:p-6">
              <div className="flex flex-wrap items-center gap-(--ct-space-2) text-[length:var(--ct-text-sm)] ct-text-body">
                <span className="font-semibold ct-text-accent">
                  {usd(summary.base.investmentUsdc)} invested
                </span>
                <span className="ct-text-tertiary">→</span>
                <span>{usd(summary.base.miningAllocatedUsdc)} mining</span>
                <span className="ct-text-tertiary">→</span>
                <span>{usd(summary.base.btcAllocatedUsdc)} BTC / wBTC</span>
                <span className="ct-text-tertiary">→</span>
                <span>{btc(summary.base.wbtcCollateralAmount)} collateral</span>
                <span className="ct-text-tertiary">→</span>
                <span>{usd(summary.base.reserveAllocatedUsdc)} allocated reserve</span>
                <span className="ct-text-tertiary">→</span>
                <span>{usd(summary.base.debtUsdc)} borrowed USDC</span>
                <span className="ct-text-tertiary">→</span>
                <span className="font-medium ct-text-accent">
                  {usd(summary.base.workingReserveUsdc)} working reserve
                </span>
              </div>
              <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
                Equation: <span className="ct-text-body">workingReserveUsdc = reserveAllocatedUsdc + debtUsdc</span>.
                The borrowed USDC is labelled as working liquidity throughout the studio and never mixed back into invested capital.
              </p>
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            title="Three Bucket Allocation"
            subtitle="Exactly three buckets only — yield remains an attribute of each bucket, never a fourth sleeve."
          >
            <div className="flex flex-col gap-(--ct-space-4) p-5 lg:p-6">
              <div className="flex h-3 w-full overflow-hidden rounded-(--ct-radius-full) border border-[var(--ct-border-soft)]">
                <div
                  style={{
                    width: `${summary.base.miningAllocatedUsdc / summary.base.investmentUsdc * 100}%`,
                    background: "var(--ct-bucket-mining)",
                  }}
                />
                <div
                  style={{
                    width: `${summary.base.btcAllocatedUsdc / summary.base.investmentUsdc * 100}%`,
                    background: "var(--ct-bucket-btc)",
                  }}
                />
                <div
                  style={{
                    width: `${summary.base.reserveAllocatedUsdc / summary.base.investmentUsdc * 100}%`,
                    background: "var(--ct-bucket-usdc)",
                  }}
                />
              </div>
              <div className="grid gap-(--ct-space-4) lg:grid-cols-3">
                {studioViewModel?.bucketCards.map((card) => {
                  const isMining = card.bucket === "MINING";
                  const isBtc = card.bucket === "BTC_WBTC_RC20";
                  return (
                    <div
                      key={card.bucket}
                      className="rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-[var(--ct-surface-card)] p-(--ct-space-4)"
                    >
                      <div className="flex items-center justify-between gap-(--ct-space-2)">
                        <span className="text-[length:var(--ct-text-sm)] font-semibold ct-text-strong">
                          {card.bucket === "BTC_WBTC_RC20"
                            ? "BTC / wBTC RC20"
                            : card.bucket === "USDC"
                              ? "USDC"
                              : "Mining"}
                        </span>
                        <span className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
                          {pct(card.allocatedUsdc / summary.base.investmentUsdc, 0)}
                        </span>
                      </div>
                      <div className="mt-(--ct-space-2) text-[length:var(--ct-text-lg)] font-semibold ct-text-strong tabular-nums">
                        {usd(card.allocatedUsdc)}
                      </div>
                      <div className="mt-(--ct-space-3) flex flex-col gap-(--ct-space-2)">
                        <Metric
                          variant="nested"
                          label="Yield attribute"
                          value={
                            isMining
                              ? pct(draftInput.miningYieldPct)
                              : isBtc
                                ? pct(draftInput.wbtcYieldPct)
                                : pct(draftInput.usdcReserveYieldPct)
                          }
                          sublabel={
                            isMining
                              ? "Mining yield"
                              : isBtc
                                ? "wBTC yield + BTC exposure"
                                : "USDC reserve yield"
                          }
                        />
                        <Metric
                          variant="nested"
                          label="Risk role"
                          value={
                            isMining
                              ? "Industrial base"
                              : isBtc
                                ? "Collateral risk sleeve"
                                : "Liquidity buffer"
                          }
                        />
                        <Metric
                          variant="nested"
                          label="Liquidity role"
                          value={
                            isMining
                              ? "Slow"
                              : isBtc
                                ? "On-chain liquid"
                                : "Immediate"
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            title="Collateral Cockpit"
            subtitle="Spot, collateral, debt, reserve, LTV, and trigger prices — all visible immediately."
          >
            <div className="grid gap-(--ct-space-4) p-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.9fr)] lg:p-6">
              <div className="rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-[var(--ct-surface-card)] p-(--ct-space-4)">
                {renderLtvGauge(validation.normalizedInput, summary)}
              </div>
              <div className="rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-[var(--ct-surface-card)] p-(--ct-space-4)">
                {renderPriceRail(validation.normalizedInput, summary)}
              </div>
              <div className="grid gap-(--ct-space-3)">
                <Metric
                  variant="nested"
                  label="BTC spot price"
                  value={usd(validation.normalizedInput.btcSpotPriceUsd)}
                />
                <Metric
                  variant="nested"
                  label="Collateral value"
                  value={usd(summary.base.collateralValueUsdc)}
                />
                <Metric
                  variant="nested"
                  label="Debt USDC"
                  value={usd(summary.base.debtUsdc)}
                  sublabel="Borrowed working liquidity"
                />
                <Metric
                  variant="nested"
                  label="Distance to liquidation"
                  value={pct(summary.base.distanceToLiquidationPct)}
                />
                <Metric
                  variant="nested"
                  label="Risk zone"
                  value={determineRiskZoneLabel(summary)}
                />
              </div>
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            title="Sell Ladder"
            subtitle="If BTC drops and LTV rises, the studio shows exactly where delevering starts, how much BTC is sold, and whether each step is feasible."
          >
            <div className="p-5 lg:p-6">
              <CollateralSellLadder
                steps={summary.sellLadder}
                initialOpenAdvanced={initialAdvancedOpen}
              />
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            title="Buyback Ladder"
            subtitle="Distance-safe price and buyback execution trigger are shown separately so healthy buffer recovery is never confused with the execution ladder."
          >
            <div className="flex flex-col gap-(--ct-space-4) p-5 lg:p-6">
              {buybackContext ? (
                <div className="grid gap-(--ct-space-3) md:grid-cols-2">
                  <Metric
                    variant="nested"
                    label="Distance-safe price"
                    value={
                      buybackContext.distanceSafePriceUsd != null
                        ? usd(buybackContext.distanceSafePriceUsd)
                        : "—"
                    }
                    sublabel="Price where liquidation distance is healthy again"
                  />
                  <Metric
                    variant="nested"
                    label="Buyback execution trigger"
                    value={
                      buybackContext.buybackExecutionTriggerUsd != null
                        ? usd(buybackContext.buybackExecutionTriggerUsd)
                        : "—"
                    }
                    sublabel="Price anchor after sell spacing rules"
                  />
                </div>
              ) : null}
              <CollateralBuybackLadder
                steps={summary.buybackLadder}
                initialOpenAdvanced={initialAdvancedOpen}
              />
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            title="Timeline / Charts"
            subtitle="One principal chart at a time, compact event list below, and the full monthly table collapsed by default."
          >
            <div className="p-5 lg:p-6">
              <CollateralTimeline
                rows={summary.timeline}
                deRiskTriggerLtvPct={validation.normalizedInput.deRiskTriggerLtvPct}
                liquidationLtvPct={validation.normalizedInput.liquidationLtvPct}
                minimumReserveUsdc={validation.normalizedInput.minimumReserveUsdc}
                initialOpenAdvanced={initialAdvancedOpen}
              />
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            title="Optimization Output"
            subtitle="Safety first: liquidation avoidance, debt reduction, BTC retention, reserve protection, then modelled ROI."
          >
            <div className="flex flex-col gap-(--ct-space-4) p-5 lg:p-6">
              <BentoKpiStrip
                ariaLabel="Optimization output summary"
                items={[
                  {
                    label: "Liquidation avoided",
                    value: summary.liquidationAvoided ? "Yes" : "No",
                    accent: summary.liquidationAvoided,
                  },
                  {
                    label: "Total debt repaid",
                    value: usdCompact(summary.totalDebtRepaidUsdc),
                  },
                  {
                    label: "BTC retained",
                    value: btc(summary.finalWbtcCollateralAmount),
                  },
                  {
                    label: "BTC sold",
                    value: btc(summary.totalBtcSold),
                  },
                  {
                    label: "BTC bought back",
                    value: btc(summary.totalBtcBought),
                  },
                  {
                    label: "Final reserve",
                    value: usdCompact(summary.finalWorkingReserveUsdc),
                  },
                  {
                    label: "Modelled ROI",
                    value: pct(summary.modelledRoiPct),
                  },
                ]}
              />

              <details
                className="group rounded-(--ct-radius-md) border border-[var(--ct-border-soft)]"
                {...(initialAdvancedOpen ? { open: true } : {})}
              >
                <summary className="flex cursor-pointer list-none items-center gap-(--ct-space-2) px-(--ct-space-3) py-(--ct-space-2) text-[length:var(--ct-text-xs)] ct-text-tertiary select-none hover:ct-text-body">
                  <span className="transition-transform group-open:rotate-90">▶</span>
                  Advanced optimization details
                </summary>
                <div className="grid gap-(--ct-space-4) border-t border-[var(--ct-border-soft)] p-(--ct-space-3) lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="grid gap-(--ct-space-3)">
                    <Metric
                      variant="nested"
                      label="Liquidation month"
                      value={summary.liquidationMonth != null ? `M${summary.liquidationMonth}` : "None"}
                    />
                    <Metric
                      variant="nested"
                      label="Final debt"
                      value={usd(summary.finalDebtUsdc)}
                    />
                    <Metric
                      variant="nested"
                      label="Final net equity"
                      value={usd(summary.finalNetEquityUsdc)}
                    />
                    <Metric
                      variant="nested"
                      label="Minimum reserve required"
                      value={usd(summary.minimumReserveRequiredUsdc)}
                    />
                    <Metric
                      variant="nested"
                      label="Maximum safe buyback BTC"
                      value={btc(summary.maximumSafeBuybackBtc)}
                    />
                    <Metric
                      variant="nested"
                      label="Objective score"
                      value={summary.objectiveScore.toFixed(0)}
                    />
                  </div>
                  <div className="rounded-(--ct-radius-lg) border border-[var(--ct-border-soft)] bg-[var(--ct-surface-card)] p-(--ct-space-4)">
                    <span className="ct-bento-label">Objective breakdown</span>
                    <div className="mt-(--ct-space-3) grid gap-(--ct-space-2)">
                      {Object.entries(summary.objectiveBreakdown).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-(--ct-space-2) border-b border-[var(--ct-border-soft)] pb-(--ct-space-2) text-[length:var(--ct-text-xs)] ct-text-body last:border-b-0 last:pb-0"
                        >
                          <span className="ct-text-tertiary">{key}</span>
                          <span className="tabular-nums">{value.toFixed(3)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </AdminSectionCard>

          <AdminSectionCard
            title="Advanced Details"
            subtitle="Collapsed by default: optimizer ranking, path scores, and local draft debug."
          >
            <div className="p-5 lg:p-6">
              <details
                className="group rounded-(--ct-radius-md) border border-[var(--ct-border-soft)]"
                {...(initialAdvancedOpen ? { open: true } : {})}
              >
                <summary className="flex cursor-pointer list-none items-center gap-(--ct-space-2) px-(--ct-space-3) py-(--ct-space-2) text-[length:var(--ct-text-xs)] ct-text-tertiary select-none hover:ct-text-body">
                  <span className="transition-transform group-open:rotate-90">▶</span>
                  Ranked candidates and path scores
                </summary>
                <div className="flex flex-col gap-(--ct-space-4) border-t border-[var(--ct-border-soft)] p-(--ct-space-3)">
                  <div className="min-w-0 overflow-x-auto">
                    <table className="w-full min-w-[56rem] border-collapse text-[length:var(--ct-text-xs)] tabular-nums">
                      <thead>
                        <tr className="border-b border-[var(--ct-border-soft)] ct-text-tertiary">
                          <th className="p-(--ct-space-2) text-left">Rank</th>
                          <th className="p-(--ct-space-2) text-right">Score</th>
                          <th className="p-(--ct-space-2) text-right">Liq. avoided</th>
                          <th className="p-(--ct-space-2) text-right">ROI</th>
                          <th className="p-(--ct-space-2) text-right">Debt</th>
                          <th className="p-(--ct-space-2) text-right">Reserve</th>
                          <th className="p-(--ct-space-2) text-right">BTC retained</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optimizerResult?.rankedCandidates.slice(0, 4).map((candidate) => (
                          <tr
                            key={candidate.rank}
                            className="border-b border-[var(--ct-border-soft)]"
                          >
                            <td className="p-(--ct-space-2) ct-text-strong">
                              {candidate.rank}
                            </td>
                            <td className="p-(--ct-space-2) text-right ct-text-body">
                              {candidate.summary.objectiveScore.toFixed(0)}
                            </td>
                            <td className="p-(--ct-space-2) text-right ct-text-body">
                              {candidate.summary.liquidationAvoided ? "Yes" : "No"}
                            </td>
                            <td className="p-(--ct-space-2) text-right ct-text-body">
                              {pct(candidate.summary.modelledRoiPct)}
                            </td>
                            <td className="p-(--ct-space-2) text-right ct-text-body">
                              {usdCompact(candidate.summary.finalDebtUsdc)}
                            </td>
                            <td className="p-(--ct-space-2) text-right ct-text-body">
                              {usdCompact(candidate.summary.finalWorkingReserveUsdc)}
                            </td>
                            <td className="p-(--ct-space-2) text-right ct-text-body">
                              {btc(candidate.summary.finalWbtcCollateralAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <details className="group rounded-(--ct-radius-md) border border-[var(--ct-border-soft)]">
                    <summary className="flex cursor-pointer list-none items-center gap-(--ct-space-2) px-(--ct-space-3) py-(--ct-space-2) text-[length:var(--ct-text-xs)] ct-text-tertiary select-none hover:ct-text-body">
                      <span className="transition-transform group-open:rotate-90">▶</span>
                      Local draft JSON
                    </summary>
                    <pre className="max-h-[20rem] overflow-auto border-t border-[var(--ct-border-soft)] bg-[var(--ct-surface-card)] p-(--ct-space-3) text-[length:var(--ct-text-2xs)] ct-text-body">
                      {JSON.stringify(
                        {
                          pathPreset,
                          input: draftInput,
                          validation,
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </div>
              </details>
            </div>
          </AdminSectionCard>
        </>
      ) : (
        <AdminSectionCard
          title="Collateral model validation"
          subtitle="The studio sections unlock once the current input set is mathematically valid."
        >
          <div className="p-5 lg:p-6">
            <p className="text-[length:var(--ct-text-xs)] ct-text-tertiary">
              Adjust the inputs above until allocations sum to 100% and the LTV thresholds are ordered correctly.
            </p>
          </div>
        </AdminSectionCard>
      )}
    </div>
  );
}
