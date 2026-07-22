// src/features/investor-ui/components/reserve-cockpit/index.ts
//
// Bitcoin Reserve cockpit — the blocks a page ACTUALLY renders.
//
// This barrel once exported eight visualization blocks; seven were never
// mounted by any route (verified 2026-07-22 by closing the import graph) and
// several carried illustrative series — a pace overlay engineered to sit
// above the real curve, an accumulation total inflated by a fixed strategic
// ratio. Dead code that LOOKS like product is the standing risk this codebase
// keeps paying for: a future wiring reconnects it and the invented figures
// ship. Removed rather than kept "just in case"; git holds them if a real,
// sourced need returns.
//
// What remains is what /portfolio/[positionId] renders: the capital-flow rail
// (real principal + factsheet bps, honest null for an unfunded position) and
// its shared frame.

export { ReserveBlockFrame } from "./block-frame";
export type { ReserveBlockFrameProps } from "./block-frame";

export { CapitalFlowRail } from "./CapitalFlowRail";
export type {
  CapitalFlowRailProps,
  CapitalFlowRailData,
  CapitalFlowPocket,
} from "./CapitalFlowRail";
