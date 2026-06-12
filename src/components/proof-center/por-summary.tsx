import { AwaitingMetricState } from "@/components/portfolio/awaiting-metric-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { Metric } from "@/components/ui/metric";
import { NestedKpiGrid, ProofRow } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { DashboardPanelHeader } from "@/components/ui/system-panel";
import {
  EXPLORER_ADDRESS_BASE,
  EXPLORER_TX_BASE,
} from "@/lib/chain/client";
import type { OnChainAttestation } from "@/lib/chain/por-registry";
import type { CustodySnapshot } from "@/lib/data/custody";
import { abbreviateAddress } from "@/lib/onchain";

interface PorSummaryProps {
  attestation: OnChainAttestation | null;
  custody?: CustodySnapshot | null;
  /**
   * Whether the attestation's signer is verified AND allowlisted (A4). When
   * not `true`, the badge MUST NOT read "Attested" even if the attestation is
   * fresh — an unverified attestation is downgraded to "Stale". Defaults to
   * `false` (fail-closed): callers that cannot prove the signer never get an
   * "Attested" badge.
   */
  verified?: boolean | null;
}

/** Compact date for nested KPI cells — long dates break grid cells. */
const dateCompactFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const timeUtcFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  hour12: false,
});

function formatNestedTimestamp(date: Date): { value: string; sublabel: string } {
  return {
    value: dateCompactFmt.format(date),
    sublabel: `${timeUtcFmt.format(date)} UTC`,
  };
}

function formatPeriod(period: bigint): string {
  const raw = period.toString();
  if (raw.length !== 6) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}


function isStale(ts: Date): boolean {
  const ageMs = Date.now() - ts.getTime();
  return ageMs > 24 * 60 * 60 * 1000;
}

function usdFmt(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function btcFmt(value: number): string {
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(value)} BTC`;
}

function custodyProvenance(snapshot: CustodySnapshot): "attested" | "stale" {
  const live = snapshot.provenance === "live" && snapshot.configured;
  const fresh = !isStale(new Date(snapshot.asOf));
  return live && fresh ? "attested" : "stale";
}

function isCustodyDisplayable(custody: CustodySnapshot): boolean {
  return custody.totalUsdcReserves > 0 && custodyProvenance(custody) === "attested";
}

const CUSTODY_EMPTY_MESSAGE =
  "Custody reserves will appear after the first verified Fireblocks snapshot.";
const CUSTODY_EMPTY_DETAIL =
  "Fireblocks reserve scope must be pinned and a fresh snapshot posted before USDC reserves are shown here.";

/** Standalone custody module (no active PoR card). */
function CustodyAwaiting() {
  return (
    <AwaitingMetricState message={CUSTODY_EMPTY_MESSAGE} detail={CUSTODY_EMPTY_DETAIL} />
  );
}

/** Custody subsection inside an active PoR card (DS §9 — inline nested empty). */
function CustodyAwaitingInline() {
  return (
    <EmptySurface
      variant="inline"
      message={CUSTODY_EMPTY_MESSAGE}
      detail={CUSTODY_EMPTY_DETAIL}
    />
  );
}

function CustodyKpis({ custody }: { custody: CustodySnapshot }) {
  const provenance = custodyProvenance(custody);
  const asOf = new Date(custody.asOf);
  const snapshotTs = formatNestedTimestamp(asOf);
  return (
    <>
      <NestedKpiGrid columns={3}>
        <Metric
          variant="nested"
          label="USDC reserves"
          value={usdFmt(custody.totalUsdcReserves)}
        />
        <Metric
          variant="nested"
          label="Vault accounts"
          value={custody.accountsCount.toString()}
        />
        <Metric
          variant="nested"
          label="Snapshot at"
          value={snapshotTs.value}
          sublabel={snapshotTs.sublabel}
        />
      </NestedKpiGrid>
      {provenance === "stale" ? (
        <p className="mt-3 body-xs ct-status-warning">
          {custody.provenance === "live" && !custody.configured
            ? "Reserve scope not pinned (FIREBLOCKS_VAULT_ACCOUNT_IDS unset) — badge shows Stale."
            : "Custody snapshot is unverified or older than 24h — badge shows Stale."}
        </p>
      ) : null}
    </>
  );
}

/** Standalone custody card when PoR attestation is absent (DS §9 — separate active surface). */
function CustodyCard({ custody }: { custody: CustodySnapshot }) {
  const provenance = custodyProvenance(custody);
  return (
    <Card>
      <DashboardPanelHeader
        title="Custody (Fireblocks)"
        provenance={provenance}
        tone="primary"
      />
      <CustodyKpis custody={custody} />
    </Card>
  );
}

/** Custody section nested inside an active PoR card (divider, not a second card). */
function CustodyBlock({ custody }: { custody: CustodySnapshot }) {
  const provenance = custodyProvenance(custody);
  return (
    <div className="mt-6 border-t border-[var(--ct-border-soft)] pt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="eyebrow">Custody (Fireblocks)</span>
        <ProvenanceBadge kind={provenance} />
      </div>
      <CustodyKpis custody={custody} />
    </div>
  );
}

export function PorSummary({
  attestation,
  custody = null,
  verified = false,
}: PorSummaryProps) {
  if (attestation === null) {
    return (
      <>
        <AwaitingMetricState
          message="No on-chain Proof of Reserves attestation yet."
          detail="Contracts are live on Base Sepolia — the publisher will post the first attestation after the initial vault period closes."
        />
        {custody ? (
          isCustodyDisplayable(custody) ? (
            <CustodyCard custody={custody} />
          ) : (
            <CustodyAwaiting />
          )
        ) : null}
      </>
    );
  }

  const stale = isStale(attestation.timestamp);
  // A4 — "Attested" requires BOTH freshness AND a verified, allowlisted signer.
  // An unverified or stale attestation is downgraded to "Stale".
  const provenance = !stale && verified === true ? "attested" : "stale";

  return (
    <Card>
      <DashboardPanelHeader
        eyebrow="Proof of Reserves"
        title={`Period ${formatPeriod(attestation.period)} — Attestation #${attestation.attestationId.toString()}`}
        provenance={provenance}
        tone="primary"
      />

      <NestedKpiGrid columns={4}>
        <Metric variant="nested" label="Total AUM" value={usdFmt(attestation.totalAumUsd)} />
        <Metric variant="nested" label="Mined (period)" value={btcFmt(attestation.minedBtc)} />
        <Metric
          variant="nested"
          label="Attested at"
          value={formatNestedTimestamp(attestation.timestamp).value}
          sublabel={formatNestedTimestamp(attestation.timestamp).sublabel}
        />
        <Metric variant="nested" label="Period" value={formatPeriod(attestation.period)} />
      </NestedKpiGrid>

      <div className="mt-6 border-t border-[var(--ct-border-soft)] pt-2">
        <ProofRow label="Attestor address">
          <a
            href={`${EXPLORER_ADDRESS_BASE}${attestation.attestor}`}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:ct-text-strong transition-colors duration-[var(--ct-dur-fast)]"
            title={attestation.attestor}
          >
            {abbreviateAddress(attestation.attestor)}
          </a>
        </ProofRow>
        <ProofRow label="Evidence hash">
          <span title={attestation.evidenceHash}>
            {abbreviateAddress(attestation.evidenceHash)}
          </span>
        </ProofRow>
        <ProofRow label="Block">{attestation.blockNumber.toString()}</ProofRow>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button asChild variant="secondary" size="md">
          <a
            href={`${EXPLORER_TX_BASE}${attestation.txHash}`}
            target="_blank"
            rel="noreferrer noopener"
          >
            View attestation tx on Base Sepolia
          </a>
        </Button>
        {attestation.evidenceCid.length > 0 ? (
          <Button asChild variant="secondary" size="md">
            <a
              href={
                attestation.evidenceCid.startsWith("ipfs://")
                  ? `https://ipfs.io/ipfs/${attestation.evidenceCid.slice(7)}`
                  : attestation.evidenceCid.startsWith("https://")
                    ? attestation.evidenceCid
                    : `https://ipfs.io/ipfs/${attestation.evidenceCid}`
              }
              target="_blank"
              rel="noreferrer noopener"
            >
              View evidence (IPFS)
            </a>
          </Button>
        ) : null}
      </div>

      {stale ? (
        <p className="mt-3 body-xs ct-status-warning">
          Last attestation is older than 24h — badge shows Stale. A fresh
          attestation is expected each period close.
        </p>
      ) : verified !== true ? (
        <p className="mt-3 body-xs ct-status-warning">
          Attestation signer is not yet verified against the allowlist — badge
          shows Stale until the signature is confirmed.
        </p>
      ) : null}

      {custody ? (
        isCustodyDisplayable(custody) ? (
          <CustodyBlock custody={custody} />
        ) : (
          <div className="mt-6 border-t border-[var(--ct-border-soft)] pt-6">
            <CustodyAwaitingInline />
          </div>
        )
      ) : null}
    </Card>
  );
}
