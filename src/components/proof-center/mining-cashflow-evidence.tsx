import { MINING_CASHFLOW_COPY } from "@/components/proof/empty-messages";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import type { CoverageView } from "@/lib/engine/coverage-view";

import type { ProofCenterSectionLedProps } from "./proof-center-types";

const BADGE: Record<CoverageView["provenance"], "live" | "estimated" | "manual" | "stale"> = {
  live: "live",
  estimated: "estimated",
  pending: "manual",
  invalid: "stale",
};

const HEADER = {
  eyebrow: "Mining cash-flow evidence",
  title: "Yield source — Bitcoin mining revenue",
} as const;

const PANEL_CLASS =
  "rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm overflow-hidden flex flex-col";

/** Bento section header — title (h3) + subtitle + provenance badge. */
function BentoHeader({
  sectionLed,
  eyebrow,
  title,
  provenance,
}: {
  sectionLed: boolean;
  eyebrow: string;
  title: string;
  provenance: "live" | "estimated" | "manual" | "stale";
}) {
  return (
    <div className="flex items-end justify-between p-5 border-b border-[var(--ct-border-soft)]">
      <div className="flex flex-col gap-1.5">
        {/* sectionLed: the visible page <h2> owns the section title; the panel
            shows only its h3 subtitle + provenance. */}
        {!sectionLed ? (
          <h3 className="text-[length:var(--ct-text-micro)] font-bold text-[var(--ct-text-muted)] uppercase tracking-[0.15em] leading-none m-0">
            {eyebrow}
          </h3>
        ) : null}
        <p className="text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)] tracking-wide m-0">{title}</p>
      </div>
      <ProvenanceBadge kind={provenance} />
    </div>
  );
}

/** A single KPI cell on the bento grid. */
function KpiCell({
  label,
  value,
  sublabel,
  accent = false,
  className,
}: {
  label: string;
  value: string;
  sublabel: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 p-5", className)}>
      <dt className="ct-bento-label">
        {label}
      </dt>
      <dd
        className={cn(
          "text-[18px] font-medium leading-none tracking-tight tabular-nums m-0",
          accent ? "text-[var(--ct-accent)]" : "text-white",
        )}
      >
        {value}
      </dd>
      <p className="ct-bento-label m-0">
        {sublabel}
      </p>
    </div>
  );
}

export function MiningCashFlowEvidence({
  coverage,
  sectionLed = false,
  bare = false,
}: {
  coverage?: CoverageView | null;
} & ProofCenterSectionLedProps) {
  const provenance = coverage?.provenance ?? "pending";

  // Pending / invalid — render the FULL instrument shell (header + provenance +
  // a status line) rather than a bare empty surface, so the panel reads as an
  // instrument awaiting attestation, never broken-empty.
  // No fake Live/Verified: badge is Manual (pending) / Stale (invalid).
  if (provenance === "pending" || provenance === "invalid") {
    const pending = (
      <>
        {!bare && (
          <BentoHeader
            sectionLed={sectionLed}
            eyebrow={sectionLed ? HEADER.eyebrow : "Awaiting attestation"}
            title={sectionLed ? HEADER.title : "Mining Revenue"}
            provenance={BADGE[provenance]}
          />
        )}
        <p className="p-5 text-[length:var(--ct-text-xs)] leading-relaxed text-[var(--ct-text-muted)] m-0" role="status">
          {MINING_CASHFLOW_COPY[provenance]}
        </p>
      </>
    );
    return bare ? (
      pending
    ) : (
      <section className={PANEL_CLASS} aria-label="Mining cash-flow evidence — awaiting attestation">
        {pending}
      </section>
    );
  }

  const ratioLabel =
    coverage?.ratio !== null && coverage?.ratio !== undefined
      ? `${coverage.ratio.toFixed(2)}×`
      : "Pending";

  const inner = (
    <>
      {!bare && (
        <BentoHeader
          sectionLed={sectionLed}
          eyebrow={sectionLed ? HEADER.eyebrow : "Yield Evidence"}
          title={sectionLed ? HEADER.title : "Mining Revenue"}
          provenance={BADGE[provenance]}
        />
      )}

      <p className="p-5 text-[length:var(--ct-text-xs)] leading-relaxed text-[var(--ct-text-muted)] border-b border-[var(--ct-border-soft)] m-0">
        {MINING_CASHFLOW_COPY[provenance]}
      </p>

      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-surface-inset">
        <KpiCell
          label="Distribution coverage"
          value={ratioLabel}
          sublabel="net mining cash ÷ target"
          accent
          className="border-b border-[var(--ct-border-soft)] sm:border-r lg:border-r"
        />
        <KpiCell
          label="State"
          value={coverage?.state ?? "invalid"}
          sublabel={coverage?.recommendation.action ?? "—"}
          className="border-b border-[var(--ct-border-soft)] lg:border-r"
        />
        <KpiCell
          label="Latest revenue period"
          value={coverage?.period ?? "—"}
          sublabel={coverage?.lastUpdated ? "as of attestation" : "awaiting first close"}
          className="border-b border-[var(--ct-border-soft)] sm:border-r sm:border-b-0 lg:border-r"
        />
        <KpiCell
          label="Attestation status"
          value={provenance === "live" ? "Attested" : "Pending"}
          sublabel="mining partner + pool"
        />
      </dl>
    </>
  );
  return bare ? inner : <section className={PANEL_CLASS}>{inner}</section>;
}
