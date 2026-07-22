// /profile — Documents & KYC.
//
// Account identity, verification readiness and the wallet that will receive
// share receipts. The only chain read here is the whitelist status for the
// linked wallet — subscription eligibility is a contract fact, so it is read
// from the contract rather than asserted by the app.

import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireInvestor } from "@/lib/auth/require-investor";
import { readWhitelist, type Wired, type WhitelistStatus } from "@/lib/chain/dynavault";
import { selectWired } from "@/lib/chain/wired-view";
import { abbreviateAddress } from "@/lib/onchain";

import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1Panel, Series1PanelHeader, Series1Row, Series1RowList } from "@/components/series1-shell/Series1Panel";
import { Series1Provenance, Series1WiredRow } from "@/components/series1-shell/Series1Wired";

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

export default async function ProfilePage() {
  const session = await requireInvestor("/profile");
  const displayName = session.email.split("@")[0];
  const wallet = session.walletAddress;

  const whitelist: Wired<WhitelistStatus> = wallet
    ? await readWhitelist(wallet as `0x${string}`)
    : NO_WALLET;

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
          </Series1RowList>
        </Series1Panel>
      </Series1Section>

      <Series1Section
        index="02"
        title="Subscription eligibility"
        description="Eligibility is enforced by the vault contract, not by this application."
      >
        <Series1Panel>
          <Series1PanelHeader title="Whitelist status" description={<Series1Provenance read={whitelist} />} />
          <Series1RowList>
            <Series1WiredRow
              label="Whitelisted"
              read={selectWired(whitelist, (w) => w.whitelisted)}
              render={(w) => (w ? "Yes" : "No")}
              hint="whitelist(address user)"
            />
            <Series1WiredRow
              label="Open access"
              read={selectWired(whitelist, (w) => w.permissionDisabled)}
              render={(p) => (p ? "Permission disabled" : "Permissioned")}
              hint="permissionDisabled()"
            />
            <Series1WiredRow
              label="Can subscribe"
              read={selectWired(whitelist, (w) => w.effectivelyAllowed)}
              render={(a) => (a ? "Eligible" : "Not eligible")}
              hint="Whitelist or open access"
            />
          </Series1RowList>
        </Series1Panel>
      </Series1Section>

      <Series1Section
        index="03"
        title="Verification"
        description="Identity (KYC) review status."
      >
        <Series1Panel>
          <Series1PanelHeader title="KYC status" />
          <div className="p-5">
            <p className="text-sm font-medium">Not yet started</p>
            <p className="mt-1 text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
              Complete identity verification to become eligible to subscribe to Series 1.
            </p>
          </div>
        </Series1Panel>
      </Series1Section>

      <Series1Section index="04" title="Documents" description="Subscription agreement, KYC and accreditation letters.">
        <Series1Panel>
          <div className="flex flex-col items-center gap-1 p-8 text-center">
            <p className="text-sm font-medium">No documents on file</p>
            <p className="max-w-sm text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
              Documents appear here once submitted as part of onboarding.
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
