import Link from "next/link";

import { cn } from "@/lib/cn";
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
    <div
      className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 [--gutter:theme(spacing.8)] mb-8"
      data-testid="profile-page"
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">

        {/* HERO */}
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between pb-3 border-b border-white/10 gap-4">
            <h1 className="text-[13px] font-semibold text-white uppercase tracking-wider">Investor Profile</h1>
            <Badge variant={session.role === "admin" ? "default" : "accent"}>
              {session.role === "admin" ? "Admin" : "Investor"}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black text-[20px] font-semibold text-[#A7FB90]"
              aria-hidden="true"
            >
              {session.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Welcome back</div>
              <div className="text-[22px] font-medium text-white leading-none tracking-tight truncate">
                {profileDisplayName(session.email)}
              </div>
              <p
                className={cn(
                  "text-[12px] font-medium tracking-wide mt-1",
                  verdict.eligible ? "text-[#A7FB90]" : "text-zinc-500",
                )}
                data-testid="profile-eligibility-verdict"
              >
                {verdict.label}
              </p>
            </div>
          </div>
        </section>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* IDENTITY PANEL */}
          <section
            className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col"
            aria-labelledby="prof-account-label"
          >
            <div className="p-5 border-b border-white/5">
              <h2 id="prof-account-label" className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
                Identity
              </h2>
            </div>

            <div className="px-5 flex flex-col">
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-[13px] text-zinc-400">Member since</span>
                <span className="text-[13px] font-medium text-white">
                  {investor ? formatProfileDate(investor.createdAt) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-[13px] text-zinc-400">Wallet</span>
                <span className="text-[13px] font-medium text-white">
                  {session.walletAddress
                    ? abbreviateAddress(session.walletAddress)
                    : <span className="text-zinc-500 italic font-normal">Not connected</span>}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-[13px] text-zinc-400">KYC status</span>
                <span className="text-[13px] font-medium text-white">
                  {investor ? (
                    <Badge variant={kycBadgeVariant(investor.kycStatus)}>
                      {kycLabel(investor.kycStatus)}
                    </Badge>
                  ) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-[13px] text-zinc-400">Accreditation</span>
                <span className="text-[13px] font-medium text-white">
                  {investor?.accreditationAttestedAt ? (
                    <>Attested {formatProfileDate(investor.accreditationAttestedAt)}</>
                  ) : (
                    <Button variant="secondary" size="sm" asChild>
                      <Link href="/onboarding/accreditation">Attest now →</Link>
                    </Button>
                  )}
                </span>
              </div>
            </div>

            <div className="p-5 mt-auto">
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Product eligibility depends on accreditation, KYC approval, and
                jurisdictional restrictions.
              </p>
            </div>
          </section>

          {/* INVESTMENT SUMMARY PANEL */}
          <section
            className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col"
            aria-labelledby="prof-summary-label"
          >
            <div className="flex items-end justify-between p-5 border-b border-white/5">
              <h2 id="prof-summary-label" className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
                Investment summary
              </h2>
              {hasPositions ? (
                <Badge variant="success">Live</Badge>
              ) : null}
            </div>

            {hasPositions ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-white/5 bg-[#15191C]">
                <div className="flex flex-col gap-2 p-5 sm:px-6 border-b sm:border-b-0 sm:border-r border-white/5">
                  <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Active positions</div>
                  <div className="text-[22px] font-medium text-white leading-none tracking-tight">{positions.length}</div>
                </div>
                <div className="flex flex-col gap-2 p-5 sm:px-6 border-b sm:border-b-0 border-white/5">
                  <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">Total deployed</div>
                  <div className="text-[22px] font-medium text-white leading-none tracking-tight">{formatUsdCompact(totalDeployed)}</div>
                </div>
                <div className="flex flex-col gap-2 p-5 sm:px-6 sm:col-span-2 sm:border-t border-white/5">
                  <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">First subscription</div>
                  <div className="text-[22px] font-medium text-white leading-none tracking-tight">
                    {firstSubAt ? formatProfileDate(firstSubAt) : "Awaiting subscription"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="text-[13px] font-medium text-zinc-300">
                  Your investment summary starts after your first active position.
                </p>
                <p className="text-[12px] text-zinc-500 leading-relaxed max-w-sm">
                  Once a deposit is confirmed, deployed capital and subscription history appear here.
                </p>
                <Button variant="secondary" size="md" asChild className="mt-2">
                  <Link href="/vaults" aria-label="Explore the vault">
                    Explore the vault
                  </Link>
                </Button>
              </div>
            )}
          </section>
        </div>

        {/* SECURITY PANEL */}
        <section
          className="rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col"
          aria-labelledby="prof-security-label"
        >
          <div className="p-5 border-b border-white/5">
            <h2 id="prof-security-label" className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
              Security
            </h2>
          </div>

          <div className="divide-y divide-white/5" role="list">
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

          <div className="flex justify-end p-5 border-t border-white/5">
            <SignOutButton />
          </div>
        </section>

      </div>
    </div>
  );
}
