import "./profile.css";

import Link from "next/link";

import { requireInvestor } from "@/lib/auth/require-investor";
import { getInvestor } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { abbreviateAddress } from "@/lib/onchain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Metric } from "@/components/ui/metric";
import { NestedKpiGrid } from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profile",
  description: "Your account and identity",
};

function kycBadgeVariant(status: string): "success" | "warning" | "danger" | "default" {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "danger";
  return "default";
}

function kycLabel(status: string): string {
  if (status === "approved") return "KYC Approved";
  if (status === "pending") return "KYC Pending";
  if (status === "rejected") return "KYC Rejected";
  return status;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}


export default async function ProfilePage() {
  const [session, investor] = await Promise.all([requireInvestor("/profile"), getInvestor()]);

  const positions = investor
    ? await prisma.position.findMany({
        where: { investorId: investor.id, status: "active" },
        select: { principalUsdc: true, subscribedAt: true },
        orderBy: { subscribedAt: "asc" },
      })
    : [];

  const totalDeployed = positions.reduce(
    (acc, p) => acc + Number(p.principalUsdc),
    0,
  );

  const firstSubAt = positions[0]?.subscribedAt ?? null;
  const hasPositions = positions.length > 0;

  return (
    <div className="prof-page">
      {/* ── Identity card ── */}
      <div className="dash-cell prof-card-identity">
        <div className="prof-avatar" aria-hidden="true">
          {session.email.charAt(0).toUpperCase()}
        </div>

        <div className="prof-identity-body">
          <h1 className="h1 prof-name">{session.email}</h1>
          <span className="eyebrow prof-role">{session.role}</span>
        </div>

        <div className="prof-identity-badges">
          <Badge variant="accent">Investor</Badge>
        </div>
      </div>

      {/* ── Account details ── */}
      <div className="dash-cell prof-card-details">
        <h2 className="h2 m-0">Account</h2>

        <dl className="prof-dl">
          <div className="prof-dl-row">
            <dt>Email</dt>
            <dd>{session.email}</dd>
          </div>

          <div className="prof-dl-row">
            <dt>Member since</dt>
            <dd>
              {investor ? formatDate(investor.createdAt) : "—"}
            </dd>
          </div>

          <div className="prof-dl-row">
            <dt>Wallet</dt>
            <dd className="mono">
              {session.walletAddress
                ? abbreviateAddress(session.walletAddress)
                : <span className="prof-empty">Not connected</span>}
            </dd>
          </div>

          <div className="prof-dl-row">
            <dt>KYC status</dt>
            <dd>
              {investor ? (
                <Badge variant={kycBadgeVariant(investor.kycStatus)}>
                  {kycLabel(investor.kycStatus)}
                </Badge>
              ) : "—"}
            </dd>
          </div>
        </dl>
      </div>

      {/* ── Investment summary ── */}
      <div className="dash-cell prof-card-summary">
        <div className="flex items-center justify-between gap-2">
          <h2 className="h2 m-0">Investment summary</h2>
          {/* A3 — no "Live" badge when there are no positions to back it; no data at all ≠ stale data. */}
          <ProvenanceBadge kind={positions.length === 0 ? "manual" : "live"} />
        </div>

        {hasPositions ? (
          <NestedKpiGrid columns={3} className="prof-stats">
            <Metric
              variant="nested"
              label="Active positions"
              value={positions.length}
            />
            <Metric
              variant="nested"
              label="Total deployed"
              value={new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(totalDeployed)}
            />
            <Metric
              variant="nested"
              label="First subscription"
              value={
                firstSubAt ? formatDate(firstSubAt) : "Awaiting subscription"
              }
            />
          </NestedKpiGrid>
        ) : (
          <div className="mt-3 flex flex-col items-start gap-3 rounded-lg border border-dashed border-(--ct-border-soft) ct-surface-1 p-4">
            <p className="body-sm ct-text-primary font-semibold">
              Your investment summary starts after your first active position.
            </p>
            <p className="body-xs ct-text-muted">
              Once a deposit is confirmed, deployed capital and subscription history appear here.
            </p>
            <Button variant="primary" size="md" asChild>
              <Link href="/vaults">Explore the vault</Link>
            </Button>
          </div>
        )}
      </div>

      {/* ── Security ── */}
      <div className="dash-cell prof-card-security">
        <h2 className="h2 m-0">Security</h2>

        <ul className="prof-security-list">
          <li className="prof-security-row">
            <span className="prof-security-dot" data-status="ok" />
            <div className="prof-security-body">
              <span className="prof-security-name">Email / password</span>
              <span className="prof-security-desc">Active authentication method</span>
            </div>
            <Badge variant="success">Active</Badge>
          </li>

          <li className="prof-security-row">
            <span
              className="prof-security-dot"
              data-status={session.walletAddress ? "ok" : "off"}
            />
            <div className="prof-security-body">
              <span className="prof-security-name">Wallet connection</span>
              <span className="prof-security-desc">
                {session.walletAddress
                  ? abbreviateAddress(session.walletAddress)
                  : "Required for deposits — connect at subscription time"}
              </span>
            </div>
            {session.walletAddress ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Button variant="secondary" size="md" asChild>
                <Link href="/onboarding/wallet">Connect</Link>
              </Button>
            )}
          </li>

          <li className="prof-security-row">
            <span
              className="prof-security-dot"
              data-status={investor?.kycStatus === "approved" ? "ok" : "warn"}
            />
            <div className="prof-security-body">
              <span className="prof-security-name">Identity verification (KYC)</span>
              <span className="prof-security-desc">
                {investor?.kycStatus === "approved"
                  ? "Verified — full access enabled"
                  : "Under review — contact support if delayed"}
              </span>
            </div>
            {investor?.kycStatus === "approved" ? (
              <Badge variant="success">Approved</Badge>
            ) : (
              <Button variant="secondary" size="md" asChild>
                <Link href="/onboarding/identity">Continue</Link>
              </Button>
            )}
          </li>
        </ul>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </div>
      <footer className="mt-8">
        <p className="body-xs ct-text-faint max-w-2xl">
          APY ranges are target projections based on stated assumptions — they are
          not a commitment of future returns. Past performance does not predict
          future results.
        </p>
      </footer>
    </div>
  );
}
