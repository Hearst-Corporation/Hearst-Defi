"use client";

/**
 * Product Workspace step theater — shared source logos and hero marks.
 * Presentation only; assets live under /public/sources.
 */

import { LineChart } from "lucide-react";

import { cn } from "@/lib/cn";
import type { ConstructionStepId } from "@/lib/agentic/swarm/live/stream-types";

type BrandId =
  | "bitcoin"
  | "coingecko"
  | "binance"
  | "kraken"
  | "bitmain"
  | "microbt"
  | "canaan"
  | "aave"
  | "compound"
  | "morpho"
  | "usdc"
  | "usdt"
  | "luxor"
  | "hashrate_index"
  | "mempool";

const BRAND_LOGOS: Record<BrandId, { label: string; src?: string; initials?: string }> = {
  bitcoin: { label: "Bitcoin", src: "/sources/bitcoin.svg" },
  coingecko: { label: "CoinGecko", src: "/sources/coingecko.svg" },
  binance: { label: "Binance", src: "/sources/binance.svg" },
  kraken: { label: "Kraken", src: "/sources/kraken.svg" },
  bitmain: { label: "Bitmain", src: "/sources/bitmain.png" },
  microbt: { label: "MicroBT", src: "/sources/microbt.png" },
  canaan: { label: "Canaan", src: "/sources/canaan.png" },
  aave: { label: "Aave", src: "/sources/aave.svg" },
  compound: { label: "Compound", src: "/sources/compound.svg" },
  morpho: { label: "Morpho", src: "/sources/morpho.svg" },
  usdc: { label: "USDC", src: "/sources/usdc.svg" },
  usdt: { label: "USDT", src: "/sources/usdt.svg" },
  luxor: { label: "Luxor", initials: "LX" },
  hashrate_index: { label: "Hashrate Index", initials: "HI" },
  mempool: { label: "mempool.space", initials: "MS" },
};

export const STEP_HERO: Record<ConstructionStepId, BrandId | "analytics"> = {
  bitcoin: "bitcoin",
  hashprice: "bitcoin",
  mining_infra: "bitmain",
  defi: "usdc",
  data_scientist: "analytics",
};

export const STEP_SOURCES: Record<ConstructionStepId, readonly BrandId[]> = {
  bitcoin: ["coingecko", "binance", "kraken"],
  hashprice: ["luxor", "hashrate_index", "mempool"],
  mining_infra: ["bitmain", "microbt", "canaan"],
  defi: ["aave", "compound", "morpho"],
  data_scientist: ["bitcoin", "usdc", "coingecko"],
};

export function BrandLogo({ id, size = 28 }: { id: BrandId; size?: number }) {
  const brand = BRAND_LOGOS[id];
  return (
    <span
      title={brand.label}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ct-border)] bg-[var(--ct-surface-inset)]"
      style={{ width: size, height: size }}
    >
      {brand.src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={brand.src}
          alt={brand.label}
          width={size}
          height={size}
          loading="eager"
          decoding="async"
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-[10px] font-medium tracking-tight ct-text-faint select-none">
          {brand.initials}
        </span>
      )}
    </span>
  );
}

export function StepHeroLogo({
  stepId,
  size = 72,
}: {
  stepId: ConstructionStepId;
  size?: number;
}) {
  const hero = STEP_HERO[stepId];
  if (hero === "analytics") {
    return (
      <span
        title="Analytics model"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--ct-border)] bg-[var(--ct-surface-inset)] ct-text-accent",
        )}
        style={{ width: size, height: size }}
      >
        <LineChart size={Math.round(size * 0.45)} aria-hidden />
      </span>
    );
  }
  return <BrandLogo id={hero} size={size} />;
}

export function StepSourceRow({ stepId, size = 28 }: { stepId: ConstructionStepId; size?: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-(--ct-space-3)">
      {STEP_SOURCES[stepId].map((id) => (
        <BrandLogo key={id} id={id} size={size} />
      ))}
    </div>
  );
}
