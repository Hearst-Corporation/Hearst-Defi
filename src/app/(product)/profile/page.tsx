/**
 * /profile — Investor UI V2 Profile screen.
 *
 * Migrated off direct Prisma access (former `prisma.position.findMany(...)`
 * inline in this component) onto the InvestorUiDataSource seam:
 *   Page → ProfileViewModel → ProfileDataSource → fixture / Prisma.
 * See `src/features/investor-ui/data-source/profile-data-source.ts`.
 *
 * Composition: identity summary (hero) + account status + verification +
 * security + preferences + documents + subscription history + activity, as
 * one continuous flow of `AccordionCard` sections on the shared
 * `.ct-glass-panel` surface — not eight identical dispersed cards.
 *
 * Preview: `?state=complete` / `?state=incomplete` selects a deterministic
 * fixture (see `ProfileFixtureState`); any other/absent value resolves the
 * real investor from the DB.
 */
import Link from "next/link";

import { cn } from "@/lib/cn";
import { ProductPageHeader } from "@/components/connect/product-page-header";
import {
  BentoDetailRow,
  BentoHeader,
  BentoKpiTile,
  BentoPageShell,
  BentoPanel,
} from "@/components/catalyst/bento";
import { AccordionCard } from "@/components/catalyst/accordion";
import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";
import {
  DataNotConfigured,
  DataPartial,
  DataUnavailable,
} from "@/features/investor-ui/components/states/data-states";
import { ProfileSecurityRow } from "@/components/profile/profile-security-row";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { DemoResetButton } from "@/components/profile/demo-reset-button";
import { PrivyWalletConnect } from "@/components/onboarding/privy-wallet-connect";
import { WalletDisconnectButton } from "@/components/profile/wallet-disconnect-button";
import { PRIVY_APP_ID } from "@/lib/auth/privy-config";
import { isDevAuthBypass } from "@/lib/dev-bypass";
import { isDemoAccount } from "@/lib/demo/allowlist";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getProfileDataSource } from "@/features/investor-ui/data-source/profile-data-source";
import type { DataStatus } from "@/features/investor-ui/types/common";
import { abbreviateAddress } from "@/lib/onchain";
import { formatUsdCompact } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Profile",
  description: "Your account and identity",
};

/** Bridge from the presentation `DataStatus` to the `ProvenanceBadge` kind
 *  vocabulary. FIXTURE renders as "simulated" — a quiet, non-alarming sandbox
 *  marker distinct from a real LIVE read. */
function toProvenance(status: DataStatus): Provenance {
  switch (status) {
    case "LIVE":
      return "live";
    case "FIXTURE":
      return "simulated";
    case "STALE":
      return "stale";
    case "PARTIAL":
      return "partial";
    case "UNAVAILABLE":
    case "NOT_CONFIGURED":
    case "ERROR":
    default:
      return "estimated";
  }
}

function kycToneBadge(status: "verified" | "pending" | "incomplete" | "restricted") {
  if (status === "verified") return <Badge variant="success">Verified</Badge>;
  if (status === "restricted") return <Badge variant="danger">Restricted</Badge>;
  if (status === "pending") return <Badge variant="warning">Pending</Badge>;
  return <Badge variant="default">Incomplete</Badge>;
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const [session, sp] = await Promise.all([requireInvestor("/profile"), searchParams]);
  const dataSource = getProfileDataSource(session, sp.state ?? null);
  const profile = await dataSource.getProfile();

  const showDemoReset = isDemoAccount(session.email);

  const identity = profile.identity;
  const contact = profile.contact;
  const kyc = profile.kyc;
  const investorStatus = profile.investorStatus;
  const security = profile.security;
  const preferences = profile.preferences;
  const documents = profile.documents;
  const subscriptionHistory = profile.subscriptionHistory;
  const activity = profile.activity;

  const displayName =
    contact.value?.displayName ?? contact.value?.email?.split("@")[0] ?? session.email.split("@")[0];
  const avatarInitial = (displayName ?? session.email).charAt(0).toUpperCase();

  const kycStatus = kyc.value?.status ?? null;
  const walletAddress = identity.value?.walletAddress ?? session.walletAddress;

  const eligible =
    kycStatus === "verified" &&
    Boolean(investorStatus.value?.accredited) &&
    Boolean(walletAddress);

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
            className="ct-glass-panel flex size-14 shrink-0 items-center justify-center text-[length:var(--ct-text-2xl-fixed)] font-semibold ct-text-accent"
            aria-hidden="true"
          >
            {avatarInitial}
          </div>
        }
      >
        <div className="flex flex-col gap-1">
          <span className="ct-bento-label">Welcome back</span>
          <div className="ct-bento-metric">{displayName}</div>
          <p
            className={cn("ct-metric-caption", eligible ? "ct-text-accent" : "ct-text-muted")}
            data-testid="profile-eligibility-verdict"
          >
            {eligible
              ? "Eligible to subscribe"
              : kycStatus !== "verified"
                ? "Action needed: complete KYC"
                : !investorStatus.value?.accredited
                  ? "Action needed: confirm accreditation"
                  : "Action needed: link a wallet"}
          </p>
        </div>
      </ProductPageHeader>

      <div className="flex flex-col gap-5">
        {/* Identity summary + account status — side by side on wide, one
            continuous read on narrow. */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <BentoPanel aria-labelledby="prof-identity-label">
            <BentoHeader
              id="prof-identity-label"
              title="Identity"
              trailing={<ProvenanceBadge kind={toProvenance(contact.status)} compact />}
            />
            {contact.value ? (
              <div className="px-5">
                <BentoDetailRow label="Name">{contact.value.displayName ?? "—"}</BentoDetailRow>
                <BentoDetailRow label="Email">{contact.value.email ?? session.email}</BentoDetailRow>
                <BentoDetailRow label="Entity">
                  {contact.value.entityName ?? (
                    <span className="font-normal italic ct-text-muted">Individual</span>
                  )}
                </BentoDetailRow>
                <BentoDetailRow label="Country">
                  {contact.value.country ?? <span className="font-normal italic ct-text-muted">Not on file</span>}
                </BentoDetailRow>
                <BentoDetailRow label="Wallet">
                  {walletAddress ? (
                    abbreviateAddress(walletAddress)
                  ) : (
                    <span className="font-normal italic ct-text-muted">Not connected</span>
                  )}
                </BentoDetailRow>
              </div>
            ) : (
              <div className="p-5">
                <DataUnavailable label="Identity" />
              </div>
            )}
          </BentoPanel>

          <BentoPanel aria-labelledby="prof-status-label">
            <BentoHeader
              id="prof-status-label"
              title="Account status"
              trailing={<ProvenanceBadge kind={toProvenance(investorStatus.status)} compact />}
            />
            {investorStatus.status === "NOT_CONFIGURED" ? (
              <div className="p-5">
                <DataNotConfigured label="Account status" />
              </div>
            ) : investorStatus.value ? (
              <>
                <div className="px-5">
                  <BentoDetailRow label="KYC">{kycStatus ? kycToneBadge(kycStatus) : "—"}</BentoDetailRow>
                  <BentoDetailRow label="Share class">
                    {investorStatus.value.shareClass ?? (
                      <span className="font-normal italic ct-text-muted">Not assigned</span>
                    )}
                  </BentoDetailRow>
                  <BentoDetailRow label="Accreditation">
                    {investorStatus.value.accredited ? (
                      <Badge variant="success">Attested</Badge>
                    ) : (
                      <Button variant="secondary" size="sm" asChild>
                        <Link href="/onboarding/accreditation">Attest now →</Link>
                      </Button>
                    )}
                  </BentoDetailRow>
                  <BentoDetailRow label="Whitelist">
                    {investorStatus.value.whitelisted == null ? (
                      <span className="font-normal italic ct-text-muted">Not yet indexed</span>
                    ) : investorStatus.value.whitelisted ? (
                      <Badge variant="success">Whitelisted</Badge>
                    ) : (
                      <Badge variant="default">Not whitelisted</Badge>
                    )}
                  </BentoDetailRow>
                </div>
                {investorStatus.status === "PARTIAL" ? (
                  <div className="px-5 pb-5">
                    <DataPartial label="Account status" detail={investorStatus.freshness} />
                  </div>
                ) : null}
              </>
            ) : (
              <div className="p-5">
                <DataUnavailable label="Account status" />
              </div>
            )}
            <p className="ct-metric-caption p-5 pt-0 leading-relaxed">
              Product eligibility depends on accreditation, KYC approval, and jurisdictional restrictions.
            </p>
          </BentoPanel>
        </div>

        {/* Verification — KYC detail, one continuous flow with account status above. */}
        <AccordionCard
          title="Verification"
          subtitle="Identity (KYC) review detail"
          collapsible={false}
          headerTrailing={<ProvenanceBadge kind={toProvenance(kyc.status)} compact />}
        >
          <div className="p-5">
            {kyc.value ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <span className="body-sm font-medium ct-text-body">
                    {kyc.value.status === "verified"
                      ? "Verified — full access enabled"
                      : kyc.value.status === "restricted"
                        ? (kyc.value.reason ?? "Verification did not pass")
                        : kyc.value.status === "pending"
                          ? (kyc.value.reason ?? "Documents submitted — under review")
                          : (kyc.value.reason ?? "Complete identity verification to subscribe")}
                  </span>
                  {kyc.value.submittedAt ? (
                    <span className="body-xs ct-text-faint">
                      Submitted {new Date(kyc.value.submittedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      {kyc.value.reviewedAt
                        ? ` · Reviewed ${new Date(kyc.value.reviewedAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}`
                        : null}
                    </span>
                  ) : null}
                </div>
                <div className="shrink-0">
                  {kyc.value.status === "verified" ? null : (
                    <Button variant="secondary" size="md" asChild>
                      <Link href="/onboarding/identity">Continue</Link>
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <DataUnavailable label="Verification" />
            )}
          </div>
        </AccordionCard>

        {/* Security — auth, wallet, 2FA, sessions. */}
        <AccordionCard
          title="Security"
          subtitle="Authentication and access"
          collapsible={false}
          headerTrailing={<ProvenanceBadge kind={toProvenance(security.status)} compact />}
        >
          <div className="divide-y ct-bento-divider px-5" role="list">
            <ProfileSecurityRow
              status="ok"
              title="Email / password"
              description="Active authentication method"
              action={<Badge variant="success">Active</Badge>}
            />
            <ProfileSecurityRow
              status={walletAddress ? "ok" : "off"}
              title="Wallet connection"
              description={
                walletAddress
                  ? "Wallet connected — ready for deposits"
                  : "Connect the wallet used for your deposit and for delivery of accrued BTC at maturity. Optional — you can also connect at deposit time."
              }
              action={
                walletAddress ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success">Connected</Badge>
                    <WalletDisconnectButton />
                  </div>
                ) : (
                  <PrivyWalletConnect
                    // Must mirror the root layout's provider gate
                    // (isDevAuthBypass ? "" : PRIVY_APP_ID). In a dev-bypass
                    // session the PrivyProvider is a pass-through (no context),
                    // so mounting the Privy consumer with a real appId crashes
                    // inside @privy-io (usePrivy → ref.current undefined). An
                    // empty appId makes PrivyWalletConnect render its own
                    // graceful "not available" fallback instead.
                    appId={isDevAuthBypass() ? "" : PRIVY_APP_ID}
                    boundAddress={null}
                    surface="bare"
                  />
                )
              }
            />
            <ProfileSecurityRow
              status={security.value?.twoFactorEnabled ? "ok" : "off"}
              title="Two-factor authentication"
              description={
                security.value?.twoFactorEnabled == null
                  ? "Not yet available on this account"
                  : security.value.twoFactorEnabled
                    ? "Enabled — an extra step protects sign-in"
                    : "Not enabled"
              }
              action={
                security.value?.twoFactorEnabled == null ? (
                  <Badge variant="default">Not configured</Badge>
                ) : security.value.twoFactorEnabled ? (
                  <Badge variant="success">Enabled</Badge>
                ) : (
                  <Badge variant="default">Off</Badge>
                )
              }
            />
          </div>
          <div className="p-5 pt-0">
            <span className="ct-bento-label">Active sessions</span>
            {security.value && security.value.sessions.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-2" role="list">
                {security.value.sessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 border-b ct-bento-divider py-2 last:border-b-0"
                  >
                    <span className="body-sm ct-text-body">
                      Session started{" "}
                      {new Date(s.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                    {s.current ? <Badge variant="accent">This device</Badge> : <Badge variant="default">Other</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 body-xs ct-text-faint">Session history is not yet tracked.</p>
            )}
          </div>
        </AccordionCard>

        {/* Preferences */}
        <AccordionCard
          title="Preferences"
          subtitle="Notifications"
          collapsible={false}
          headerTrailing={<ProvenanceBadge kind={toProvenance(preferences.status)} compact />}
        >
          <div className="p-5">
            {preferences.status === "NOT_CONFIGURED" || !preferences.value ? (
              <DataNotConfigured
                label="Preferences"
                detail="Notification preferences are not yet persisted for this account."
              />
            ) : (
              <ul className="flex flex-col gap-3" role="list">
                <li className="flex items-center justify-between gap-3">
                  <span className="body-sm ct-text-body">Email notifications</span>
                  <Badge variant={preferences.value.emailNotifications ? "success" : "default"}>
                    {preferences.value.emailNotifications ? "On" : "Off"}
                  </Badge>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="body-sm ct-text-body">Product updates</span>
                  <Badge variant={preferences.value.productUpdates ? "success" : "default"}>
                    {preferences.value.productUpdates ? "On" : "Off"}
                  </Badge>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="body-sm ct-text-body">Security alerts</span>
                  <Badge variant={preferences.value.securityAlerts ? "success" : "default"}>
                    {preferences.value.securityAlerts ? "On" : "Off"}
                  </Badge>
                </li>
              </ul>
            )}
          </div>
        </AccordionCard>

        {/* Documents */}
        <AccordionCard
          title="Documents"
          subtitle="Subscription agreement, KYC, accreditation letters"
          collapsible={false}
          headerTrailing={<ProvenanceBadge kind={toProvenance(documents.status)} compact />}
        >
          <div className="p-5">
            {documents.status === "UNAVAILABLE" || !documents.value ? (
              <DataUnavailable
                label="Documents"
                detail="No documents on file for this account yet."
              />
            ) : documents.value.length === 0 ? (
              <p className="body-sm ct-text-muted">No documents on file yet.</p>
            ) : (
              <ul className="flex flex-col gap-2" role="list">
                {documents.value.map((doc, i) => (
                  <li
                    key={`${doc.type}-${i}`}
                    className="flex items-center justify-between gap-3 border-b ct-bento-divider py-2 last:border-b-0"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="body-sm font-medium ct-text-body">
                        {doc.type.replace(/_/g, " ")}
                      </span>
                      {doc.submittedAt ? (
                        <span className="body-xs ct-text-faint">
                          Submitted{" "}
                          {new Date(doc.submittedAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      ) : null}
                    </div>
                    <Badge
                      variant={
                        doc.status === "approved" ? "success" : doc.status === "rejected" ? "danger" : "warning"
                      }
                    >
                      {doc.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </AccordionCard>

        {/* Subscription history */}
        <BentoPanel aria-labelledby="prof-history-label">
          <BentoHeader
            id="prof-history-label"
            title="Subscription history"
            trailing={
              <>
                {subscriptionHistory.value && subscriptionHistory.value.count > 0 ? (
                  <Badge variant="accent">Active</Badge>
                ) : null}
                <ProvenanceBadge kind={toProvenance(subscriptionHistory.status)} compact />
              </>
            }
          />
          {subscriptionHistory.status === "UNAVAILABLE" || !subscriptionHistory.value || subscriptionHistory.value.count === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="ct-section-title">
                Your subscription history starts after your first active position.
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
          ) : (
            <>
              <div className="grid grid-cols-1 border-b ct-bento-divider ct-bento-inset-band sm:grid-cols-2">
                <BentoKpiTile
                  className="border-b sm:border-b-0 sm:border-r ct-bento-divider"
                  label="Active positions"
                  value={subscriptionHistory.value.count}
                />
                <BentoKpiTile
                  className="border-b sm:border-b-0 ct-bento-divider"
                  label="Total deployed"
                  value={
                    subscriptionHistory.value.totalDeployedUsdc
                      ? formatUsdCompact(Number(subscriptionHistory.value.totalDeployedUsdc))
                      : "—"
                  }
                />
                <BentoKpiTile
                  className="sm:col-span-2 sm:border-t ct-bento-divider"
                  label="First subscription"
                  value={
                    subscriptionHistory.value.firstSubscribedAt
                      ? new Date(subscriptionHistory.value.firstSubscribedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })
                      : "Awaiting subscription"
                  }
                />
              </div>
              {subscriptionHistory.value.events.length > 0 ? (
                <ul className="divide-y ct-bento-divider px-5" role="list">
                  {subscriptionHistory.value.events.map((ev, i) => (
                    <li key={`${ev.txHash ?? i}`} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="body-sm font-medium ct-text-body capitalize">{ev.type}</span>
                        <span className="body-xs ct-text-faint">
                          {new Date(ev.occurredAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <span className="body-sm font-medium ct-text-body tabular">
                        {formatUsdCompact(Number(ev.amountUsdc))}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </BentoPanel>

        {/* Activity */}
        <BentoPanel aria-labelledby="prof-activity-label">
          <BentoHeader
            id="prof-activity-label"
            title="Activity"
            trailing={<ProvenanceBadge kind={toProvenance(activity.status)} compact />}
          />
          {activity.status === "UNAVAILABLE" || !activity.value || activity.value.length === 0 ? (
            <div className="p-5">
              <DataUnavailable label="Activity" detail="No account activity recorded yet." />
            </div>
          ) : (
            <ul className="divide-y ct-bento-divider px-5" role="list">
              {activity.value.map((ev, i) => (
                <li key={`${ev.txHash ?? i}`} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="body-sm font-medium ct-text-body capitalize">{ev.type}</span>
                    <span className="body-xs ct-text-faint">
                      {new Date(ev.occurredAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <span className="body-sm font-medium ct-text-body tabular">
                    {formatUsdCompact(Number(ev.amountUsdc))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {showDemoReset ? (
            <div className="border-t p-5 ct-bento-divider">
              <DemoResetButton />
            </div>
          ) : null}
          <div className="flex justify-end border-t p-5 ct-bento-divider">
            <SignOutButton />
          </div>
        </BentoPanel>
      </div>
    </BentoPageShell>
  );
}
