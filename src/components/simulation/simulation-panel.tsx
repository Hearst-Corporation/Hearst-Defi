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
import { Card } from "@/components/ui/card";
import { NestedPanel } from "@/components/ui/nested-panel";
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
//   --ct-accent        : "after" value (vert var(--ct-accent) — changed)
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
    <Card
      hoverOverlay={false}
      className={cn(
        "flex flex-col gap-[var(--ct-space-5)]",
        className,
      )}
      aria-busy={loading ? "true" : "false"}
      aria-label="Pre-execution simulation panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-[var(--ct-space-3)]">
        <h3 className="h3">
          Simulation Preview
        </h3>
        {result && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 body-xs font-medium border",
              result.ok
                ? "ct-bc-success ct-status-success-bg ct-status-success"
                : "ct-bc-danger ct-status-danger-bg ct-status-danger",
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
        <div className="flex flex-col gap-[var(--ct-space-6)]">
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
    </Card>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Divider() {
  return (
    <hr className="border-t border-(--ct-border-soft)" aria-hidden="true" />
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center gap-[var(--ct-space-3)] py-[var(--ct-space-10)]">
      {/* Spinner */}
      <span
        className="block h-8 w-8 rounded-full border-2 border-(--ct-border-soft) border-t-(--ct-accent) animate-spin"
        aria-hidden="true"
      />
      <p className="body-sm ct-text-muted">
        Simulating on fork…
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="ct-nested-callout flex flex-col gap-1 border border-(--ct-border-soft)">
      <p className="body-sm font-medium ct-status-danger">
        Simulation failed
      </p>
      <p className="body-xs ct-text-muted">
        {message}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <p className="body-sm ct-text-faint text-center py-[var(--ct-space-8)]">
      No simulation run yet. Click <strong className="ct-text-muted">Simulate</strong> to preview execution.
    </p>
  );
}

function GasRow({ gas, usd }: { gas: number; usd: number }) {
  return (
    <div className="flex items-baseline justify-between gap-[var(--ct-space-4)]">
      <span className="stat-label">
        Gas estimate
      </span>
      <span className="mono tabular-nums body-sm ct-text-strong">
        {gas.toLocaleString("en-US")}{" "}
        <span className="ct-text-muted">
          (${usd.toFixed(2)})
        </span>
      </span>
    </div>
  );
}

function StateDiffSection({ entries }: { entries: StateDiffEntry[] }) {
  return (
    <div className="flex flex-col gap-[var(--ct-space-2)]">
      <SectionLabel>State diff</SectionLabel>
      {entries.length === 0 ? (
        <p className="body-xs ct-text-faint">
          No storage changes detected.
        </p>
      ) : (
        <ul className="flex flex-col gap-[var(--ct-space-2)]">
          {entries.map((entry, i) => (
            <li
              key={i}
              className="ct-nested-callout flex flex-col gap-1"
            >
              <p className="mono body-xs truncate">
                {entry.contract}
              </p>
              <p className="mono body-xs ct-text-faint truncate">
                slot {entry.slot.slice(0, 18)}…
              </p>
              <div className="flex items-center gap-[var(--ct-space-2)] flex-wrap">
                <span
                  className="mono body-xs ct-text-faint"
                  title={entry.before}
                >
                  {truncateHex(entry.before)}
                </span>
                <span
                  className="body-xs ct-text-faint"
                  aria-hidden="true"
                >
                  →
                </span>
                <span
                  className="mono body-xs ct-text-accent"
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
    <div className="flex flex-col gap-[var(--ct-space-2)]">
      <SectionLabel>Balance delta</SectionLabel>
      {entries.length === 0 ? (
        <p className="body-xs ct-text-faint">
          No balance changes.
        </p>
      ) : (
        <ul className="flex flex-col gap-[var(--ct-space-2)]">
          {entries.map((entry, i) => {
            const delta = entry.after - entry.before;
            const isPositive = delta >= 0;
            return (
              <li key={i}>
                <NestedPanel className="flex items-center justify-between gap-[var(--ct-space-4)]">
                  <span className="mono body-xs truncate">
                    {entry.address.slice(0, 10)}…
                  </span>
                  <span
                    className={cn(
                      "mono tabular-nums body-xs",
                      isPositive
                        ? "ct-text-accent"
                        : "ct-status-danger",
                    )}
                  >
                    {isPositive ? "+" : ""}
                    {delta.toLocaleString("en-US")} wei
                  </span>
                </NestedPanel>
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
      className="flex flex-col gap-[var(--ct-space-2)]"
      aria-label="Simulation reverts detected"
    >
      <SectionLabel className="ct-status-danger">
        Reverts ({entries.length})
      </SectionLabel>
      <ul className="flex flex-col gap-[var(--ct-space-2)]">
        {entries.map((entry, i) => (
          <li
            key={i}
            className="ct-nested-callout flex flex-col gap-0.5 border border-(--ct-border-soft)"
          >
            <p className="body-xs font-medium ct-status-danger">
              {entry.reason}
            </p>
            <p className="mono body-xs ct-text-faint">
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
    <div className="flex flex-col gap-[var(--ct-space-2)]">
      <SectionLabel>Events</SectionLabel>
      {entries.length === 0 ? (
        <p className="body-xs ct-text-faint">
          No events emitted.
        </p>
      ) : (
        <ul className="flex flex-col gap-[var(--ct-space-2)]">
          {entries.map((entry, i) => (
            <li
              key={i}
              className="ct-nested-callout flex flex-col gap-1.5"
            >
              <p className="body-xs font-semibold ct-text-strong">
                {entry.name}
              </p>
              <ul className="flex flex-col gap-0.5">
                {Object.entries(entry.args).map(([key, val]) => (
                  <li key={key} className="flex gap-[var(--ct-space-2)] items-start">
                    <span className="shrink-0 mono body-xs min-w-20">
                      {key}
                    </span>
                    <span
                      className="mono body-xs ct-text-faint truncate"
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
        className="body-xs ct-text-muted underline underline-offset-2 opacity-[var(--ct-opacity-50)] cursor-not-allowed"
        title="Full Tenderly trace — available in Phase 2 (requires Tenderly account)"
      >
        ▶ View full trace
      </button>
      <span className="ml-[var(--ct-space-2)] body-xs ct-text-faint">
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
    <p className={cn("stat-label", className)}>
      {children}
    </p>
  );
}

// ── Utils ──────────────────────────────────────────────────────────────────

function truncateHex(hex: string, chars = 10): string {
  if (hex.length <= chars + 2) return hex;
  return `${hex.slice(0, chars + 2)}…`;
}
