"use client";

/**
 * SimulationPanel — pre-execution simulation panel (Tally pattern).
 *
 * Displays diff state, gas estimate, reverts, and events BEFORE a user signs.
 * Designed to wrap any governance proposal flow.
 *
 * Wiring to /admin/governance/proposal/[id]/page.tsx (P2):
 *   1. Import simulateProposal from "@/lib/simulation/tenderly-stub"
 *   2. On "Simulate" button click, call simulateProposal({ vaultAddress, calldata, actionType })
 *   3. Pass the result and loading/error state to <SimulationPanel />
 *   4. Gate the "Sign & Execute" button behind result.ok === true
 *
 * Example:
 *   const [result, setResult] = useState<SimulationResult | null>(null);
 *   const [loading, setLoading] = useState(false);
 *   const [error, setError] = useState<string | null>(null);
 *   ...
 *   <SimulationPanel result={result} loading={loading} error={error} />
 */

import { cn } from "@/lib/cn";
import type {
  SimulationResult,
  StateDiffEntry,
  BalanceDeltaEntry,
  RevertEntry,
  EventEntry,
} from "@/lib/simulation/types";

// ── Token refs ────────────────────────────────────────────────────────────────
// Colours used in this component (all from Cockpit token set):
//   --ct-text-faint    : "before" value (dim / unchanged feel)
//   --ct-accent        : "after" value (vert #A7FB90 — changed)
//   --ct-status-danger : revert reason text
//   --ct-text-strong   : primary labels
//   --ct-text-muted    : secondary labels
//   --ct-surface-0/1   : card backgrounds
//   --ct-border-soft   : separator lines
// ─────────────────────────────────────────────────────────────────────────────

interface SimulationPanelProps {
  result: SimulationResult | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export function SimulationPanel({
  result,
  loading = false,
  error = null,
  className,
}: SimulationPanelProps) {
  return (
    <section
      className={cn(
        "rounded-[var(--ct-radius-xl)] border border-[var(--ct-border-soft)] bg-[var(--ct-surface-0)] p-6 space-y-5",
        className,
      )}
      aria-busy={loading ? "true" : "false"}
      aria-label="Pre-execution simulation panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[length:var(--ct-text-sm)] font-semibold uppercase tracking-[var(--ct-tracking-wide)] text-[var(--ct-text-strong)]">
          Simulation Preview
        </h3>
        {result && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[var(--ct-radius-full)] px-2.5 py-1 text-[length:var(--ct-text-micro)] font-medium border",
              result.ok
                ? "border-[var(--ct-status-success-border)] bg-[var(--ct-status-success-soft)] text-[var(--ct-status-success)]"
                : "border-[var(--ct-status-danger-border)] bg-[var(--ct-status-danger-soft)] text-[var(--ct-status-danger)]",
            )}
          >
            {result.ok ? "Success" : "Reverts"}
          </span>
        )}
      </div>

      {/* Loading state */}
      {loading && <LoadingState />}

      {/* Error state */}
      {!loading && error && <ErrorState message={error} />}

      {/* Results */}
      {!loading && !error && result && (
        <div className="space-y-5">
          <GasRow
            gas={result.gasUsedEstimate}
            usd={result.gasCostUsdEstimate}
          />

          <Divider />

          <StateDiffSection entries={result.stateDiff} />

          <Divider />

          <BalanceDeltaSection entries={result.balanceDelta} />

          {result.reverts.length > 0 && (
            <>
              <Divider />
              <RevertsSection entries={result.reverts} />
            </>
          )}

          <Divider />

          <EventsSection entries={result.events} />

          <TraceLink />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && !result && <EmptyState />}
    </section>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Divider() {
  return (
    <hr className="border-t border-[var(--ct-border-soft)]" aria-hidden="true" />
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      {/* Spinner */}
      <span
        className="block h-8 w-8 rounded-full border-2 border-[var(--ct-border-soft)] border-t-[var(--ct-accent)] animate-spin"
        aria-hidden="true"
      />
      <p className="text-[length:var(--ct-text-sm)] text-[var(--ct-text-muted)]">
        Simulating on fork…
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-[var(--ct-radius-lg)] border border-[var(--ct-status-danger-border)] bg-[var(--ct-status-danger-soft)] px-4 py-3"
    >
      <p className="text-[length:var(--ct-text-sm)] font-medium text-[var(--ct-status-danger)]">
        Simulation failed
      </p>
      <p className="mt-1 text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]">
        {message}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <p className="text-[length:var(--ct-text-sm)] text-[var(--ct-text-faint)] text-center py-6">
      No simulation run yet. Click <strong className="text-[var(--ct-text-muted)]">Simulate</strong> to preview execution.
    </p>
  );
}

function GasRow({ gas, usd }: { gas: number; usd: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)] uppercase tracking-[var(--ct-tracking-wide)]">
        Gas estimate
      </span>
      <span className="mono tabular-nums text-[length:var(--ct-text-sm)] text-[var(--ct-text-strong)]">
        {gas.toLocaleString("en-US")}{" "}
        <span className="text-[var(--ct-text-muted)]">
          (${usd.toFixed(2)})
        </span>
      </span>
    </div>
  );
}

function StateDiffSection({ entries }: { entries: StateDiffEntry[] }) {
  return (
    <div className="space-y-2">
      <SectionLabel>State diff</SectionLabel>
      {entries.length === 0 ? (
        <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)]">
          No storage changes detected.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry, i) => (
            <li
              key={i}
              className="rounded-[var(--ct-radius-md)] border border-[var(--ct-border-soft)] bg-[var(--ct-surface-1)] px-3 py-2.5 space-y-1"
            >
              <p className="mono text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)] truncate">
                {entry.contract}
              </p>
              <p className="mono text-[length:var(--ct-text-micro)] text-[var(--ct-text-faint)] truncate">
                slot {entry.slot.slice(0, 18)}…
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="mono text-[length:var(--ct-text-micro)] text-[var(--ct-text-faint)]"
                  title={entry.before}
                >
                  {truncateHex(entry.before)}
                </span>
                <span
                  className="text-[length:var(--ct-text-micro)] text-[var(--ct-text-faint)]"
                  aria-hidden="true"
                >
                  →
                </span>
                <span
                  className="mono text-[length:var(--ct-text-micro)] text-[var(--ct-accent)]"
                  title={entry.after}
                >
                  {truncateHex(entry.after)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BalanceDeltaSection({ entries }: { entries: BalanceDeltaEntry[] }) {
  return (
    <div className="space-y-2">
      <SectionLabel>Balance delta</SectionLabel>
      {entries.length === 0 ? (
        <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)]">
          No balance changes.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry, i) => {
            const delta = entry.after - entry.before;
            const isPositive = delta >= 0;
            return (
              <li
                key={i}
                className="flex items-center justify-between gap-4 rounded-[var(--ct-radius-md)] border border-[var(--ct-border-soft)] bg-[var(--ct-surface-1)] px-3 py-2"
              >
                <span className="mono text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)] truncate">
                  {entry.address.slice(0, 10)}…
                </span>
                <span
                  className={cn(
                    "mono tabular-nums text-[length:var(--ct-text-xs)]",
                    isPositive
                      ? "text-[var(--ct-accent)]"
                      : "text-[var(--ct-status-danger)]",
                  )}
                >
                  {isPositive ? "+" : ""}
                  {delta.toLocaleString("en-US")} wei
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function RevertsSection({ entries }: { entries: RevertEntry[] }) {
  return (
    <div
      role="alert"
      className="space-y-2"
      aria-label="Simulation reverts detected"
    >
      <SectionLabel className="text-[var(--ct-status-danger)]">
        Reverts ({entries.length})
      </SectionLabel>
      <ul className="space-y-2">
        {entries.map((entry, i) => (
          <li
            key={i}
            className="rounded-[var(--ct-radius-md)] border border-[var(--ct-status-danger-border)] bg-[var(--ct-status-danger-soft)] px-3 py-2.5"
          >
            <p className="text-[length:var(--ct-text-xs)] font-medium text-[var(--ct-status-danger)]">
              {entry.reason}
            </p>
            <p className="mt-0.5 mono text-[length:var(--ct-text-micro)] text-[var(--ct-text-faint)]">
              PC: {entry.pc}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EventsSection({ entries }: { entries: EventEntry[] }) {
  return (
    <div className="space-y-2">
      <SectionLabel>Events</SectionLabel>
      {entries.length === 0 ? (
        <p className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)]">
          No events emitted.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry, i) => (
            <li
              key={i}
              className="rounded-[var(--ct-radius-md)] border border-[var(--ct-border-soft)] bg-[var(--ct-surface-1)] px-3 py-2.5 space-y-1.5"
            >
              <p className="text-[length:var(--ct-text-xs)] font-semibold text-[var(--ct-text-strong)]">
                {entry.name}
              </p>
              <ul className="space-y-0.5">
                {Object.entries(entry.args).map(([key, val]) => (
                  <li key={key} className="flex gap-2 items-start">
                    <span className="shrink-0 mono text-[length:var(--ct-text-micro)] text-[var(--ct-text-muted)] min-w-20">
                      {key}
                    </span>
                    <span
                      className="mono text-[length:var(--ct-text-micro)] text-[var(--ct-text-faint)] truncate"
                      title={String(val)}
                    >
                      {String(val)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TraceLink() {
  return (
    <div className="pt-1">
      <button
        type="button"
        disabled
        className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)] underline underline-offset-2 opacity-50 cursor-not-allowed"
        title="Full Tenderly trace — available in Phase 2 (requires Tenderly account)"
      >
        ▶ View full trace
      </button>
      <span className="ml-2 text-[length:var(--ct-text-micro)] text-[var(--ct-text-faint)]">
        (P2 — stub only)
      </span>
    </div>
  );
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[length:var(--ct-text-micro)] font-semibold uppercase tracking-[var(--ct-tracking-wide)] text-[var(--ct-text-muted)]",
        className,
      )}
    >
      {children}
    </p>
  );
}

// ── Utils ──────────────────────────────────────────────────────────────────

function truncateHex(hex: string, chars = 10): string {
  if (hex.length <= chars + 2) return hex;
  return `${hex.slice(0, chars + 2)}…`;
}
