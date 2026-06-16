import "./profile.css";

import Link from "next/link";

import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProfileSecurityRow } from "@/components/profile/profile-security-row";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getInvestor } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { abbreviateAddress } from "@/lib/onchain";
import { profileDisplayName } from "@/lib/profile/display-name";
import { formatProfileDate } from "@/lib/profile/format-date";
import { kycBadgeVariant, kycLabel } from "@/lib/profile/kyc-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardPanelHeader } from "@/components/ui/dashboard-panel-header";
import { EmptySurface } from "@/components/ui/empty-surface";
import { Metric } from "@/components/ui/metric";
import {
  DataRow,
  LegalMetadataRow,
  MetricGrid,
} from "@/components/ui/nested-panel";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { DemoDataBanner } from "@/components/product/demo-data-banner";
import { investorHasDemoPosition } from "@/lib/dev/investor-demo-visible";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profile",
  description: "Your account and identity",
};

export default async function ProfilePage() {
  const [session, investor] = await Promise.all([requireInvestor("/profile"), getInvestor()]);

  const [positions, showDemoBanner] = investor
    ? await Promise.all([
        prisma.position.findMany({
          where: { investorId: investor.id, status: "active" },
          select: { principalUsdc: true, subscribedAt: true },
          orderBy: { subscribedAt: "asc" },
        }),
        investorHasDemoPosition(investor.id),
      ])
    : [[], false];

  const totalDeployed = positions.reduce(
    (acc, p) => acc + Number(p.principalUsdc),
    0,
  );

  const firstSubAt = positions[0]?.subscribedAt ?? null;
  const hasPositions = positions.length > 0;
  const kycStatus = investor?.kycStatus ?? "";
  const kycApproved = kycStatus === "approved";
  const kycPending = kycStatus === "pending";
  const kycRejected = kycStatus === "rejected";

  return (
    <div className="prof-shell product-doc-shell" data-testid="profile-page">
      {showDemoBanner ? <DemoDataBanner /> : null}

      <ProductPageHeader
        eyebrow="Investor profile"
        title={profileDisplayName(session.email)}
        description={session.email}
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

      <div className="prof-grid">
        <Card aria-labelledby="prof-account-label" hoverOverlay={false}>
          <DashboardPanelHeader
            id="prof-account-label"
            title="Identity"
            tone="quiet"
          />

          <div>
            <DataRow label="Member since">
              {investor ? formatProfileDate(investor.createdAt) : "—"}
            </DataRow>
            <DataRow label="Wallet">
              {session.walletAddress
                ? abbreviateAddress(session.walletAddress)
                : <span className="ct-text-faint italic">Not connected</span>}
            </DataRow>
            <LegalMetadataRow label="KYC status">
              {investor ? (
                <Badge variant={kycBadgeVariant(investor.kycStatus)}>
                  {kycLabel(investor.kycStatus)}
                </Badge>
              ) : "—"}
            </LegalMetadataRow>
            <LegalMetadataRow label="Accreditation">
              {investor?.accreditationAttestedAt ? (
                <>Attested {formatProfileDate(investor.accreditationAttestedAt)}</>
              ) : (
                <span className="ct-text-faint italic">Not attested</span>
              )}
            </LegalMetadataRow>
          </div>

          <div className="product-doc-footer-rule">
            <p className="body-xs ct-text-faint ct-prose-xl prof-disclaimer">
              Profile information reflects your investor account status. Product
              eligibility depends on accreditation, KYC approval, and jurisdictional
              restrictions.
            </p>
          </div>
        </Card>

        {hasPositions ? (
          <Card aria-labelledby="prof-summary-label" hoverOverlay={false}>
            <DashboardPanelHeader
              id="prof-summary-label"
              title="Investment summary"
              provenance="live"
              tone="primary"
            />

            <MetricGrid columns={2}>
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
            </MetricGrid>
          </Card>
        ) : (
          <Card aria-labelledby="prof-summary-label" hoverOverlay={false}>
            <DashboardPanelHeader
              id="prof-summary-label"
              title="Investment summary"
              tone="quiet"
            />
            <EmptySurface
              variant="inline"
              className="h-full"
              message="Your investment summary starts after your first active position."
              detail="Once a deposit is confirmed, deployed capital and subscription history appear here."
            >
              <Button variant="secondary" size="md" asChild className="mt-2">
                <Link href="/vaults" aria-label="Explore the vault">
                  Explore the vault
                </Link>
              </Button>
            </EmptySurface>
          </Card>
        )}

        <Card className="prof-security-card" aria-labelledby="prof-security-label" hoverOverlay={false}>
          <DashboardPanelHeader
            id="prof-security-label"
            title="Security"
            tone="quiet"
          />

          <div className="ct-divide-soft" role="list">
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
                  ? "Wallet connected — ready for deposits"
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
                  : kycRejected
                    ? "Verification did not pass — contact support to resubmit"
                    : kycPending
                      ? "Documents submitted — review typically completes within 2 business days"
                      : "Complete identity verification to subscribe"
              }
              action={
                kycApproved ? (
                  <Badge variant="success">Approved</Badge>
                ) : kycRejected ? (
                  <Badge variant="danger">Rejected</Badge>
                ) : kycPending ? (
                  <Badge variant="warning">Pending</Badge>
                ) : (
                  <Button variant="secondary" size="md" asChild>
                    <Link href="/onboarding/identity">Continue</Link>
                  </Button>
                )
              }
            />
          </div>

          <div className="prof-signout">
            <SignOutButton />
          </div>
        </Card>
      </div>

    </div>
  );
}
