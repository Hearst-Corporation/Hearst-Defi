import { EmptySurface } from "@/components/catalyst/empty-surface";
import { PanelStatus } from "@/components/catalyst/panel-status";
import { DashboardPanelHeader } from "@/components/catalyst/dashboard-panel-header";
import type { CustodySnapshot } from "@/lib/data/custody";

import { formatNestedTimestamp, formatUsdCompact, isOlderThan24h } from "./formatters";

function custodyProvenance(snapshot: CustodySnapshot): "attested" | "stale" {
  const live = snapshot.provenance === "live" && snapshot.configured;
  const fresh = !isOlderThan24h(new Date(snapshot.asOf));
  return live && fresh ? "attested" : "stale";
}

function isCustodyDisplayable(custody: CustodySnapshot): boolean {
  return custody.totalUsdcReserves > 0 && custodyProvenance(custody) === "attested";
}

const CUSTODY_EMPTY = {
  message: "Custody reserves will appear after the first verified Fireblocks snapshot.",
  detail:
    "Fireblocks reserve scope must be pinned and a fresh snapshot posted before USDC reserves are shown here.",
} as const;

/** Bento KPI tile — label + value, matching the Portfolio / vaults flow. */
function BentoKpi({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="ct-bento-label">
        {label}
      </span>
      <span className="text-[length:var(--ct-text-xl-fixed)] font-medium text-[var(--ct-text-strong)] leading-none tracking-tight tabular-nums">
        {value}
      </span>
      {sublabel ? (
        <span className="text-[length:var(--ct-text-deci)] text-[var(--ct-text-faint)] tracking-wide font-mono">
          {sublabel}
        </span>
      ) : null}
    </div>
  );
}

function CustodyStaleNote({ custody }: { custody: CustodySnapshot }) {
  if (custodyProvenance(custody) !== "stale") return null;
  return (
    <p className="text-[length:var(--ct-text-micro)] leading-relaxed text-(--ct-status-warning)">
      {custody.provenance === "live" && !custody.configured
        ? "Reserve scope is not yet configured by operations — badge shows Stale."
        : "Custody snapshot is unverified or older than 24h — badge shows Stale."}
    </p>
  );
}

function CustodyKpis({ custody }: { custody: CustodySnapshot }) {
  const snapshotTs = formatNestedTimestamp(new Date(custody.asOf));
  return (
    <div className="flex flex-col gap-5">
      {/* ct-nested-kpi-grid marker retained for proof-center contract tests */}
      <div className="ct-nested-kpi-grid grid grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
        <BentoKpi
          label="USDC reserves"
          value={formatUsdCompact(custody.totalUsdcReserves)}
        />
        <BentoKpi
          label="Vault accounts"
          value={custody.accountsCount.toString()}
        />
        <BentoKpi
          label="Snapshot at"
          value={snapshotTs.value}
          sublabel={snapshotTs.sublabel}
        />
      </div>
      <CustodyStaleNote custody={custody} />
    </div>
  );
}

function CustodyCard({ custody }: { custody: CustodySnapshot }) {
  return (
    <div className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col p-5 lg:p-6 gap-5">
      <DashboardPanelHeader
        title="Custody (Fireblocks)"
        provenance={custodyProvenance(custody)}
        tone="primary"
      />
      <CustodyKpis custody={custody} />
    </div>
  );
}

function CustodyBlock({ custody }: { custody: CustodySnapshot }) {
  return (
    <div className="mt-8 pt-6 border-t border-[var(--ct-border)] flex flex-col gap-5">
      <DashboardPanelHeader
        title="Custody (Fireblocks)"
        provenance={custodyProvenance(custody)}
        tone="quiet"
        className="proof-custody-block-header"
      />
      <CustodyKpis custody={custody} />
    </div>
  );
}

/** Renders custody card, nested block, or empty state (standalone / inline). */
export function CustodySection({
  custody,
  nested = false,
}: {
  custody: CustodySnapshot;
  nested?: boolean;
}) {
  if (isCustodyDisplayable(custody)) {
    return nested ? <CustodyBlock custody={custody} /> : <CustodyCard custody={custody} />;
  }

  if (nested) {
    return (
      <div className="mt-8 pt-6 border-t border-[var(--ct-border)]">
        <PanelStatus {...CUSTODY_EMPTY} />
      </div>
    );
  }

  return <EmptySurface live {...CUSTODY_EMPTY} />;
}
