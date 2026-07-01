/**
 * Market regime library — 10 named, deterministic, SEEDED regime shapes for the
 * Data Lab. These are synthetic (drift/vol/shock parameters), NOT real market
 * data. Every consumer must label them "modelled / synthetic".
 */

import type { MarketRegimeConfig } from "./types";

const START = 60_000;

export const MARKET_REGIMES: MarketRegimeConfig[] = [
  {
    id: "btc-bull-trend",
    label: "BTC Bull Trend",
    description: "Sustained monthly uptrend with moderate volatility.",
    btcStartPrice: START,
    monthlyDriftBps: 400,
    monthlyVolBps: 700,
  },
  {
    id: "btc-bear-drawdown",
    label: "BTC Bear Drawdown",
    description: "Persistent monthly downtrend with elevated volatility.",
    btcStartPrice: START,
    monthlyDriftBps: -500,
    monthlyVolBps: 1100,
    maxDrawdownShockBps: 6000,
  },
  {
    id: "sideways-high-vol",
    label: "Sideways High Volatility",
    description: "Flat drift, wide monthly swings.",
    btcStartPrice: START,
    monthlyDriftBps: 0,
    monthlyVolBps: 1600,
  },
  {
    id: "flash-crash-recovery",
    label: "Flash Crash + Recovery",
    description: "A sharp drawdown shock followed by a recovery drift.",
    btcStartPrice: START,
    monthlyDriftBps: -100,
    monthlyVolBps: 1400,
    jumpRiskBps: 3500,
    recoveryDriftBps: 600,
  },
  {
    id: "slow-grind-down",
    label: "Slow Grind Down",
    description: "Low-volatility, steadily eroding price.",
    btcStartPrice: START,
    monthlyDriftBps: -200,
    monthlyVolBps: 400,
  },
  {
    id: "vol-compression",
    label: "Volatility Compression",
    description: "Near-flat, very low volatility.",
    btcStartPrice: START,
    monthlyDriftBps: 50,
    monthlyVolBps: 250,
  },
  {
    id: "mining-electricity-shock",
    label: "Mining / Electricity Shock",
    description: "Neutral price with an electricity cost shock.",
    btcStartPrice: START,
    monthlyDriftBps: 0,
    monthlyVolBps: 800,
    electricityShockBps: 8000,
  },
  {
    id: "borrow-apr-spike",
    label: "Borrow APR Spike",
    description: "Neutral price with a sharp borrow-rate spike.",
    btcStartPrice: START,
    monthlyDriftBps: -50,
    monthlyVolBps: 900,
    borrowAprShockBps: 6000,
  },
  {
    id: "yield-compression",
    label: "Yield Compression",
    description: "Neutral price with compressed reserve yields.",
    btcStartPrice: START,
    monthlyDriftBps: 0,
    monthlyVolBps: 700,
    yieldShockBps: -6000,
  },
  {
    id: "combined-stress",
    label: "Combined Stress",
    description: "Bear drift + high vol + borrow spike + yield compression.",
    btcStartPrice: START,
    monthlyDriftBps: -450,
    monthlyVolBps: 1500,
    borrowAprShockBps: 4000,
    yieldShockBps: -5000,
    maxDrawdownShockBps: 5000,
  },
];

export function getRegime(id: string): MarketRegimeConfig | undefined {
  return MARKET_REGIMES.find((r) => r.id === id);
}
