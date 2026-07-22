import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireInvestor } from "@/lib/auth/require-investor";
import { abbreviateAddress } from "@/lib/onchain";

import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1Panel, Series1PanelHeader, Series1Row, Series1RowList } from "@/components/series1-shell/Series1Panel";

export const metadata = {
  title: "Profile",
  description: "Your account and identity",
};

export default async function ProfilePage() {
  const session = await requireInvestor("/profile");
  const displayName = session.email.split("@")[0];

  return (
    <Series1Page>
      <Series1PageTitle
        title="Documents & KYC"
        description="Your account, identity verification and documents on file."
      />

      <Series1Section index="01" title="Identity">
        <Series1Panel>
          <Series1PanelHeader title={`Welcome back, ${displayName}`} />
          <Series1RowList>
            <Series1Row label="Email" value={session.email} />
            <Series1Row label="Role" value={session.role === "admin" ? "Admin" : "Investor"} />
            <Series1Row
              label="Wallet"
              value={session.walletAddress ? abbreviateAddress(session.walletAddress) : "Not connected"}
            />
          </Series1RowList>
        </Series1Panel>
      </Series1Section>

      <Series1Section
        index="02"
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

      <Series1Section index="03" title="Documents" description="Subscription agreement, KYC and accreditation letters.">
        <Series1Panel>
          <div className="flex flex-col items-center gap-1 p-8 text-center">
            <p className="text-sm font-medium">No documents on file</p>
            <p className="max-w-sm text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
              Documents appear here once submitted as part of onboarding.
            </p>
          </div>
        </Series1Panel>
      </Series1Section>

      <Series1Section index="04" title="Subscription history">
        <Series1Panel>
          <div className="flex flex-col items-center gap-1 p-8 text-center">
            <p className="text-sm font-medium">Your subscription history starts after your first active position.</p>
            <p className="max-w-sm text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
              Once a deposit is confirmed, deployed capital and subscription history appear here.
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
