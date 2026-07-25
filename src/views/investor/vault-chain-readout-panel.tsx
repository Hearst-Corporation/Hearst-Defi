import { CHAIN_ID, getVaultTarget, readVaultCore } from "@/lib/chain/dynavault";
import {
  formatNavPerShare,
  formatUsdcAmount,
  selectWired,
} from "@/lib/chain/wired-view";
import { AUM_PENDING_LABEL } from "@/lib/constants/vault";
import { abbreviateAddress } from "@/lib/onchain";
import { formatUsdCompact } from "@/lib/vaults/product-display";
import { Badge, ProvenanceBadge } from "@/ui";
import { Panel, Row, RowList } from "@/views/_shared/layout";

export async function VaultChainReadoutPanel({
  dbAumUsdc,
}: {
  dbAumUsdc: number | null;
}) {
  const target = getVaultTarget();
  const core = await readVaultCore();
  const tvl = selectWired(core, (data) => data.totalAssets);
  const nav = selectWired(core, (data) => data.navPerShare);

  return (
    <Panel
      title="On-chain state"
      description={`Read from the vault contract · Base Sepolia · chain ${CHAIN_ID}`}
    >
      <RowList>
        <Row
          label="Vault contract"
          value={
            target.mode === "not_configured" ? (
              "Not configured"
            ) : (
              <span className="flex items-center gap-2">
                <span className="truncate text-info" title={target.address}>
                  {abbreviateAddress(target.address)}
                </span>
                <Badge variant="outline">{target.mode}</Badge>
              </span>
            )
          }
        />
        <Row
          label="TVL (on-chain)"
          value={
            tvl.status === "wired"
              ? formatUsdcAmount(tvl.data)
              : core.status === "unavailable"
                ? "—"
                : "—"
          }
        />
        <Row
          label="NAV / share"
          value={
            nav.status === "wired" ? formatNavPerShare(nav.data) : "—"
          }
        />
        <Row
          label="Snapshot aggregate (database)"
          hint="Computed off-chain — not a contract read."
          value={
            <span className="flex items-center gap-2">
              {dbAumUsdc !== null && dbAumUsdc > 0
                ? formatUsdCompact(dbAumUsdc)
                : AUM_PENDING_LABEL}
              <ProvenanceBadge source="estimated" />
            </span>
          }
        />
      </RowList>
    </Panel>
  );
}
