/**
 * HcRiskDimensions — the 5 risk dimensions as SMALL MULTIPLES (Tufte), not a risk matrix
 * (Cox) and not a filled radar. Five identical tiles: label + status dot + a mini severity
 * bar on a shared 0–100 scale + a provenance badge. Uniform scale, no dimension louder than
 * another except through its severity token. Token-only.
 */
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

export type RiskBand = "green" | "amber" | "red";

export interface RiskDimension {
  key: string;
  label: string;
  /** Severity score on a shared 0–100 scale. */
  score: number;
  band: RiskBand;
  provenance: Provenance;
}

const BAND_VAR: Record<RiskBand, string> = {
  green: "var(--ct-status-success)",
  amber: "var(--ct-status-warning)",
  red: "var(--ct-status-danger)",
};

export function HcRiskDimensions({
  dims,
  className,
}: {
  dims: readonly RiskDimension[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-px overflow-hidden rounded-lg bg-[var(--ct-border-soft)] sm:grid-cols-2 lg:grid-cols-5",
        className,
      )}
      aria-label="Risk dimensions — small multiples"
    >
      {dims.map((d) => (
        <div
          key={d.key}
          className="flex min-w-0 flex-col gap-1.5 bg-surface-card p-3"
        >
          <div className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background: BAND_VAR[d.band],
                boxShadow: "var(--ct-glow-dot)",
                color: BAND_VAR[d.band],
              }}
            />
            <span className="ct-bento-label min-w-0 truncate">{d.label}</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-sm"
            style={{ background: "var(--ct-surface-inset)" }}
            role="img"
            aria-label={`${d.label} severity ${d.score} of 100`}
          >
            <div
              className="h-full rounded-sm"
              style={{
                width: `${Math.max(0, Math.min(100, d.score))}%`,
                background: BAND_VAR[d.band],
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[length:var(--ct-text-nano)] ct-text-muted tabular-nums">
              {d.score}/100
            </span>
            <ProvenanceBadge kind={d.provenance} variant="strip" />
          </div>
        </div>
      ))}
    </div>
  );
}
