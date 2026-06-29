import { cn } from "@/lib/cn";
import {
  providerLabel,
  resolveProviderLogo,
} from "@/lib/data/provider-logos";

/**
 * ProviderLogo — renders a DeFi protocol's real brand logo (official colours, NO
 * tint, NO filter) inside a neutral circular chip, or a tokenized initial pill
 * when no brand asset is mapped for the slug.
 *
 * The chip is a flat token surface so the colourful logo reads cleanly on the
 * dark module background; the logo itself is never recoloured. Sizes are token-
 * driven so it sits inline with `ct-metric-*` text.
 */
export function ProviderLogo({
  project,
  size = 18,
  className,
}: {
  /** Raw DeFiLlama project slug (e.g. "aave-v3", "morpho-blue"). */
  project: string;
  size?: number;
  className?: string;
}) {
  const logo = resolveProviderLogo(project);
  const label = providerLabel(project);

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ct-border)] bg-[var(--ct-surface-inset)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden={logo ? undefined : true}
    >
      {logo ? (
        // Real brand logo, original colours — never tinted.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo.src}
          alt={label}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
        />
      ) : (
        <span
          className="font-semibold leading-none text-[var(--ct-text-muted)]"
          style={{ fontSize: Math.round(size * 0.5) }}
        >
          {label.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

/**
 * ProviderChip — logo + label + optional trailing value (APY), as a flat pill.
 * Used to show the real top USDC pools that back the stable-yield input.
 */
export function ProviderChip({
  project,
  value,
  className,
}: {
  project: string;
  value?: string;
  className?: string;
}) {
  const label = providerLabel(project);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[var(--ct-border)] bg-[var(--ct-surface-inset)] py-1 pl-1.5 pr-3",
        className,
      )}
    >
      <ProviderLogo project={project} size={20} />
      <span className="ct-metric-caption font-medium text-[var(--ct-text-secondary)]">
        {label}
      </span>
      {value ? (
        <span className="ct-metric-caption tabular-nums text-[var(--ct-accent)]">
          {value}
        </span>
      ) : null}
    </span>
  );
}
