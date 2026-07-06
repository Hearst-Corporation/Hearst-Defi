/**
 * LockArc — soft lock-up progress as a 270° radial gauge.
 *
 * Real derived data (daysHeld / softLockupDays) — static, no Live pulse (a date
 * calc is not a live reading). Accent fill only when a lock exists; honest
 * empty-state when there is none. Pure render (server component).
 */

const SIZE = 116;
const STROKE = 9;
const R = (SIZE - STROKE) / 2;
const C = SIZE / 2;
// pathLength=100 → dash lengths read as percentages. 75 = 270° arc.
const ARC = 75;

export function LockArc({
  daysHeld,
  lockupDays,
}: {
  daysHeld: number;
  lockupDays: number;
}) {
  const hasLock = lockupDays > 0;
  const clampedDays = hasLock ? Math.min(daysHeld, lockupDays) : daysHeld;
  const pct = hasLock ? Math.min(1, Math.max(0, daysHeld / lockupDays)) : 0;

  return (
    <div className="flex flex-col gap-3 bg-surface-card p-5 min-w-0">
      <div className="ct-bento-label">Lock progress</div>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            {/* Track */}
            <circle
              cx={C}
              cy={C}
              r={R}
              fill="none"
              stroke="var(--ct-chart-grid-stroke)"
              strokeWidth={STROKE}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${ARC} ${100 - ARC}`}
              transform={`rotate(135 ${C} ${C})`}
            />
            {/* Fill */}
            {hasLock && pct > 0 && (
              <circle
                cx={C}
                cy={C}
                r={R}
                fill="none"
                stroke="var(--ct-accent)"
                strokeWidth={STROKE}
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${ARC * pct} ${100 - ARC * pct}`}
                transform={`rotate(135 ${C} ${C})`}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {hasLock ? (
              <>
                <span
                  className="ct-metric-value"
                  style={{ fontSize: "var(--ct-text-xl)", lineHeight: 1 }}
                >
                  {clampedDays}
                </span>
                <span className="ct-metric-caption">of {lockupDays}d</span>
              </>
            ) : (
              <span className="ct-metric-caption text-center px-2">No lock-up</span>
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="ct-metric-caption">
            {hasLock ? "Soft lock-up" : "No soft lock-up on this position"}
          </span>
          {hasLock ? (
            <span className="ct-metric-caption" style={{ color: "var(--ct-text-muted)" }}>
              {Math.max(0, lockupDays - clampedDays)} days remaining
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
