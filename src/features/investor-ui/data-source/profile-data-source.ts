// src/features/investor-ui/data-source/profile-data-source.ts
//
// Scoped data source for the Profile screen, mirroring the exact convention
// A2 used for `dashboard-data-source.ts`: A5's shared `InvestorUiDataSource`
// (`investor-ui-data-source.ts` — interface only) does not yet declare
// `getProfile()`. If A5 lands a broader implementation that adds it, fold
// this in and delete this file — `getProfile()` below already matches the
// shape a shared implementation would expose, so the merge is a pure rename,
// not a redesign.
//
// Two implementations:
//  - `FixtureProfileDataSource` — deterministic, drives `?state=` previews.
//  - `PrismaProfileDataSource` — resolves the real ProfileViewModel for the
//    authenticated investor from the DB. This is where the page's former
//    direct `prisma.position.findMany(...)` calls now live — never inline in
//    the page component.
//
// No Prisma/Supabase/RPC access from the page itself — everything routes
// through this seam.

import "server-only";

import { prisma } from "@/lib/db";
import { resolved } from "../types/common";
import type {
  ProfileDocumentViewModel,
  ProfileInvestorStatusViewModel,
  ProfileKycViewModel,
  ProfilePreferencesViewModel,
  ProfileSubscriptionHistoryViewModel,
  ProfileViewModel,
} from "../types/profile";
import type { ActivityItemViewModel } from "../types/dashboard";
import type { SessionUser } from "@/lib/auth/session";

import { profileCompleteFixture } from "../fixtures/profile-complete";
import { profileIncompleteFixture } from "../fixtures/profile-incomplete";

export type ProfileFixtureState = "complete" | "incomplete";

export interface ProfileDataSource {
  getProfile(): Promise<ProfileViewModel>;
}

const PROFILE_FIXTURES: Record<ProfileFixtureState, ProfileViewModel> = {
  complete: profileCompleteFixture,
  incomplete: profileIncompleteFixture,
};

/** Fixture-backed data source — used for `?state=` previews and tests. */
export class FixtureProfileDataSource implements ProfileDataSource {
  constructor(private readonly state: ProfileFixtureState = "complete") {}

  async getProfile(): Promise<ProfileViewModel> {
    return PROFILE_FIXTURES[this.state];
  }
}

function isProfileFixtureState(value: string): value is ProfileFixtureState {
  return Object.hasOwn(PROFILE_FIXTURES, value);
}

/** Resolve a data source from a `?state=` preview query param — mirrors the
 *  pattern `getDashboardDataSource` uses on /dashboard. Unknown/absent values
 *  fall through to the real DB-backed source. */
export function getProfileDataSource(
  session: SessionUser,
  previewState?: string | null,
): ProfileDataSource {
  if (previewState != null && isProfileFixtureState(previewState)) {
    return new FixtureProfileDataSource(previewState);
  }
  return new PrismaProfileDataSource(session);
}

/**
 * Resolves the real ProfileViewModel for the authenticated investor.
 *
 * Every block is independently resolved: the DB backs identity/contact/
 * subscription-history/activity directly, while investorStatus.whitelisted,
 * security.twoFactorEnabled and documents have no backing column/table yet
 * (Investor has no `shareClass`/`whitelisted` field, no 2FA flag, and
 * `DocumentVaultDocument` is an unrelated content-studio table, not an
 * investor KYC-document vault) — those read NOT_CONFIGURED / UNAVAILABLE
 * rather than fabricate a value (non-negotiable: never a silent fallback to
 * "LIVE", never invent a number).
 */
export class PrismaProfileDataSource implements ProfileDataSource {
  constructor(private readonly session: SessionUser) {}

  async getProfile(): Promise<ProfileViewModel> {
    const generatedAt = new Date().toISOString();
    const { session } = this;

    const investor = await prisma.investor.findUnique({
      where: { userId: session.userId },
    });

    if (!investor) {
      // Authenticated user with no linked Investor row (e.g. an admin account
      // browsing /profile). Every block reads UNAVAILABLE — honest, not an error.
      const unavailable = <T>() =>
        resolved<T>("UNAVAILABLE", null, {
          provenance: "db",
          freshness: "no investor profile on this account",
          generatedAt,
        });
      return {
        generatedAt,
        identity: resolved(
          "PARTIAL",
          {
            kycStatus: null,
            shareClass: null,
            whitelisted: null,
            walletAddress: session.walletAddress,
            accredited: false,
          },
          { provenance: "db", freshness: "session only, no investor row", generatedAt },
        ),
        contact: resolved(
          "PARTIAL",
          { displayName: null, email: session.email, entityName: null, country: null },
          { provenance: "db", generatedAt },
        ),
        kyc: unavailable<ProfileKycViewModel>(),
        investorStatus: unavailable<ProfileInvestorStatusViewModel>(),
        security: resolved(
          "PARTIAL",
          {
            walletAddress: session.walletAddress,
            twoFactorEnabled: null,
            sessions: [],
          },
          { provenance: "db", generatedAt },
        ),
        preferences: unavailable<ProfilePreferencesViewModel>(),
        documents: unavailable<readonly ProfileDocumentViewModel[]>(),
        subscriptionHistory: unavailable<ProfileSubscriptionHistoryViewModel>(),
        activity: unavailable<readonly ActivityItemViewModel[]>(),
      };
    }

    const [positions, transactions] = await Promise.all([
      prisma.position.findMany({
        where: { investorId: investor.id, status: "active" },
        select: { principalUsdc: true, subscribedAt: true },
        orderBy: { subscribedAt: "asc" },
      }),
      prisma.investorTransaction.findMany({
        where: { investorId: investor.id },
        select: { type: true, amountUsdc: true, occurredAt: true, txHash: true },
        orderBy: { occurredAt: "desc" },
        take: 20,
      }),
    ]);

    const kycStatus = investor.kycStatus; // pending | approved | rejected
    const kycApproved = kycStatus === "approved";
    const kycRejected = kycStatus === "rejected";

    const kycView: ProfileViewModel["kyc"] = resolved(
      "LIVE",
      {
        status: kycApproved
          ? "verified"
          : kycRejected
            ? "restricted"
            : kycStatus === "pending"
              ? "pending"
              : "incomplete",
        reason: kycRejected
          ? "Verification did not pass — contact support to resubmit"
          : null,
        submittedAt: null, // not tracked as a distinct column today
        reviewedAt: null,
      },
      { provenance: "db", generatedAt },
    );

    const totalDeployed = positions.reduce(
      (acc: number, p: (typeof positions)[number]) => acc + Number(p.principalUsdc),
      0,
    );
    const firstSubAt = positions[0]?.subscribedAt ?? null;

    const depositEvents = transactions.filter(
      (t: (typeof transactions)[number]) => t.type === "deposit",
    );

    return {
      generatedAt,
      identity: resolved(
        "LIVE",
        {
          kycStatus: investor.kycStatus,
          shareClass: null, // Investor has no shareClass column yet
          whitelisted: null, // no whitelist column yet
          walletAddress: investor.walletAddress,
          accredited: Boolean(investor.accreditationAttestedAt),
        },
        { provenance: "db", generatedAt },
      ),
      contact: resolved(
        "LIVE",
        {
          displayName: null,
          email: investor.email ?? session.email,
          entityName: null, // no SPV/entity column on Investor yet
          country: null, // no country column yet
        },
        { provenance: "db", generatedAt },
      ),
      kyc: kycView,
      investorStatus: resolved(
        "PARTIAL",
        {
          shareClass: null,
          accredited: Boolean(investor.accreditationAttestedAt),
          accreditationAttestedAt: investor.accreditationAttestedAt?.toISOString() ?? null,
          whitelisted: null,
        },
        {
          provenance: "db",
          freshness: "share class / whitelist not yet indexed on-chain",
          generatedAt,
        },
      ),
      security: resolved(
        "PARTIAL",
        {
          walletAddress: investor.walletAddress,
          twoFactorEnabled: null, // platform has no 2FA flag yet
          sessions: [], // Session model has no per-device metadata yet
        },
        { provenance: "db", freshness: "2FA and session history not yet tracked", generatedAt },
      ),
      preferences: resolved<ProfilePreferencesViewModel>("NOT_CONFIGURED", null, {
        provenance: "db",
        freshness: "notification preferences not yet persisted",
        generatedAt,
      }),
      documents: resolved<readonly ProfileDocumentViewModel[]>("UNAVAILABLE", null, {
        provenance: "db",
        freshness: "document vault not yet linked to investor KYC records",
        generatedAt,
      }),
      subscriptionHistory: resolved(
        positions.length > 0 ? "LIVE" : "UNAVAILABLE",
        {
          count: positions.length,
          totalDeployedUsdc: positions.length > 0 ? String(totalDeployed) : null,
          firstSubscribedAt: firstSubAt ? firstSubAt.toISOString() : null,
          events: depositEvents.map((t: (typeof transactions)[number]) => ({
            type: t.type,
            amountUsdc: t.amountUsdc.toString(),
            occurredAt: t.occurredAt.toISOString(),
            txHash: t.txHash,
          })),
        },
        { provenance: "db", generatedAt },
      ),
      activity: resolved(
        transactions.length > 0 ? "LIVE" : "UNAVAILABLE",
        transactions.map((t: (typeof transactions)[number]) => ({
          type: t.type,
          amountUsdc: t.amountUsdc.toString(),
          occurredAt: t.occurredAt.toISOString(),
          txHash: t.txHash,
        })),
        { provenance: "db", generatedAt },
      ),
    };
  }
}
