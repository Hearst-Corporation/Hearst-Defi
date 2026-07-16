"use client";

import Image from "next/image";
import { Pickaxe } from "lucide-react";
import { cn } from "@/lib/cn";

export type AssetIconVariant = "btc" | "usdc" | "mining" | "reserve";

const SIZE_PX = { sm: 16, md: 20, lg: 28 } as const;

const LABELS: Record<AssetIconVariant, string> = {
  btc: "Bitcoin",
  usdc: "USDC",
  mining: "Mining power",
  reserve: "Operating reserve",
};

export function AssetIcon({
  variant,
  size = "md",
  className,
  label,
}: {
  variant: AssetIconVariant;
  size?: keyof typeof SIZE_PX;
  className?: string;
  /** Overrides default accessible name. */
  label?: string;
}) {
  const px = SIZE_PX[size];
  const alt = label ?? LABELS[variant];

  if (variant === "btc") {
    return (
      <Image
        src="/crypto-icons/btc.svg"
        alt={alt}
        width={px}
        height={px}
        className={cn("shrink-0", className)}
        aria-hidden={label === undefined ? undefined : false}
      />
    );
  }

  if (variant === "usdc" || variant === "reserve") {
    return (
      <Image
        src="/crypto-icons/usdc.svg"
        alt={alt}
        width={px}
        height={px}
        className={cn("shrink-0", className)}
        aria-hidden={label === undefined ? undefined : false}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={alt}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        "bg-[var(--ct-asset-mining-soft)] text-[var(--ct-asset-mining)]",
        className,
      )}
      style={{ width: px, height: px }}
    >
      <Pickaxe size={Math.round(px * 0.55)} strokeWidth={1.75} aria-hidden />
    </span>
  );
}
