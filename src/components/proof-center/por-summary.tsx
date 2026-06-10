import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { NestedKpiGrid } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
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

function CustodyBlock({ custody }: { custody: CustodySnapshot }) {
  const provenance = custodyProvenance(custody);
  const asOf = new Date(custody.asOf);
  const snapshotTs = formatNestedTimestamp(asOf);
  return (
    <div className="mt-6 border-t border-[var(--ct-border-soft)] pt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="eyebrow">Custody (Fireblocks)</span>
        <ProvenanceBadge kind={provenance} />
      </div>
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
      <Card>
        <CardHeader>
          <CardTitle>Proof of Reserves</CardTitle>
          <ProvenanceBadge kind="manual" />
        </CardHeader>
        <p className="body-sm">
          No on-chain Proof of Reserves attestation yet. Contracts are live on
          Base Sepolia — the publisher will post the first attestation after the
          initial vault period closes.
        </p>
        {custody ? <CustodyBlock custody={custody} /> : null}
      </Card>
    );
  }

  const stale = isStale(attestation.timestamp);
  // A4 — "Attested" requires BOTH freshness AND a verified, allowlisted signer.
  // An unverified or stale attestation is downgraded to "Stale".
  const provenance = !stale && verified === true ? "attested" : "stale";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Proof of Reserves</span>
          <CardTitle>
            Period {formatPeriod(attestation.period)} — Attestation #
            {attestation.attestationId.toString()}
          </CardTitle>
        </div>
        <ProvenanceBadge kind={provenance} />
      </CardHeader>

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

      <dl className="mt-6 space-y-2 border-t border-[var(--ct-border-soft)] pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <dt className="body-xs">Attestor address</dt>
          <dd>
            <a
              href={`${EXPLORER_ADDRESS_BASE}${attestation.attestor}`}
              target="_blank"
              rel="noreferrer noopener"
              className="mono tabular text-xs ct-text-primary hover:ct-text-strong transition-colors duration-[var(--ct-dur-fast)]"
              title={attestation.attestor}
            >
              {abbreviateAddress(attestation.attestor)}
            </a>
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <dt className="body-xs">Evidence hash</dt>
          <dd
            className="mono tabular text-xs ct-text-body"
            title={attestation.evidenceHash}
          >
            {abbreviateAddress(attestation.evidenceHash)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <dt className="body-xs">Block</dt>
          <dd className="mono tabular text-xs ct-text-body">
            {attestation.blockNumber.toString()}
          </dd>
        </div>
      </dl>

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

      {custody ? <CustodyBlock custody={custody} /> : null}
    </Card>
  );
}
