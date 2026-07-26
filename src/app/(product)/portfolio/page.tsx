import { requireInvestor } from "@/lib/auth/require-investor";
import { loadPortfolioDashboard } from "@/lib/data/portfolio-dashboard";
import {
  getVaultMode,
  readUserShares,
  readWhitelist,
  type UserShares,
  type WhitelistStatus,
} from "@/lib/chain/dynavault";
import type { Wired } from "@/lib/chain/dynavault";
import { vaultModeLabel } from "@/lib/greenfield/wired";
import type { PerformancePoint } from "@/ui/chart";
import { PortfolioView } from "@/views/investor/portfolio-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Position · Hearst Bitcoin Reserve Vault — Series 1",
};

export default async function PortfolioPage() {
  const session = await requireInvestor("/portfolio");
  // loadPortfolioDashboard wraps loadPortfolio (same React `cache`, no extra
  // query) and is the ONLY place that maps the NAV series to chart points with
  // its provenance attached. Calling loadPortfolio directly here is what left
  // the real series loaded-then-dropped.
  const dashboard = await loadPortfolioDashboard();
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

  // Epoch ms, not Date: one stable numeric shape across the RSC boundary, and
  // the same units the chart's time axis plots.
  const valuePoints: PerformancePoint[] = dashboard.navPoints.map((p) => ({
    at: p.at instanceof Date ? p.at.getTime() : new Date(p.at).getTime(),
    value: p.value,
  }));

  return (
    <PortfolioView
      mode={mode}
      modeLabel={vaultModeLabel(mode)}
      wallet={wallet}
      shares={shares}
      whitelist={whitelist}
      positions={dashboard.positions}
      principalUsdc={dashboard.depositUsdc}
      valuePoints={valuePoints}
      valueProvenance={dashboard.navProvenance}
      valueSeriesKind={dashboard.navSeriesKind}
      valueSourceReachable={dashboard.source === "live"}
    />
  );
}
