import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import type { Provenance } from "@/components/ui/provenance-badge";
import { dashboardUsdCompact } from "@/lib/admin/dashboard-formatters";

interface VaultVitalsRingProps {
  /** Raw composite risk score 0–100. */
  composite: number;
  /** "low" | "medium" | "high" */
  band: "low" | "medium" | "high";
  /** Human-readable band label e.g. "Moderate". */
  bandLabel: string;
  /** AUM in USDC. Ring shows awaiting state when ≤ 0 or !hasLiveKpis. */
  capitalUsdc: number;
  /** Provenance of the capital figure. */
  provenance: Provenance;
  /** False → awaiting state: neutral arc, no AUM figure. */
  hasLiveKpis: boolean;
}

const RADIUS = 15.915494309189533;
const CIRCUMFERENCE = 100;

const BAND_STROKE: Record<string, string> = {
  low: "var(--ct-status-success)",
  medium: "var(--ct-status-warning)",
  high: "var(--ct-status-danger)",
};

const BAND_LABEL_CLASS: Record<string, string> = {
  low: "ct-status-glow-success",
  medium: "ct-status-glow-warning",
  high: "ct-status-glow-danger",
};

export function VaultVitalsRing({
  composite,
  band,
  bandLabel,
  capitalUsdc,
  provenance,
  hasLiveKpis,
}: VaultVitalsRingProps) {
  const showLive = hasLiveKpis && capitalUsdc > 0;
  const arcLength = showLive ? Math.max(1, Math.min(composite, 100)) : 0;
  const strokeColor = showLive ? BAND_STROKE[band] ?? BAND_STROKE.medium : "var(--ct-surface-3)";
  const bandLabelClass = showLive ? (BAND_LABEL_CLASS[band] ?? BAND_LABEL_CLASS.medium) : "ct-text-faint";

  const rootAriaLabel = showLive
    ? `Capital under management ${dashboardUsdCompact.format(capitalUsdc)}, composite risk ${composite}, ${bandLabel}`
    : "Vault vitals — awaiting live custody feed";

  return (
    <div className="vault-vitals-ring" role="img" aria-label={rootAriaLabel}>
      {/* SVG ring */}
      <div className="vault-vitals-ring__visual" aria-hidden="true">
        <svg
          viewBox="0 0 42 42"
          className="vault-vitals-ring__svg"
          aria-hidden="true"
        >
          <defs>
            <filter id="vitals-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Track */}
          <circle
            cx="21"
            cy="21"
            r={RADIUS}
            fill="none"
            stroke="var(--ct-surface-2)"
            strokeWidth="2"
          />

          {/* Arc — risk composite */}
          <circle
            cx="21"
            cy="21"
            r={RADIUS}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeDasharray={`${arcLength} ${CIRCUMFERENCE - arcLength}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            filter={showLive ? "url(#vitals-glow)" : undefined}
            style={{
              transition: "stroke-dasharray 1s ease-out, stroke 0.4s ease",
              transformOrigin: "center",
            }}
          />
        </svg>

        {/* Core label */}
        <div className="vault-vitals-ring__core">
          {showLive ? (
            <>
              <span className="vault-vitals-ring__aum-label">Capital</span>
              <strong className="vault-vitals-ring__aum tabular">
                {dashboardUsdCompact.format(capitalUsdc)}
              </strong>
              <small className="vault-vitals-ring__aum-sub">under management</small>
            </>
          ) : (
            <>
              <span className="vault-vitals-ring__awaiting-icon" aria-hidden="true">—</span>
              <small className="vault-vitals-ring__awaiting-label">Awaiting feed</small>
            </>
          )}
        </div>
      </div>

      {/* Caption below the ring */}
      <div className="vault-vitals-ring__caption">
        {showLive ? (
          <>
            <span className={`vault-vitals-ring__composite tabular ${bandLabelClass}`}>
              Composite risk {composite}
            </span>
            <span className="vault-vitals-ring__separator" aria-hidden="true"> · </span>
            <span className={`vault-vitals-ring__band ${bandLabelClass}`}>{bandLabel}</span>
          </>
        ) : (
          <span className="vault-vitals-ring__awaiting-caption">
            Awaiting live custody feed
          </span>
        )}
      </div>

      {/* Provenance + disclaimer row */}
      <div className="vault-vitals-ring__meta">
        <ProvenanceBadge kind={provenance} variant="compact" />
        <span className="vault-vitals-ring__disclaimer">Not guaranteed</span>
      </div>
    </div>
  );
}
