import { requireInvestor } from "@/lib/auth/require-investor";
import { loadPortfolio } from "@/lib/data/portfolio";
import {
  getVaultMode,
  readUserShares,
  readWhitelist,
  type UserShares,
  type WhitelistStatus,
} from "@/lib/chain/dynavault";
import type { Wired } from "@/lib/chain/dynavault";
import { vaultModeLabel } from "@/lib/greenfield/wired";
import { PortfolioView } from "@/views/investor/portfolio-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Position · Hearst Bitcoin Reserve Vault — Series 1",
};

export default async function PortfolioPage() {
  const session = await requireInvestor("/portfolio");
  const portfolio = await loadPortfolio();
  const mode = getVaultMode();
  const wallet = session.walletAddress;

  const [shares, whitelist]: [
    Wired<UserShares>,
    Wired<WhitelistStatus>,
  ] = wallet
    ? await Promise.all([
        readUserShares(wallet as `0x${string}`),
        readWhitelist(wallet as `0x${string}`),
      ])
    : [
        { status: "unavailable", reason: "no_wallet" },
        { status: "unavailable", reason: "no_wallet" },
      ];

  return (
    <PortfolioView
      mode={mode}
      modeLabel={vaultModeLabel(mode)}
      wallet={wallet}
      shares={shares}
      whitelist={whitelist}
      positions={portfolio.positions}
      principalUsdc={portfolio.deployedUsdc}
    />
  );
}
