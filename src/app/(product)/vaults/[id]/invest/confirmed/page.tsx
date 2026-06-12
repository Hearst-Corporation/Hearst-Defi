// /vaults/[id]/invest/confirmed — Step 4 of 4: Institutional confirmation
//
// Non-negotiable #2: Provenance grouped — not on every row.
// Non-negotiable #5: no forbidden words.
// Non-negotiable #10: "not guaranteed" disclaimer.

import Link from "next/link";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { Button } from "@/components/ui/button";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { DepositSuccessIcon } from "@/components/vaults/deposit-success-icon";
import { StepProgress } from "@/components/vaults/step-progress";
import { OpsContactCard } from "@/components/onboarding/OpsContactCard";
import { getIrContact } from "@/lib/ir-contact";
import { CopyAddressButton } from "./copy-address-button";
import { abbreviateAddress } from "@/lib/onchain";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Deposit Confirmed — Hearst Yield Vault",
};

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tx?: string;
    amount?: string;
    positionId?: string;
    email?: string;
  }>;
}

function fmtUsdc(raw: string | undefined): string {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (isNaN(n) || n <= 0) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function buildIcsDataUri(title: string, date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hearst Connect//EN",
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${ymd}`,
    `DTEND;VALUE=DATE:${ymd}`,
    `SUMMARY:${title}`,
    "DESCRIPTION:Hearst Yield Vault — USDC distribution. Target projection based on stated assumptions.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

const VAULT_CONTRACT =
  process.env.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS ??
  process.env.NEXT_PUBLIC_HEARST_VAULT_ADDRESS ??
  null;

function DetailRow({
  label,
  value,
  action,
}: {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-[var(--ct-border-soft)] last:border-0">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="eyebrow ct-text-muted">{label}</span>
        <span className="tabular mono text-sm ct-text-primary">{value}</span>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export default async function ConfirmedPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  const txHash = sp.tx ?? null;
  const amount = fmtUsdc(sp.amount);
  const positionId = sp.positionId ?? null;
  const email = sp.email ?? null;

  const hasHash = txHash !== null && txHash.length > 6;
  const baseScanHref = hasHash
    ? `https://sepolia.basescan.org/tx/${txHash}`
    : "https://sepolia.basescan.org";

  const LOCK_DAYS = 60;
  const currentDay = 0;
  const unlockDate = daysFromNow(LOCK_DAYS);

  const today = new Date();
  const nextDistrib = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const icsUri = buildIcsDataUri("Hearst Yield Vault — Distribution", nextDistrib);

  const hasOnChainProof = hasHash && positionId;
  const irContact = getIrContact();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8">
      <StepProgress active="confirmed" />

      <div className="flex flex-col gap-6">
        <ProductPageHeader
          align="center"
          lead={<DepositSuccessIcon />}
          title={amount !== "—" ? `${amount} deposited` : "Deposit recorded"}
          description={
            hasOnChainProof
              ? "Your position has been recorded on-chain. Details below."
              : "Your subscription request is recorded. On-chain confirmation may still be pending."
          }
        />

        <div className="rounded-lg border border-[var(--ct-border-soft)] ct-surface-1 p-5">
          <div className="flex items-center justify-between gap-2 pb-3 mb-1 border-b border-[var(--ct-border-soft)]">
            <p className="eyebrow">Position details</p>
            <div className="body-xs ct-text-faint flex items-center gap-1">
              <ProvenanceBadge kind={hasHash ? "manual" : "estimated"} />
            </div>
          </div>

          <DetailRow
            label="Transaction"
            value={hasHash ? abbreviateAddress(txHash) : "Pending confirmation"}
            action={
              hasHash ? (
                <a
                  href={baseScanHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="body-xs text-[var(--ct-accent-strong)] no-underline hover:underline font-medium"
                  aria-label="View transaction on Base Sepolia (opens in new tab)"
                >
                  BaseScan ↗
                </a>
              ) : undefined
            }
          />

          {VAULT_CONTRACT ? (
            <DetailRow
              label="Vault contract"
              value={abbreviateAddress(VAULT_CONTRACT)}
              action={<CopyAddressButton address={VAULT_CONTRACT} />}
            />
          ) : null}

          <DetailRow label="NAV at entry" value="1.0000 USDC / share" />

          {positionId ? (
            <DetailRow label="Position ID" value={positionId} />
          ) : null}

          <div className="py-2.5 border-b border-[var(--ct-border-soft)]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="eyebrow ct-text-muted">Soft-lock</span>
              <span className="body-xs ct-text-muted">
                Day {currentDay} of {LOCK_DAYS} · unlock {fmtDate(unlockDate)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={currentDay}
              aria-valuemin={0}
              aria-valuemax={LOCK_DAYS}
              aria-label={`Soft-lock: day ${currentDay} of ${LOCK_DAYS}`}
              className="ct-lock-track"
            >
              <div
                className="h-full rounded-full bg-[var(--ct-accent)] transition-[width] duration-[var(--ct-dur-slow)] ease-in-out"
                style={{
                  width: `${Math.round((currentDay / LOCK_DAYS) * 100)}%`,
                  minWidth: currentDay > 0 ? "var(--ct-space-1)" : "0",
                }}
              />
            </div>
          </div>

          <DetailRow
            label="Next distribution"
            value={fmtDate(nextDistrib)}
            action={
              <a
                href={icsUri}
                download="hearst-distribution.ics"
                className="body-xs text-[var(--ct-accent-strong)] no-underline hover:underline font-medium"
                aria-label="Add distribution date to calendar (.ics download)"
              >
                Add to calendar
              </a>
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="eyebrow ct-text-muted">Next steps</p>
          <ul className="body-sm ct-text-body space-y-1 list-disc pl-4">
            <li>Track your position and distributions in Portfolio</li>
            <li>Review attestations in Proof Center</li>
            <li>Contact IR if you need settlement support</li>
          </ul>
        </div>

        {irContact ? (
          <OpsContactCard
            name={irContact.name}
            title={irContact.title}
            email={irContact.email}
            calendlyHref={irContact.calendlyHref}
          />
        ) : null}

        <div className="flex flex-col gap-3">
          <Button variant="primary" size="lg" asChild className="w-full font-bold">
            <Link href={positionId ? `/portfolio/${positionId}` : "/portfolio"}>
              Go to portfolio
            </Link>
          </Button>
          <Button variant="ghost" size="md" asChild className="w-full">
            <Link href="/vaults">View other products</Link>
          </Button>
        </div>

        <p className="body-xs ct-text-muted text-center">
          {email
            ? `Receipt and Methodology v1.0 PDF sent to ${email}`
            : "Receipt and Methodology v1.0 PDF sent to your registered email"}
        </p>

        <p className="body-xs ct-text-faint text-center text-pretty">
          APY ranges are target projections based on stated assumptions — not a
          commitment of future returns. Subject to vault conditions and Methodology
          v1.0.{" "}
          <span className="tabular mono ct-text-muted">Vault {id}</span>
        </p>
      </div>
    </div>
  );
}
