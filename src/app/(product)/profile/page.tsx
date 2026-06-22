import "./profile.css";

import Link from "next/link";

import { cn } from "@/lib/cn";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import { ProfileSecurityRow } from "@/components/profile/profile-security-row";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getInvestor } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { abbreviateAddress } from "@/lib/onchain";
import { profileDisplayName } from "@/lib/profile/display-name";
import { formatProfileDate } from "@/lib/profile/format-date";
import { eligibilityVerdict, kycBadgeVariant, kycLabel } from "@/lib/profile/kyc-display";
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
import { PrivyWalletConnect } from "@/components/onboarding/privy-wallet-connect";
import { WalletDisconnectButton } from "@/components/profile/wallet-disconnect-button";
import { PRIVY_APP_ID } from "@/lib/auth/privy-config";

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
  const kycStatus = investor?.kycStatus ?? "";
  const kycApproved = kycStatus === "approved";
  const kycPending = kycStatus === "pending";
  const kycRejected = kycStatus === "rejected";

  const verdict = eligibilityVerdict({
    kycApproved,
    accreditationAttested: Boolean(investor?.accreditationAttestedAt),
    walletLinked: Boolean(session.walletAddress),
  });

  return (
    <div className="prof-shell" data-testid="profile-page">
      <ProductPageHeader
        titleLead="Welcome back,"
        titleAccent={profileDisplayName(session.email)}
        contextLabel="Investor Profile"
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

      <p
        className={cn(
          "body-sm prof-verdict",
          verdict.eligible ? "ct-text-accent" : "ct-text-faint",
        )}
        data-testid="profile-eligibility-verdict"
      >
        {verdict.label}
      </p>

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
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/onboarding/accreditation">Attest now →</Link>
                </Button>
              )}
            </LegalMetadataRow>
          </div>

          <div className="doc-page-disclaimer">
            <p className="body-xs ct-text-faint prof-disclaimer">
              Product eligibility depends on accreditation, KYC approval, and
              jurisdictional restrictions.
            </p>
          </div>
        </Card>

        <Card aria-labelledby="prof-summary-label" hoverOverlay={false}>
          {hasPositions ? (
            <>
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
            </>
          ) : (
            <>
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
                <Button variant="secondary" size="md" asChild className="prof-summary-cta">
                  <Link href="/vaults" aria-label="Explore the vault">
                    Explore the vault
                  </Link>
                </Button>
              </EmptySurface>
            </>
          )}
        </Card>

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
                  : "Connect the wallet that will receive your USDC distributions. Optional — you can also connect at deposit time."
              }
              action={
                session.walletAddress ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">Connected</Badge>
                    <WalletDisconnectButton />
                  </div>
                ) : (
                  <PrivyWalletConnect
                    appId={PRIVY_APP_ID}
                    boundAddress={null}
                  />
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
