import Link from "next/link";

import type { ProfilePageData } from "@/app/(product)/profile/_data/profile-loader";
import { abbreviateAddress } from "@/lib/onchain";
import type { Wired, WhitelistStatus } from "@/lib/chain/dynavault";
import {
  PageHeader,
  PageLayout,
  Panel,
  Row,
  RowList,
  Section,
} from "@/views/_shared/layout";
import { Button, ProvenanceBadge } from "@/ui";

export function ProfileView({
  data,
  whitelist,
  email,
  walletAddress,
}: {
  data: ProfilePageData;
  whitelist: Wired<WhitelistStatus>;
  email: string;
  walletAddress: string | null;
}) {
  if (data.state === "error") {
    return (
      <PageLayout>
        <PageHeader title="Documents & KYC" description="Your account and verification status." />
        <Panel title="We couldn't reach the data">
          <p className="px-5 py-4 text-sm text-muted">{data.detail}</p>
        </Panel>
      </PageLayout>
    );
  }

  const { profile } = data;
  const kycStatus =
    profile.kyc.status === "LIVE" && profile.kyc.value
      ? profile.kyc.value.status
      : "unavailable";
  const contactEmail =
    profile.contact.status === "LIVE" && profile.contact.value
      ? profile.contact.value.email
      : email;

  return (
    <PageLayout>
      <PageHeader
        title="Documents & KYC"
        description="Your account, identity verification and documents on file."
      />

      <Section title="Identity verification">
        <Panel>
          <RowList>
            <Row label="KYC status" value={kycStatus} />
            {kycStatus === "incomplete" ? (
              <div className="px-5 pb-4">
                <Link href="/onboarding/identity">
                  <Button size="sm">Start verification</Button>
                </Link>
              </div>
            ) : null}
          </RowList>
        </Panel>
      </Section>

      <Section title="Wallet & eligibility">
        <Panel>
          <RowList>
            <Row
              label="Linked wallet"
              value={walletAddress ? abbreviateAddress(walletAddress) : "None"}
            />
            <Row
              label="Whitelist status"
              value={
                whitelist.status === "wired"
                  ? whitelist.data.whitelisted
                    ? "Whitelisted"
                    : "Not whitelisted"
                  : "Unavailable"
              }
            />
          </RowList>
        </Panel>
      </Section>

      <Section title="Account">
        <Panel>
          <RowList>
            <Row label="Email" value={contactEmail ?? "—"} />
            <Row
              label="Provenance"
              value={<ProvenanceBadge source="live" />}
            />
          </RowList>
        </Panel>
      </Section>
    </PageLayout>
  );
}
