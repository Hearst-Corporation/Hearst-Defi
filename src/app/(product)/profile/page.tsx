import Link from "next/link";

import { cn } from "@/lib/cn";
import { ProfileSecurityRow } from "@/components/profile/profile-security-row";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import {
  BentoDetailRow,
  BentoHeader,
  BentoKpiTile,
  BentoPageShell,
  BentoPanel,
} from "@/components/catalyst/bento";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getInvestor } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { abbreviateAddress } from "@/lib/onchain";
import { profileDisplayName } from "@/lib/profile/display-name";
import { formatProfileDate } from "@/lib/profile/format-date";
import { eligibilityVerdict, kycBadgeVariant, kycLabel } from "@/lib/profile/kyc-display";
import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
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
    <BentoPageShell testId="profile-page">
      <ProductPageHeader
        titleLead="Investor"
        titleAccent="Profile"
        contextLabel="HYV · Account"
        titleRowEnd={
          <Badge variant={session.role === "admin" ? "default" : "accent"}>
            {session.role === "admin" ? "Admin" : "Investor"}
          </Badge>
        }
        media={
          <div
            className="ct-glass-panel flex size-14 shrink-0 items-center justify-center text-[20px] font-semibold ct-text-accent"
            aria-hidden="true"
          >
            {session.email.charAt(0).toUpperCase()}
          </div>
        }
      >
        <div className="flex flex-col gap-1">
          <span className="ct-bento-label">Welcome back</span>
          <div className="ct-bento-metric">{profileDisplayName(session.email)}</div>
          <p
            className={cn(
              "ct-metric-caption",
              verdict.eligible ? "ct-text-accent" : "ct-text-muted",
            )}
            data-testid="profile-eligibility-verdict"
          >
            {verdict.label}
          </p>
        </div>
      </ProductPageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <BentoPanel aria-labelledby="prof-account-label">
          <BentoHeader id="prof-account-label" title="Identity" as="h2" />
          <div className="px-5">
            <BentoDetailRow label="Member since">
              {investor ? formatProfileDate(investor.createdAt) : "—"}
            </BentoDetailRow>
            <BentoDetailRow label="Wallet">
              {session.walletAddress ? (
                abbreviateAddress(session.walletAddress)
              ) : (
                <span className="font-normal italic ct-text-muted">Not connected</span>
              )}
            </BentoDetailRow>
            <BentoDetailRow label="KYC status">
              {investor ? (
                <Badge variant={kycBadgeVariant(investor.kycStatus)}>
                  {kycLabel(investor.kycStatus)}
                </Badge>
              ) : (
                "—"
              )}
            </BentoDetailRow>
            <BentoDetailRow label="Accreditation">
              {investor?.accreditationAttestedAt ? (
                <>Attested {formatProfileDate(investor.accreditationAttestedAt)}</>
              ) : (
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/onboarding/accreditation">Attest now →</Link>
                </Button>
              )}
            </BentoDetailRow>
          </div>
          <p className="ct-metric-caption p-5 pt-0 leading-relaxed">
            Product eligibility depends on accreditation, KYC approval, and
            jurisdictional restrictions.
          </p>
        </BentoPanel>

        <BentoPanel aria-labelledby="prof-summary-label">
          <BentoHeader id="prof-summary-label" title="Investment summary"
            trailing={hasPositions ? <Badge variant="success">Live</Badge> : undefined}
          />
          {hasPositions ? (
            <div className="grid grid-cols-1 border-b ct-bento-divider ct-bento-inset-band sm:grid-cols-2">
              <BentoKpiTile
                className="border-b sm:border-b-0 sm:border-r ct-bento-divider"
                label="Active positions"
                value={positions.length}
              />
              <BentoKpiTile
                className="border-b sm:border-b-0 ct-bento-divider"
                label="Total deployed"
                value={formatUsdCompact(totalDeployed)}
              />
              <BentoKpiTile
                className="sm:col-span-2 sm:border-t ct-bento-divider"
                label="First subscription"
                value={firstSubAt ? formatProfileDate(firstSubAt) : "Awaiting subscription"}
              />
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="ct-section-title">
                Your investment summary starts after your first active position.
              </p>
              <p className="ct-metric-caption max-w-sm leading-relaxed">
                Once a deposit is confirmed, deployed capital and subscription history appear here.
              </p>
              <Button variant="secondary" size="md" asChild className="mt-2">
                <Link href="/vaults" aria-label="Explore the vault">
                  Explore the vault
                </Link>
              </Button>
            </div>
          )}
        </BentoPanel>
      </div>

      <BentoPanel aria-labelledby="prof-security-label">
        <BentoHeader id="prof-security-label" title="Security" />
        <div className="divide-y ct-bento-divider" role="list">
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
                  surface="bare"
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
        <div className="flex justify-end border-t p-5 ct-bento-divider">
          <SignOutButton />
        </div>
      </BentoPanel>
    </BentoPageShell>
  );
}
