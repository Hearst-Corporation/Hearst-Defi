import "./profile.css";

import Link from "next/link";

import { requireInvestor } from "@/lib/auth/require-investor";
import { getInvestor } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
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
          {investor && (
            <Badge variant={kycBadgeVariant(investor.kycStatus)}>
              {kycLabel(investor.kycStatus)}
            </Badge>
          )}
          <Badge variant="accent">Investor</Badge>
        </div>
      </div>

      {/* ── Account details ── */}
      <div className="dash-cell prof-card-details">
        <p className="dash-label">Account</p>

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
                ? shortAddress(session.walletAddress)
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
        <p className="dash-label">
          Investment summary
          {/* A3 — no "Live" badge when there are no positions to back it. */}
          <ProvenanceBadge kind={positions.length === 0 ? "stale" : "live"} />
        </p>

        <div className="prof-stats">
          <div className="prof-stat">
            <span className="prof-stat-value">
              {positions.length}
            </span>
            <span className="stat-label">Active positions</span>
          </div>

          <div className="prof-stat-sep" />

          <div className="prof-stat">
            <span className="prof-stat-value">
              {totalDeployed > 0
                ? new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(totalDeployed)
                : "—"}
            </span>
            <span className="stat-label">Total deployed</span>
          </div>

          <div className="prof-stat-sep" />

          <div className="prof-stat">
            <span className="prof-stat-value">
              {firstSubAt ? formatDate(firstSubAt) : "—"}
            </span>
            <span className="stat-label">First subscription</span>
          </div>
        </div>
      </div>

      {/* ── Security ── */}
      <div className="dash-cell prof-card-security">
        <p className="dash-label">Security</p>

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
                  ? shortAddress(session.walletAddress)
                  : "Required for deposits — connect at subscription time"}
              </span>
            </div>
            {session.walletAddress ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Button variant="primary" size="md" asChild>
                <Link href="/onboarding/wallet?step=wallet">Connect</Link>
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
              <Button variant="primary" size="md" asChild>
                <Link href="/onboarding/identity?step=identity">Continue</Link>
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
