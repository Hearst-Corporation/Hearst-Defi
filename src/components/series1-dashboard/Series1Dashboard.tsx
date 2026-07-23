// Series1Dashboard — composition root of the investor overview.
//
// Receives honesty envelopes the route already read from
// hearst-connect-backend (see app/(product)/dashboard/_data/dashboard-loader.ts)
// and turns them into the rebuilt surface. It performs NO I/O: the architecture
// guard forbids this tree from touching `@/lib/data/*`, Prisma, viem or ethers
// (canon F9).
//
// The envelope type is `Series1Wired<T>`, which is wider than the chain
// adapter's `Wired<T>` (`source` is an open string, addresses are plain
// strings). The adapter's own reads still satisfy it, so a surface can be
// switched between the two sources without changing this tree. The domain
// types below are still imported FROM the adapter — as types only, erased at
// compile time — because they remain the canonical description of what a vault
// fact IS, whichever transport delivered it.
//
// The canon defects this composition fixes:
//   F1  every surface is a Series1Dashboard* primitive: cards sit on a deep
//       fill (--ct-bg-deep mixed into --ct-surface-page) and wells recess
//       deeper still.
//   F2  the spreadsheet KPI band is gone — one hero band carries every
//       top-line metric; nothing is stacked as a second, redundant KPI deck.
//   F3  motives are collapsed to ONE line per group via `groupMotive`,
//       instead of being printed as the value of every KPI.
//   F4  hierarchy follows the cockpit reference: hero band, then chart (2fr)
//       beside ONE allocation card (1fr), then the registry section — not a
//       vertical stack of equal-width administrative sections.

import {
  formatBps,
  formatBtcFromSats,
  formatHashrateTh,
  formatUsdcAmount,
} from "@/lib/chain/wired-view";
// TYPE-ONLY: erased at compile time, so this never pulls the `server-only`
// adapter into a client bundle (the architecture guard ignores `import type`).
import type {
  ElecStatus,
  MiningMetrics,
  OpsState,
  ProductDuration,
  StrategyInfo,
  VaultCore,
} from "@/lib/chain/dynavault";

import { Series1AllocationCockpit } from "./Series1AllocationCockpit";
import { Series1BitcoinAccumulation } from "./Series1BitcoinAccumulation";
import {
  Series1CapitalFlow,
  type Series1Pocket,
} from "./Series1CapitalArchitecture";
import {
  groupMotive,
  isUnresolved,
  Series1DataState,
  Series1Provenance,
  selectRead,
  wiredValue,
  type Series1Wired,
} from "./Series1DataState";
import { Series1DashboardHero } from "./Series1DashboardHero";
import {
  Series1DashboardPage,
  Series1DashboardSection,
} from "./Series1DashboardSection";
import { Series1MiningRegister } from "./Series1MiningRegister";

/** The three Mining Note pockets, by strategy index (VAULT_SPEC_V2.1 §6). */
const POCKETS: readonly { id: "B1" | "B2" | "B3"; label: string }[] = [
  { id: "B1", label: "Mining Power" },
  { id: "B2", label: "BTC Reserve" },
  { id: "B3", label: "Operating Reserve" },
];

/** Policy allocation in bps — a SPEC CONSTANT, never a measurement. */
const POLICY_TARGET_BPS: readonly number[] = [4000, 2700, 3300];

/**
 * Contract mode split into a SHORT value and its qualifier. A KPI value slot
 * holds one term; the caveat belongs in the hint, otherwise the cell truncates
 * ("Legacy vault · v2.1 addre…") and says nothing.
 */
function vaultModeCell(mode: string): {
  value: string;
  hint: string;
} {
  switch (mode) {
    // Modes reported by hearst-connect-backend (`ContractRuntimeStatus.mode`).
    case "v2-mainnet":
      return { value: "DynaVault v2.1", hint: "Active deployment" };
    case "v2-testnet":
      return { value: "DynaVault v2.1", hint: "Testnet deployment" };
    // A fork is named as a fork. The figures it serves are real reads of a real
    // contract, but the chain is ephemeral — presenting it as a live deployment
    // would let a preprod number read as a position of record.
    case "v2-fork":
      return { value: "DynaVault v2.1", hint: "Preprod fork — not a record" };
    // Modes from the frontend's own adapter, kept while both paths coexist.
    case "v2":
      return { value: "DynaVault v2.1", hint: "Active deployment" };
    case "legacy":
      return { value: "Legacy vault", hint: "v2.1 address not posted yet" };
    case "not_configured":
      return { value: "Not configured", hint: "No address on this network" };
    default:
      return { value: mode, hint: "Unrecognised contract mode" };
  }
}

/**
 * The envelope this surface consumes.
 *
 * Structural, and deliberately WIDER than the chain adapter's `Wired<T>`: the
 * data now arrives from hearst-connect-backend, whose addresses are plain
 * strings (JSON has no `0x${string}` template literal) and which does not
 * report the adapter-only fields — `shareDecimals`, `tvlCap`, `paused`,
 * per-strategy `enabled`. This tree reads none of them (verified by usage),
 * so requiring them would have forced the loader to FABRICATE values just to
 * satisfy a type. Widening the prop instead keeps the honesty contract:
 * nothing is invented to make a signature fit.
 *
 * An adapter-produced `Wired<T>` still satisfies this — `0x${string}` is
 * assignable to `string` — so both read paths type-check during the cutover.
 */
export type Series1Envelope<T> = Series1Wired<T>;

/** The fields this surface actually reads, per concern. */
export interface Series1DashboardProps {
  core: Series1Envelope<Pick<VaultCore, "totalAssets"> & { asset: string }>;
  strategies: Series1Envelope<readonly Pick<StrategyInfo, "index" | "allocationBps">[]>;
  mining: Series1Envelope<MiningMetrics>;
  // `lastElecPaymentTime` widened to `| null`: the backend reports "no payment
  // ever made" as null, which must not be coerced to 0 (that would render as
  // the Unix epoch — a payment dated 1970).
  elec: Series1Envelope<
    Pick<ElecStatus, "monthlyElecCost" | "totalElecPaid"> & { lastElecPaymentTime: bigint | null }
  >;
  ops: Series1Envelope<OpsState>;
  duration: Series1Envelope<ProductDuration>;
  // Allocation cockpit signals (PROMPT 031). Structural, envelope-wrapped like
  // the rest — an absent field inside stays null, never a fabricated figure.
  subscriptionCapacity: Series1Envelope<{
    tvlCapAtomic: string | null;
    availableCapacityAtomic: string | null;
    minimumDepositUsdc: string | null;
  }>;
  proofSnapshot: Series1Envelope<{
    eventCount: number;
    lastEventName: string | null;
    lastTxHash: string | null;
    lastBlockNumber: string | null;
    lastIndexedAt: string | null;
    chainId: number | null;
  }>;
  // `mode` is a plain string rather than `VaultMode`: it now carries whichever
  // mode the BACKEND reports actually answered ("v2-fork", "v2-mainnet", …),
  // which is a wider vocabulary than the frontend adapter's own three.
  mode: string;
}

export function Series1Dashboard({
  core,
  strategies,
  subscriptionCapacity,
  proofSnapshot,
  mining,
  elec,
  ops,
  duration,
  mode,
}: Series1DashboardProps) {
  // ── Hero: accumulated BTC is the principal investor outcome (canon §2).
  const btcEarned = selectRead(mining, (m) => m.totalBtcEarnedSats);
  const totalAssets = selectRead(core, (c) => c.totalAssets);
  const currentMonth = selectRead(ops, (o) => o.currentMonth);
  const contractCell = vaultModeCell(mode);

  const termValue = (() => {
    if (currentMonth.status !== "wired") return "—";
    const elapsed = currentMonth.data.toString();
    return duration.status === "wired"
      ? `${elapsed} / ${duration.data.months.toString()}`
      : elapsed;
  })();

  // ── Allocation: live strategies if wired, else the LABELLED policy target.
  const strategiesWired = strategies.status === "wired";
  const pocketAllocations: Series1Pocket[] = strategiesWired
    ? strategies.data.map((s) => ({
        id: POCKETS[s.index]?.id ?? "B1",
        label: POCKETS[s.index]?.label ?? `Strategy ${s.index}`,
        value: Number(s.allocationBps) / 100,
      }))
    : POLICY_TARGET_BPS.map((bps, i) => ({
        id: POCKETS[i]?.id ?? "B1",
        label: POCKETS[i]?.label ?? `Strategy ${i}`,
        value: bps / 100,
      }));

  // ── Allocation cockpit inputs — target is the spec constant; actual is the
  // measured on-chain split ONLY when strategies() answered. Everything the
  // dashboard loader does not carry (subscription cap/min, indexed proof
  // events) is reported honestly as "not reported" / "no event yet", never as
  // a fabricated figure.
  const cockpitTarget: Series1Pocket[] = POLICY_TARGET_BPS.map((bps, i) => ({
    id: POCKETS[i]?.id ?? "B1",
    label: POCKETS[i]?.label ?? `Strategy ${i}`,
    value: bps / 100,
  }));
  const cockpitActual: Series1Pocket[] | null = strategiesWired ? pocketAllocations : null;
  // Series1Wired carries two statuses (wired | unavailable); "not_configured"
  // is encoded in the reason string (e.g. "backend:not_configured:…").
  const wiredStatus = (r: Series1Wired<unknown>): "live" | "not_configured" | "unavailable" =>
    r.status === "wired"
      ? "live"
      : r.reason.includes("not_configured")
        ? "not_configured"
        : "unavailable";

  // Subscription capacity (PROMPT 031): cap/available are 6dp atomic USDC;
  // minimum is whole USDC. Any absent field → null on the surface ("not
  // reported"), never a fabricated 0.
  const capData = subscriptionCapacity.status === "wired" ? subscriptionCapacity.data : null;
  const cockpitSubscription = {
    hardCap: capData?.tvlCapAtomic != null ? formatUsdcAmount(BigInt(capData.tvlCapAtomic)) : null,
    minimum:
      capData?.minimumDepositUsdc != null
        ? `$${Number(capData.minimumDepositUsdc).toLocaleString("en-US")}`
        : null,
  };

  // Proof snapshot (PROMPT 031): last indexed event, honest empty when none.
  const proofData = proofSnapshot.status === "wired" ? proofSnapshot.data : null;
  const cockpitProof = {
    lastEventLabel: proofData?.lastEventName ?? null,
    chainLabel:
      proofData?.chainId != null
        ? proofData.chainId === 31337
          ? "Fork preprod"
          : `Chain ${proofData.chainId}`
        : null,
  };

  // ── Motives, collapsed per group (canon §5). Never printed per cell.
  const headlineMotive = groupMotive([mining, core, ops]);
  const miningMotive = groupMotive([mining]);
  const reserveMotive = groupMotive([elec]);
  const contractMotive = groupMotive([core, ops]);

  return (
    <Series1DashboardPage>
      <Series1DashboardHero
        eyebrow="Hearst Bitcoin Reserve Vault · Series 1"
        label="Bitcoin accumulated"
        value={wiredValue(btcEarned, (s) => formatBtcFromSats(s))}
        muted={isUnresolved(btcEarned)}
        caption="Accumulated BTC is the principal investor outcome and is delivered at maturity. Market price is contextual only; it is not a return projection."
        trailing={<Series1Provenance read={mining} />}
        context={[
          {
            label: "Capital deployed",
            value: wiredValue(totalAssets, (v) => formatUsdcAmount(v)),
            muted: isUnresolved(totalAssets),
            hint: "USDC subscribed",
          },
          {
            label: "Term progress",
            value: termValue,
            muted: isUnresolved(currentMonth),
            hint: "Months elapsed",
          },
          {
            label: "Contract",
            value: contractCell.value,
            hint: contractCell.hint,
          },
          {
            label: "Reported hashrate",
            value: wiredValue(
              selectRead(mining, (m) => m.reportedHashrateTh),
              (h) => formatHashrateTh(h),
            ),
            muted: isUnresolved(mining),
            hint: "Last keeper report",
          },
          {
            label: "Mining state",
            value: wiredValue(
              selectRead(ops, (o) => o.isCurtailed),
              (c) => (c ? "Curtailed" : "Active"),
            ),
            muted: isUnresolved(ops),
            hint: "Current window",
          },
          {
            label: "Allocation mode",
            value: wiredValue(
              selectRead(ops, (o) => o.miningNoteMode),
              (m) => (m ? "Enforced" : "Advisory"),
            ),
            muted: isUnresolved(ops),
            hint: "40 / 27 / 33 policy",
          },
        ]}
      />

      {headlineMotive ? (
        <Series1DataState
          motive={headlineMotive}
          detail="figures resolve once the v2.1 contract is deployed and reporting"
        />
      ) : null}

      {/* Chart + allocation, 2:1 — one dominant instrument (the accumulation
          curve) beside ONE allocation card, not a stack of equal-width
          sections. Matches the cockpit reference: wide chart left, Capacity
          mix-equivalent card right. */}
      <div className="grid w-full min-w-0 grid-cols-1 gap-[var(--ct-space-5)] xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Series1BitcoinAccumulation motive={miningMotive} />
        <Series1AllocationCockpit
          target={cockpitTarget}
          actual={cockpitActual}
          actualMotive="the measured pocket allocation appears once the v2.1 contract is deployed"
          sources={[
            { label: "Vault", status: wiredStatus(core) },
            { label: "Strategies", status: wiredStatus(strategies) },
            { label: "Mining", status: wiredStatus(mining) },
            { label: "Reserve", status: wiredStatus(elec) },
          ]}
          proof={cockpitProof}
          subscription={cockpitSubscription}
        />
      </div>

      <Series1DashboardSection
        title="Mining register and reserve"
        description="Operational reports, kept separate from the investor outcome."
      >
        <div className="grid w-full min-w-0 grid-cols-1 gap-[var(--ct-space-4)] lg:grid-cols-3">
          <Series1CapitalFlow className="h-full" />
          <Series1MiningRegister
            className="h-full"
            title="Mining register"
            caption="Reported on-chain by the keeper"
            trailing={<Series1Provenance read={mining} />}
            motive={miningMotive}
            rows={[
              {
                label: "BTC earned",
                value: wiredValue(
                  selectRead(mining, (m) => m.totalBtcEarnedSats),
                  (s) => formatBtcFromSats(s),
                ),
                muted: isUnresolved(mining),
                hint: "Cumulative, delivered at maturity",
              },
              {
                label: "Last report",
                value: wiredValue(
                  selectRead(mining, (m) => m.lastReportTime),
                  (t) =>
                    t > 0n
                      ? new Date(Number(t) * 1000).toISOString().slice(0, 10)
                      : "Never reported",
                ),
                muted: isUnresolved(mining),
              },
              {
                label: "Allocation split",
                value: strategiesWired
                  ? strategies.data.map((s) => formatBps(s.allocationBps)).join(" · ")
                  : "40% · 27% · 33%",
                muted: !strategiesWired,
                hint: strategiesWired ? "Measured on-chain" : "Configured policy target",
              },
            ]}
          />

          <Series1MiningRegister
            className="h-full"
            title="Reserve and contract"
            caption="B3 Operating Reserve funds electricity; the contract state is read directly."
            trailing={<Series1Provenance read={elec} />}
            motive={reserveMotive ?? contractMotive}
            rows={[
              {
                label: "Monthly electricity cost",
                value: wiredValue(
                  selectRead(elec, (e) => e.monthlyElecCost),
                  (c) => formatUsdcAmount(c),
                ),
                muted: isUnresolved(elec),
              },
              {
                label: "Total paid since inception",
                value: wiredValue(
                  selectRead(elec, (e) => e.totalElecPaid),
                  (t) => formatUsdcAmount(t),
                ),
                muted: isUnresolved(elec),
              },
              {
                label: "Last payment",
                value: wiredValue(
                  selectRead(elec, (e) => e.lastElecPaymentTime),
                  // null (backend: no payment recorded) and 0n (chain adapter:
                  // zero timestamp) both mean "never paid" — neither is a date.
                  (t) =>
                    t !== null && t > 0n
                      ? new Date(Number(t) * 1000).toISOString().slice(0, 10)
                      : "Never paid",
                ),
                muted: isUnresolved(elec),
              },
              {
                label: "Underlying asset",
                value: wiredValue(
                  selectRead(core, (c) => c.asset),
                  (a) => `${a.slice(0, 6)}…${a.slice(-4)}`,
                ),
                muted: isUnresolved(core),
                hint: "Read from the contract",
              },
              {
                label: "Delivery evidence",
                value: "At maturity",
                hint: "Contractual term, not a chain read",
              },
            ]}
          />
        </div>
      </Series1DashboardSection>

      <p
        className="m-0 leading-relaxed text-[var(--ct-text-faint)]"
        style={{ fontSize: "var(--ct-text-nano)" }}
      >
        Accumulated BTC is delivered at maturity. Allocation, reserve and mining figures
        carry their own provenance; estimated outcomes are disclosed as a range and are not
        guaranteed.
      </p>
    </Series1DashboardPage>
  );
}
