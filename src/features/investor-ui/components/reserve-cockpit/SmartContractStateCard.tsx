// src/features/investor-ui/components/reserve-cockpit/SmartContractStateCard.tsx
//
// SmartContractStateCard — honest, read-only state of the vault contract backing
// Series 1. The v3.0 mining note targets PermissionedDynaVault v2.1 but it is
// written-not-deployed; the app runs in `legacy` mode until the DynaVault address
// is posted (see non-negotiable #8). This card states that plainly — mode, chain,
// address, and whether bytecode is actually present on-chain — and never dresses
// an undeployed contract as live.
//
// No network action here: it renders whatever state the caller resolved. If the
// caller passes null, it shows DataNotConfigured (expected, not an error).

import { HcSourceBadge } from "@/components/dataviz/his";
import type { HcSourceStatus } from "@/components/dataviz/his";

import { ReserveBlockFrame } from "./block-frame";
import { DataNotConfigured } from "../states/data-states";

export type VaultMode = "legacy" | "dynavault";

export interface SmartContractState {
  readonly mode: VaultMode;
  /** EVM chain id (e.g. 84532 for Base Sepolia). */
  readonly chainId: number;
  readonly chainLabel: string;
  /** Deployed address, or null when the target address is not posted yet. */
  readonly address: string | null;
  /** True only if bytecode was actually observed at `address` on-chain. */
  readonly codePresent: boolean;
}

export interface SmartContractStateCardProps {
  state: SmartContractState | null;
  /** Provenance of the read (usually `oracle`/`live` for an RPC read). */
  source?: HcSourceStatus;
  className?: string;
}

/** Truncate an address to 0x1234…abcd for display. */
function shortAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function SmartContractStateCard({
  state,
  source = "oracle",
  className,
}: SmartContractStateCardProps) {
  if (!state) {
    return (
      <ReserveBlockFrame title="Contract State" source="configured" className={className}>
        <DataNotConfigured
          label="Contract state"
          detail="The target vault contract address has not been posted on this network yet."
        />
      </ReserveBlockFrame>
    );
  }

  const modeLabel = state.mode === "dynavault" ? "DynaVault v2.1" : "Legacy vault";
  const deployed = state.address !== null && state.codePresent;

  return (
    <ReserveBlockFrame
      title="Contract State"
      source={source}
      subtitle="Vault contract backing the Series 1 mining note"
      headerRight={
        <HcSourceBadge
          status={deployed ? "live" : "configured"}
          title={deployed ? "Bytecode present on-chain" : "Target address not deployed yet"}
        />
      }
      className={className}
      footnote={
        state.mode === "legacy"
          ? "Running in legacy mode. The DynaVault v2.1 contract is written but not yet deployed on this network — its address is pending."
          : "DynaVault v2.1 mode. On-chain state is read directly from the deployed contract."
      }
    >
      <dl className="grid grid-cols-2 gap-x-[var(--ct-space-4)] gap-y-[var(--ct-space-3)]">
        <Row label="Mode" value={modeLabel} />
        <Row label="Network" value={`${state.chainLabel} (${state.chainId})`} />
        <Row
          label="Address"
          value={state.address ? shortAddress(state.address) : "Not posted"}
          mono
          muted={!state.address}
          fullTitle={state.address ?? undefined}
        />
        <Row
          label="Bytecode"
          value={state.codePresent ? "Present on-chain" : "Absent"}
          muted={!state.codePresent}
        />
      </dl>
    </ReserveBlockFrame>
  );
}

function Row({
  label,
  value,
  mono,
  muted,
  fullTitle,
}: {
  label: string;
  value: string;
  mono?: boolean;
  muted?: boolean;
  fullTitle?: string;
}) {
  return (
    <div className="flex flex-col gap-[var(--ct-space-1)]">
      <dt
        style={{
          fontSize: "var(--ct-text-nano)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--ct-text-faint)",
        }}
      >
        {label}
      </dt>
      <dd
        className="m-0 truncate"
        title={fullTitle}
        style={{
          fontSize: "var(--ct-text-2xs)",
          fontWeight: 600,
          fontFamily: mono ? "var(--ct-font-mono, ui-monospace, monospace)" : undefined,
          fontVariantNumeric: "tabular-nums",
          color: muted ? "var(--ct-text-muted)" : "var(--ct-text-primary)",
        }}
      >
        {value}
      </dd>
    </div>
  );
}
