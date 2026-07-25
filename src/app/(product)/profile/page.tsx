import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireInvestor } from "@/lib/auth/require-investor";
import { readWhitelist, type Wired } from "@/lib/chain/dynavault";
import type { WhitelistStatus } from "@/lib/chain/dynavault";

import { loadProfilePageData } from "./_data/profile-loader";
import { ProfileView } from "@/views/investor/profile-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Documents & KYC",
  description: "Your account, identity verification and documents on file",
};

export default async function ProfilePage() {
  const session = await requireInvestor("/profile");
  const data = await loadProfilePageData();
  const walletAddress = session.walletAddress;

  let whitelist: Wired<WhitelistStatus>;
  if (walletAddress) {
    whitelist = await readWhitelist(walletAddress as `0x${string}`);
  } else {
    whitelist = { status: "unavailable", reason: "no_wallet" };
  }

  return (
    <>
      <ProfileView
        data={data}
        whitelist={whitelist}
        email={session.email}
        walletAddress={walletAddress}
      />
      <div className="hc-page pb-8">
        <SignOutButton />
      </div>
    </>
  );
}
