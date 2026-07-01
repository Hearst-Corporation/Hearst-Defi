/**
 * SYNTHETIC historical-STYLE regimes. These approximate the *shape* of past BTC
 * years (bear/crash-recovery/bull/drawdown/…) with modelled drift/vol — they are
 * NOT the real historical price series. Always labelled "synthetic historical-style".
 */

import type { MarketRegimeConfig } from "./types";

export const SYNTHETIC_HISTORICAL_REGIMES: MarketRegimeConfig[] = [
  {
    id: "hist-2018-bear",
    label: "2018-style bear",
    description: "Synthetic historical-style: a long, grinding bear year.",
    btcStartPrice: 14_000,
    monthlyDriftBps: -650,
    monthlyVolBps: 1000,
  },
  {
    id: "hist-2020-crash-recovery",
    label: "2020-style crash + recovery",
    description: "Synthetic historical-style: a sharp crash then a strong recovery.",
    btcStartPrice: 9_000,
    monthlyDriftBps: 300,
    monthlyVolBps: 1300,
    jumpRiskBps: 4000,
    recoveryDriftBps: 700,
  },
  {
    id: "hist-2021-bull",
    label: "2021-style bull",
    description: "Synthetic historical-style: a strong bull with sharp swings.",
    btcStartPrice: 30_000,
    monthlyDriftBps: 550,
    monthlyVolBps: 1200,
  },
  {
    id: "hist-2022-drawdown",
    label: "2022-style drawdown",
    description: "Synthetic historical-style: a sustained drawdown year.",
    btcStartPrice: 47_000,
    monthlyDriftBps: -600,
    monthlyVolBps: 1000,
    maxDrawdownShockBps: 6500,
  },
  {
    id: "hist-2023-recovery",
    label: "2023-style recovery",
    description: "Synthetic historical-style: a steady recovery off the lows.",
    btcStartPrice: 16_500,
    monthlyDriftBps: 400,
    monthlyVolBps: 700,
  },
  {
    id: "hist-2024-range-expansion",
    label: "2024-style range expansion",
    description: "Synthetic historical-style: an expanding range with upward bias.",
    btcStartPrice: 42_000,
    monthlyDriftBps: 300,
    monthlyVolBps: 900,
  },
];
