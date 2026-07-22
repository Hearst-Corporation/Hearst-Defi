// /profile — Documents & KYC.
//
// Identity/KYC now comes from hearst-connect-backend through the shared
// data source (see ./_data/profile-loader.ts) — the same read path as
// /dashboard and /vaults, replacing the page's former direct-Prisma KYC read.
//
// The ONE chain read that stays is the whitelist for the linked wallet:
// subscription eligibility is a CONTRACT fact, the legacy contract is really
// deployed and readable, and the backend itself reports `whitelisted: null`
// until v2 is live — swapping a real on-chain reading for that null would
// trade a true value for an absence. This read is eligibility, not profile.

import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireInvestor } from "@/lib/auth/require-investor";
import { readWhitelist, type Wired, type WhitelistStatus } from "@/lib/chain/dynavault";
import { selectWired } from "@/lib/chain/wired-view";
import { abbreviateAddress } from "@/lib/onchain";
import type { ResolvedViewModel } from "@/features/investor-ui/types/common";
import type { InvestorIdentityViewModel } from "@/features/investor-ui/types/dashboard";

import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1Panel, Series1PanelHeader, Series1Row, Series1RowList } from "@/components/series1-shell/Series1Panel";
import { Series1Provenance, Series1WiredRow } from "@/components/series1-shell/Series1Wired";

import { loadProfilePageData } from "./_data/profile-loader";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Documents & KYC",
  description: "Your account, identity verification and documents on file",
};

/** No wallet linked: the whitelist question cannot be asked, so we say that. */
const NO_WALLET: Wired<never> = {
  status: "unavailable",
  reason: "no_wallet",
  detail: "Link a wallet to check subscription eligibility on the vault contract.",
};

/** Backend kycStatus → investor-facing copy. Every key is a value the backend
 *  actually emits (pending | approved | rejected); anything else falls to the
 *  honest unknown state rather than being coerced into a known one. */
const KYC_COPY: Record<string, { label: string; detail: string }> = {
  approved: {
    label: "Approved",
    detail: "Identity verified. Subscription eligibility itself is enforced by the vault contract.",
  },
  pending: {
    label: "In review",
    detail: "Your submission has been received and is being reviewed.",
  },
  rejected: {
    label: "Rejected",
    detail: "Verification was not accepted. Contact Hearst to resolve and resubmit.",
  },
};

/**
 * The verification panel's body, by the identity block's honest state.
 * PARTIAL ("no_investor_record") is a PRODUCT state — a brand-new account has
 * no investor record yet — and must never render as an error; UNAVAILABLE is
 * a read failure and must never render as a decision.
 */
function kycPresentation(identity: ResolvedViewModel<InvestorIdentityViewModel>): {
  label: string;
  detail: string;
} {
  if (identity.status === "UNAVAILABLE") {
    return {
      label: "Status unavailable",
      detail:
        "The verification record could not be read right now — this is a read failure, not a decision.",
    };
  }
  if (identity.value === null) {
    // PARTIAL / no_investor_record — nothing has been started for this account.
    return {
      label: "Not yet started",
      detail: "Complete identity verification to become eligible to subscribe to Series 1.",
    };
  }
  const status = identity.value.kycStatus;
  if (status !== null && KYC_COPY[status]) return KYC_COPY[status];
  return {
    label: "Not yet started",
    detail: "Complete identity verification to become eligible to subscribe to Series 1.",
  };
}

export default async function ProfilePage() {
  const session = await requireInvestor("/profile");
  const displayName = session.email.split("@")[0] ?? session.email;

  const [profileData, whitelistForSessionWallet] = await Promise.all([
    loadProfilePageData(),
    session.walletAddress
      ? readWhitelist(session.walletAddress as `0x${string}`)
      : Promise.resolve(NO_WALLET as Wired<WhitelistStatus>),
  ]);

  // The backend never answered — network, 5xx, or an older backend without
  // the route. Deliberately distinct from "no investor record": rendering
  // "not yet started" during an outage would state something false about the
  // account. No figure, no status, no fabricated profile.
  if (profileData.state === "error") {
    return (
      <Series1Page>
        <Series1PageTitle
          title="Documents & KYC"
          description="Your account, identity verification and the wallet that receives your share receipts."
        />
        <Series1Panel>
          <Series1PanelHeader title="We couldn’t reach the data" />
          <div className="p-6">
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              The service that reports this account’s verification state did not respond. Nothing
              below has been estimated or filled in — this is a connectivity problem on our side,
              not a statement about your account.
            </p>
          </div>
        </Series1Panel>
        <Series1Panel className="flex items-center justify-end p-5">
          <SignOutButton />
        </Series1Panel>
      </Series1Page>
    );
  }

  const { identity } = profileData.profile;
  const kyc = kycPresentation(identity);
  // Wallet: the backend's identity block is authoritative when it carries one;
  // the session's linked wallet is the fallback for the PARTIAL state (the
  // wallet can be linked before the Investor row exists).
  const wallet = identity.value?.walletAddress ?? session.walletAddress ?? null;

  return (
    <Series1Page>
      <Series1PageTitle
        title="Documents & KYC"
        description="Your account, identity verification and the wallet that receives your share receipts."
      />

      <Series1Section index="01" title="Identity">
        <Series1Panel>
          <Series1PanelHeader title={`Welcome back, ${displayName}`} />
          <Series1RowList>
            <Series1Row label="Email" value={session.email} />
            <Series1Row label="Role" value={session.role === "admin" ? "Admin" : "Investor"} />
            <Series1Row
              label="Receiver wallet"
              value={wallet ? abbreviateAddress(wallet) : "Not linked"}
              hint={wallet ? "Receives share receipts and delivery at maturity" : "Required before subscribing"}
            />
            <Series1Row
              label="Accredited"
              // `accredited` is a boolean fact from the Investor row; with no
              // row (PARTIAL) there is nothing to assert, so the cell says so
              // instead of defaulting to "No".
              value={
                identity.value === null ? "Not on record" : identity.value.accredited ? "Yes" : "No"
              }
              hint="Accreditation attestation on file"
            />
          </Series1RowList>
        </Series1Panel>
      </Series1Section>

      <Series1Section
        index="02"
        title="Subscription eligibility"
        description="Eligibility is enforced by the vault contract, not by this application."
      >
        <Series1Panel>
          <Series1PanelHeader
            title="Whitelist status"
            description={<Series1Provenance read={whitelistForSessionWallet} />}
          />
          <Series1RowList>
            <Series1WiredRow
              label="Whitelisted"
              read={selectWired(whitelistForSessionWallet, (w) => w.whitelisted)}
              render={(w) => (w ? "Yes" : "No")}
              hint="whitelist(address user)"
            />
            <Series1WiredRow
              label="Open access"
              read={selectWired(whitelistForSessionWallet, (w) => w.permissionDisabled)}
              render={(p) => (p ? "Permission disabled" : "Permissioned")}
              hint="permissionDisabled()"
            />
            <Series1WiredRow
              label="Can subscribe"
              read={selectWired(whitelistForSessionWallet, (w) => w.effectivelyAllowed)}
              render={(a) => (a ? "Eligible" : "Not eligible")}
              hint="Whitelist or open access"
            />
          </Series1RowList>
        </Series1Panel>
      </Series1Section>

      <Series1Section index="03" title="Verification" description="Identity (KYC) review status.">
        <Series1Panel>
          <Series1PanelHeader title="KYC status" />
          <div className="p-5">
            <p className="text-sm font-medium text-zinc-950 dark:text-white">{kyc.label}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{kyc.detail}</p>
          </div>
        </Series1Panel>
      </Series1Section>

      <Series1Section index="04" title="Documents" description="Subscription agreement, KYC and accreditation letters.">
        <Series1Panel>
          <div className="flex flex-col items-center gap-1 p-8 text-center">
            {/* The documents block resolves NOT_CONFIGURED/no_backend_endpoint
                from the data source — /api/v1/profile is identity-only. The
                copy states the feature gap; it never asserts an empty file
                list nobody queried. */}
            <p className="text-sm font-medium text-zinc-950 dark:text-white">Document space not yet available</p>
            <p className="max-w-sm text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              Subscription agreement, KYC and accreditation letters will appear here once document delivery is wired
              to this space.
            </p>
          </div>
        </Series1Panel>
      </Series1Section>

      <Series1Panel className="flex items-center justify-end p-5">
        <SignOutButton />
      </Series1Panel>
    </Series1Page>
  );
}
