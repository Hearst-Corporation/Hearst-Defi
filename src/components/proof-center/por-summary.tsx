import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  EXPLORER_ADDRESS_BASE,
  EXPLORER_TX_BASE,
} from "@/lib/chain/client";
import type { OnChainAttestation } from "@/lib/chain/por-registry";
import type { CustodySnapshot } from "@/lib/data/custody";
import { cn } from "@/lib/cn";
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

const dateFmt = new Intl.DateTimeFormat("en-US", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "UTC",
});

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
  return (
    <div className="mt-6 border-t border-[var(--ct-border-soft)] pt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="eyebrow">Custody (Fireblocks)</span>
        <ProvenanceBadge kind={provenance} />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 items-start">
        <Metric
          label="USDC reserves"
          value={usdFmt(custody.totalUsdcReserves)}
          provenance={provenance}
        />
        <Metric
          label="Vault accounts"
          value={custody.accountsCount.toString()}
          provenance={provenance}
        />
        <Metric
          label="Snapshot at"
          value={dateFmt.format(asOf)}
          sublabel="UTC"
          provenance={provenance}
        />
      </div>
      {provenance === "stale" ? (
        <p className="mt-3 body-xs text-[var(--ct-status-warning)]">
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

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 items-start">
        <Metric
          label="Total AUM"
          value={usdFmt(attestation.totalAumUsd)}
          provenance={provenance}
        />
        <Metric
          label="Mined (period)"
          value={btcFmt(attestation.minedBtc)}
          provenance={provenance}
        />
        <Metric
          label="Attested at"
          value={dateFmt.format(attestation.timestamp)}
          sublabel="UTC"
          provenance={provenance}
        />
        <Metric
          label="Period"
          value={formatPeriod(attestation.period)}
          provenance={provenance}
        />
      </div>

      <dl className="mt-6 space-y-2 border-t border-[var(--ct-border-soft)] pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <dt className="body-xs">Attestor address</dt>
          <dd>
            <a
              href={`${EXPLORER_ADDRESS_BASE}${attestation.attestor}`}
              target="_blank"
              rel="noreferrer noopener"
              className="mono tabular text-xs text-[var(--ct-text-primary)] hover:text-[var(--ct-text-strong)] transition-colors duration-[var(--ct-dur-fast)]"
              title={attestation.attestor}
            >
              {abbreviateAddress(attestation.attestor)}
            </a>
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <dt className="body-xs">Evidence hash</dt>
          <dd
            className="mono tabular text-xs text-[var(--ct-text-body)]"
            title={attestation.evidenceHash}
          >
            {abbreviateAddress(attestation.evidenceHash)}
          </dd>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <dt className="body-xs">Block</dt>
          <dd className="mono tabular text-xs text-[var(--ct-text-body)]">
            {attestation.blockNumber.toString()}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href={`${EXPLORER_TX_BASE}${attestation.txHash}`}
          target="_blank"
          rel="noreferrer noopener"
          className={cn(
            "rounded-[var(--ct-radius-full)] border border-[var(--ct-text-strong)] bg-[var(--ct-surface-1)]",
            "px-3 py-1.5 text-xs text-[var(--ct-text-strong)]",
            "transition-colors duration-[var(--ct-dur-fast)] hover:bg-[var(--ct-surface-2)]",
            "focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]",
          )}
        >
          View attestation tx on Base Sepolia
        </a>
        {attestation.evidenceCid.length > 0 ? (
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
            className={cn(
              "rounded-[var(--ct-radius-full)] border border-[var(--ct-border-strong)] bg-[var(--ct-surface-1)]",
              "px-3 py-1.5 text-xs text-[var(--ct-text-primary)]",
              "transition-colors duration-[var(--ct-dur-fast)] hover:bg-[var(--ct-surface-3)]",
              "focus-visible:outline-none focus-visible:shadow-[var(--ct-shadow-focus-ring)]",
            )}
          >
            View evidence (IPFS)
          </a>
        ) : null}
      </div>

      {stale ? (
        <p className="mt-3 body-xs text-[var(--ct-status-warning)]">
          Last attestation is older than 24h — badge shows Stale. A fresh
          attestation is expected each period close.
        </p>
      ) : verified !== true ? (
        <p className="mt-3 body-xs text-[var(--ct-status-warning)]">
          Attestation signer is not yet verified against the allowlist — badge
          shows Stale until the signature is confirmed.
        </p>
      ) : null}

      {custody ? <CustodyBlock custody={custody} /> : null}
    </Card>
  );
}
