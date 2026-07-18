// src/features/investor-ui/components/reserve-cockpit/index.ts
//
// Bitcoin Reserve cockpit — shared viz blocks of the Series 1 narrative
// (M5/W1). Single import surface: capital → 3 pockets → mining → reserve
// operations → BTC accumulated over 24 months → delivery at maturity → proofs.
//
// Each block is token-only (--ct-*), composes the existing HIS primitives +
// the shared accumulation-series derivation (never duplicates them), carries a
// per-block provenance badge, and renders an honest empty / not-configured
// state when its input is null — never a fabricated value, never a fake `Live`.

export { ReserveBlockFrame } from "./block-frame";
export type { ReserveBlockFrameProps } from "./block-frame";

export { CapitalFlowRail } from "./CapitalFlowRail";
export type {
  CapitalFlowRailProps,
  CapitalFlowRailData,
  CapitalFlowPocket,
} from "./CapitalFlowRail";

export { BtcAccumulationCurve } from "./BtcAccumulationCurve";
export type {
  BtcAccumulationCurveProps,
  BtcAccumulationCurveData,
} from "./BtcAccumulationCurve";

export { AllInCostVsSpot } from "./AllInCostVsSpot";
export type { AllInCostVsSpotProps, CostSpotPoint } from "./AllInCostVsSpot";

export { ReserveRunwayChart } from "./ReserveRunwayChart";
export type {
  ReserveRunwayChartProps,
  ReserveRunwayData,
  RunwayPoint,
} from "./ReserveRunwayChart";

export { MiningActivityTimeline } from "./MiningActivityTimeline";
export type {
  MiningActivityTimelineProps,
  MiningInterval,
  FleetState,
} from "./MiningActivityTimeline";

export { PocketAllocationVisual } from "./PocketAllocationVisual";
export type {
  PocketAllocationVisualProps,
  PocketAllocation,
} from "./PocketAllocationVisual";

export { SmartContractStateCard } from "./SmartContractStateCard";
export type {
  SmartContractStateCardProps,
  SmartContractState,
  VaultMode,
} from "./SmartContractStateCard";

export { DeliveryRailSelector } from "./DeliveryRailSelector";
export type {
  DeliveryRailSelectorProps,
  DeliveryRailSelectorData,
  DeliveryRail,
} from "./DeliveryRailSelector";
