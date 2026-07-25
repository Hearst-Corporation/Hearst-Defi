// src/features/investor-ui/components/reserve-cockpit/block-frame.tsx
//
// Shared block chrome for the Bitcoin Reserve cockpit viz library (M5/W1).
// Every reserve-cockpit block is a titled surface carrying its own provenance
// badge (non-negotiable #2). This frame is the ONE place that renders the
// header + badge + optional caption, so the eight viz blocks stay visually
// identical and never hand-roll their own header.
//
// Token-only, delegates provenance to the Catalyst `ChartSourceBadge` — no new
// visual language is introduced here.

import type { ReactNode } from "react";

import { ChartSourceBadge } from "@/components/catalyst/chart-source-badge";
import type { ChartSourceStatus } from "@/components/catalyst/chart-types";
import { cn } from "@/lib/cn";

export interface ReserveBlockFrameProps {
  /** Block title, e.g. "Capital Flow". */
  title: string;
  /** Provenance for THIS block's data (Live / Attested / Estimated / …). */
  source: ChartSourceStatus;
  /** Optional short subtitle under the title. */
  subtitle?: string;
  /** Optional footnote rendered muted under the body (assumptions / disclaimer). */
  footnote?: ReactNode;
  /** Optional right-aligned header slot (e.g. a range chip). */
  headerRight?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Titled surface with a provenance badge in the header. The body slot receives
 * either a resolved viz or an honest empty/not-configured state — the frame
 * itself never fabricates a value.
 */
export function ReserveBlockFrame({
  title,
  source,
  subtitle,
  footnote,
  headerRight,
  className,
  children,
}: ReserveBlockFrameProps) {
  return (
    <section
      className={cn(
        "ct-card flex flex-col gap-[var(--ct-space-4)] p-[var(--ct-space-5)]",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-[var(--ct-space-3)]">
        <div className="flex flex-col gap-[var(--ct-space-1)]">
          <div className="flex items-center gap-[var(--ct-space-2)]">
            <h3
              className="m-0"
              style={{
                fontSize: "var(--ct-text-sm)",
                fontWeight: 700,
                letterSpacing: "0.01em",
                color: "var(--ct-text-primary)",
              }}
            >
              {title}
            </h3>
            <ChartSourceBadge status={source} />
          </div>
          {subtitle ? (
            <p
              className="m-0"
              style={{ fontSize: "var(--ct-text-2xs)", color: "var(--ct-text-muted)" }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </header>

      <div className="min-w-0">{children}</div>

      {footnote ? (
        <p
          className="m-0"
          style={{
            fontSize: "var(--ct-text-nano)",
            lineHeight: 1.5,
            color: "var(--ct-text-faint)",
          }}
        >
          {footnote}
        </p>
      ) : null}
    </section>
  );
}
