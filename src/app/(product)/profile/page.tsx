import "./profile.css";

import Link from "next/link";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProfileSecurityRow } from "@/components/profile/profile-security-row";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getInvestor } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatUsdCompact } from "@/lib/format/usd-compact";
import { abbreviateAddress } from "@/lib/onchain";
import { profileDisplayName } from "@/lib/profile/display-name";
import { formatProfileDate } from "@/lib/profile/format-date";
import { kycBadgeVariant, kycLabel } from "@/lib/profile/kyc-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import {
  NestedCallout,
  NestedKpiGrid,
  ProofRow,
} from "@/components/ui/nested-panel";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profile",
  description: "Your account and identity",
};

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
  const kycApproved = investor?.kycStatus === "approved";

  return (
    <div className="space-y-8" data-testid="profile-page">
      <ProductPageHeader
        eyebrow="Account"
        title={profileDisplayName(session.email)}
        description={<span className="mono tabular-nums">{session.email}</span>}
        actions={
          <Badge variant={session.role === "admin" ? "default" : "accent"}>
            {session.role === "admin" ? "Admin" : "Investor"}
          </Badge>
        }
        media={
          <div className="prof-avatar" aria-hidden="true">
            {session.email.charAt(0).toUpperCase()}
          </div>
        }
      />

      <div className="dash-bento">
        <Card className="bento-col-6" aria-labelledby="prof-account-label">
          <CardTitle id="prof-account-label">Account</CardTitle>

          <ProofRow label="Email">{session.email}</ProofRow>
          <ProofRow label="Member since">
            {investor ? formatProfileDate(investor.createdAt) : "—"}
          </ProofRow>
          <ProofRow label="Wallet">
            {session.walletAddress
              ? abbreviateAddress(session.walletAddress)
              : <span className="prof-empty">Not connected</span>}
          </ProofRow>
          <ProofRow label="KYC status">
            {investor ? (
              <Badge variant={kycBadgeVariant(investor.kycStatus)}>
                {kycLabel(investor.kycStatus)}
              </Badge>
            ) : "—"}
          </ProofRow>
        </Card>

        <Card className="bento-col-6" aria-labelledby="prof-summary-label">
          <div className="prof-card-header">
            <CardTitle id="prof-summary-label">Investment summary</CardTitle>
            <ProvenanceBadge kind={positions.length === 0 ? "manual" : "live"} />
          </div>

          {hasPositions ? (
            <NestedKpiGrid columns={2}>
              <Metric variant="nested" label="Active positions" value={positions.length} />
              <Metric
                variant="nested"
                label="Total deployed"
                value={formatUsdCompact(totalDeployed)}
              />
              <Metric
                variant="nested"
                label="First subscription"
                value={
                  firstSubAt ? formatProfileDate(firstSubAt) : "Awaiting subscription"
                }
              />
            </NestedKpiGrid>
          ) : (
            <NestedCallout>
              <p className="body-sm ct-text-primary">
                Your investment summary starts after your first active position.
              </p>
              <p className="body-xs ct-text-muted">
                Once a deposit is confirmed, deployed capital and subscription history appear here.
              </p>
              <Button variant="primary" size="lg" asChild>
                <Link href="/vaults">Explore the vault</Link>
              </Button>
            </NestedCallout>
          )}
        </Card>

        <Card className="bento-col-12" aria-labelledby="prof-security-label">
          <CardTitle id="prof-security-label">Security</CardTitle>

          <ul className="prof-security-list">
            <ProfileSecurityRow
              status="ok"
              title="Email / password"
              description="Active authentication method"
              action={<Badge variant="success">Active</Badge>}
            />
            <ProfileSecurityRow
              status={session.walletAddress ? "ok" : "off"}
              title="Wallet connection"
              description={
                session.walletAddress
                  ? abbreviateAddress(session.walletAddress)
                  : "Required for deposits — connect at subscription time"
              }
              action={
                session.walletAddress ? (
                  <Badge variant="success">Connected</Badge>
                ) : (
                  <Button variant="secondary" size="md" asChild>
                    <Link href="/onboarding/wallet">Connect</Link>
                  </Button>
                )
              }
            />
            <ProfileSecurityRow
              status={kycApproved ? "ok" : "warn"}
              title="Identity verification (KYC)"
              description={
                kycApproved
                  ? "Verified — full access enabled"
                  : "Under review — contact support if delayed"
              }
              action={
                kycApproved ? (
                  <Badge variant="success">Approved</Badge>
                ) : (
                  <Button variant="secondary" size="md" asChild>
                    <Link href="/onboarding/identity">Continue</Link>
                  </Button>
                )
              }
            />
          </ul>

          <div className="prof-signout">
            <SignOutButton />
          </div>
        </Card>
      </div>

      <footer>
        <p className="body-xs ct-text-faint prof-disclaimer">
          APY ranges are target projections based on stated assumptions — they are
          not a commitment of future returns. Past performance does not predict
          future results.
        </p>
      </footer>
    </div>
  );
}
