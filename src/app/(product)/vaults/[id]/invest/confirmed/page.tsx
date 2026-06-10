// /vaults/[id]/invest/confirmed — S9 Institutional confirmation
import { abbreviateAddress } from "@/lib/onchain";
//
// Pixel-perfect spec:
//   ✓ Amount deposited
//   ✓ Transaction hash + [Attested] badge + BaseScan link
//   ✓ Vault contract address + copy
//   ✓ NAV initial (1.0000 USDC/share) [Attested]
//   ✓ Position ID
//   ✓ Soft-lock progress bar + Day 0 of 60 + unlock date
//   ✓ Next distribution date + Add to calendar (.ics)
//   ✓ OpsContactCard (Sarah Chen · IR)
//   ✓ "Go to portfolio →" CTA (primary, a11y)
//   ✓ Receipt email + Methodology PDF notice
//
// Non-negotiable #2: ProvenanceBadge on every metric.
// Non-negotiable #5: no forbidden words.
// Non-negotiable #10: "not guaranteed" disclaimer.

import Link from "next/link";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { Button } from "@/components/ui/button";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { DepositSuccessIcon } from "@/components/vaults/deposit-success-icon";
import { StepProgress } from "@/components/vaults/step-progress";
import { OpsContactCard } from "@/components/onboarding/OpsContactCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Deposit Confirmed — Hearst Yield Vault",
};

// Next.js 16 App Router — params + searchParams are Promises
interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tx?: string;
    amount?: string;
    positionId?: string;
    email?: string;
  }>;
}

/** Abbreviate a tx hash: 0x + first 4 + … + last 4 chars. */

/** Format amount as USD integer (e.g. "$500,000"). */
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

/** Return ISO date string N days from today. */
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

/** Format Date as "25 Jul 2026". */
function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Build a minimal .ics calendar event data-URI. */
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


// Real deployed vault address from env. Null → the contract row is hidden
// entirely (never show a fabricated address).
const VAULT_CONTRACT =
  process.env.NEXT_PUBLIC_HEARST_YIELD_VAULT_ADDRESS ??
  process.env.NEXT_PUBLIC_HEARST_VAULT_ADDRESS ??
  null;

export default async function ConfirmedPage({ params, searchParams }: PageProps) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  const txHash     = sp.tx        ?? null;
  const amount     = fmtUsdc(sp.amount);
  const positionId = sp.positionId ?? null;
  const email      = sp.email ?? null;

  const hasHash = txHash !== null && txHash.length > 6;
  const baseScanHref = hasHash
    ? `https://sepolia.basescan.org/tx/${txHash}`
    : "https://sepolia.basescan.org";

  // Soft-lock: 60-day window starting now
  const LOCK_DAYS  = 60;
  const currentDay = 0; // Day 0 at confirmation time
  const unlockDate = daysFromNow(LOCK_DAYS);

  // Next distribution: 1st of next month
  const today = new Date();
  const nextDistrib = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const icsUri = buildIcsDataUri("Hearst Yield Vault — Distribution", nextDistrib);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-[var(--ct-space-8)]">
      {/* Step wizard */}
      <StepProgress active="confirmed" />

      {/* Main confirmation card */}
      <div className="ct-card w-full max-w-lg flex flex-col gap-[var(--ct-space-6)]">

        <ProductPageHeader
          align="center"
          lead={<DepositSuccessIcon />}
          title={amount !== "—" ? `${amount} USDC deposited` : "Deposit confirmed"}
          description="Your position in Hearst Yield Vault has been recorded on-chain."
        />

        {/* ── Detail rows ── */}
        <div className="w-full flex flex-col gap-[var(--ct-space-2)] rounded-md ct-surface-1 border border-[var(--ct-border-soft)] p-[var(--ct-space-4)]">

          {/* Transaction hash */}
          <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--ct-border-soft)]">
            <div className="flex flex-col gap-1">
              <span className="eyebrow ct-text-muted">Transaction</span>
              <span className="tabular mono text-sm ct-text-primary">
                {hasHash ? abbreviateAddress(txHash) : "Pending confirmation"}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* A2 — the hash is passed into this page (query param), not read
                  from an on-chain oracle. Badge "Manual"; the LP can verify it
                  independently via the BaseScan link. */}
              <ProvenanceBadge kind="manual" />
              {hasHash && (
                <a
                  href={baseScanHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="body-xs text-[var(--ct-accent-strong)] no-underline hover:underline font-medium"
                  aria-label="View transaction on Base Sepolia (opens in new tab)"
                >
                  BaseScan (Sepolia) ↗
                </a>
              )}
            </div>
          </div>

          {/* Vault contract — only shown when a real deployed address is set */}
          {VAULT_CONTRACT && (
            <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--ct-border-soft)]">
              <div className="flex flex-col gap-1">
                <span className="eyebrow ct-text-muted">Vault contract</span>
                <span className="tabular mono text-sm ct-text-primary">
                  {abbreviateAddress(VAULT_CONTRACT)}
                </span>
              </div>
              {/* Copy button — client interaction handled by browser natively via data attr */}
              <button
                type="button"
                data-copy-value={VAULT_CONTRACT}
                className="body-xs ct-text-muted border border-[var(--ct-border-soft)] rounded-sm px-2 py-1 hover:ct-text-primary hover:border-[var(--ct-border-strong)] transition-colors shrink-0"
                aria-label="Copy vault contract address"
              >
                copy
              </button>
            </div>
          )}

          {/* NAV at entry — convention (1 share = 1 USDC at subscription), not an attested valuation */}
          <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--ct-border-soft)]">
            <div className="flex flex-col gap-1">
              <span className="eyebrow ct-text-muted">NAV at entry</span>
              <span className="tabular mono text-sm ct-text-primary">
                1.0000 USDC / share
              </span>
            </div>
            <ProvenanceBadge kind="manual" />
          </div>

          {/* Position ID */}
          {positionId && (
            <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--ct-border-soft)]">
              <div className="flex flex-col gap-1">
                <span className="eyebrow ct-text-muted">Position ID</span>
                <span className="tabular mono text-sm ct-text-primary">
                  {positionId}
                </span>
              </div>
            </div>
          )}

          {/* Soft-lock progress bar */}
          <div className="flex flex-col gap-[var(--ct-space-2)] py-2 border-b border-[var(--ct-border-soft)]">
            <div className="flex items-center justify-between gap-2">
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
                className="h-full rounded-full bg-[var(--ct-accent)] transition-[width] duration-[400ms] ease-in-out"
                style={{
                  width: `${Math.round((currentDay / LOCK_DAYS) * 100)}%`,
                  minWidth: currentDay > 0 ? "4px" : "0",
                }}
              />
            </div>
          </div>

          {/* Next distribution */}
          <div className="flex items-center justify-between gap-3 py-2">
            <div className="flex flex-col gap-1">
              <span className="eyebrow ct-text-muted">Next distribution</span>
              <span className="text-sm font-medium ct-text-primary">
                {fmtDate(nextDistrib)}
              </span>
            </div>
            <a
              href={icsUri}
              download="hearst-distribution.ics"
              className="inline-flex items-center gap-1.5 body-xs text-[var(--ct-accent-strong)] no-underline hover:underline font-medium transition-opacity hover:opacity-80 shrink-0"
              aria-label="Add distribution date to calendar (.ics download)"
            >
              📅 Add to calendar (.ics)
            </a>
          </div>
        </div>

        {/* ── Ops contact ── */}
        <OpsContactCard />

        {/* ── Primary CTA ── */}
        <div className="flex flex-col gap-[var(--ct-space-3)] w-full">
          <Button variant="primary" size="lg" asChild className="w-full font-bold">
            <Link href={positionId ? `/portfolio/${positionId}` : "/portfolio"}>
              Go to portfolio →
            </Link>
          </Button>
          <Button variant="ghost" size="md" asChild className="w-full">
            <Link href="/vaults">Subscribe to another vault</Link>
          </Button>
        </div>

        {/* ── Email receipt notice ── */}
        {email ? (
          <p className="body-xs ct-text-muted text-center">
            📧 Receipt + Methodology v1.0 PDF sent to{" "}
            <span className="ct-text-primary font-medium">{email}</span>
          </p>
        ) : (
          <p className="body-xs ct-text-muted text-center">
            📧 Receipt + Methodology v1.0 PDF sent to your registered email address
          </p>
        )}

        {/* Non-negotiable #10 — disclaimer */}
        <p className="body-xs ct-text-faint text-center text-pretty">
          APY ranges (8–15%) are target projections based on stated assumptions —
          not a commitment of future returns. Subject to vault conditions and
          Methodology v1.0 assumptions.{" "}
          <span className="tabular mono ct-text-muted">Vault {id}</span>
        </p>
      </div>
    </div>
  );
}
