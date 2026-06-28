/**
 * HcAssumptionLedger — key / value / provenance ledger for assumptions.
 *
 * Every row carries an HcSourceBadge so a configured assumption is always shown
 * as configured, never as live. Values are rendered verbatim (tabular) — the
 * ledger never recomputes or reformats a number. Optional per-row display rules
 * (e.g. "shown as range, never single point") render as notes.
 */

import { HcSourceBadge } from "./HcSourceBadge";
import type { HcAssumption } from "./types";

export interface HcAssumptionLedgerProps {
  assumptions: readonly HcAssumption[];
  /** e.g. "CONFIGURED — code defaults, not audited" (from ProjectionAssumptionsConfig.status). */
  configStatus?: string;
  "aria-label": string;
}

export function HcAssumptionLedger({
  assumptions,
  configStatus,
  ...rest
}: HcAssumptionLedgerProps) {
  const ariaLabel = rest["aria-label"];
  const rulesNotes = assumptions.filter((a) => a.displayRule);

  return (
    <div aria-label={ariaLabel} className="flex flex-col">
      {configStatus && (
        <p
          data-hc-config-status="true"
          style={{
            fontSize: "var(--ct-text-deci)",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ct-text-muted)",
            paddingBottom: "var(--ct-space-2)",
            borderBottom: "1px solid var(--ct-border-soft)",
          }}
        >
          {configStatus}
        </p>
      )}

      <dl className="flex flex-col">
        {assumptions.map((a) => (
          <div
            key={a.key}
            className="flex items-center gap-3"
            style={{
              padding: "var(--ct-space-2_5) 0",
              borderBottom: "1px solid var(--ct-border-soft)",
            }}
          >
            <dt
              className="min-w-0 shrink-0 truncate"
              style={{
                flexBasis: "42%",
                fontSize: "var(--ct-text-xs)",
                color: "var(--ct-text-muted)",
              }}
            >
              {a.key}
            </dt>
            <dd
              className="min-w-0 flex-1 truncate"
              style={{
                fontSize: "var(--ct-text-xs)",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                color: "var(--ct-text-primary)",
              }}
            >
              {a.value}
            </dd>
            <HcSourceBadge status={a.source} />
          </div>
        ))}
      </dl>

      {rulesNotes.length > 0 && (
        <ul style={{ marginTop: "var(--ct-space-3)" }}>
          {rulesNotes.map((a) => (
            <li
              key={a.key}
              style={{
                fontSize: "var(--ct-text-deci)",
                color: "var(--ct-text-faint)",
                lineHeight: 1.5,
              }}
            >
              {a.key}: {a.displayRule}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
