// Series1Dashboard — composition root of the investor overview.
//
// Receives `Wired<T>` envelopes that the route already read through the single
// server-only passage point (`@/lib/chain/dynavault.ts`) and turns them into
// the rebuilt surface. It performs NO I/O: the architecture guard forbids this
// tree from touching `@/lib/data/*`, Prisma, viem or ethers (canon F9).
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
  selectWired,
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
  Wired,
} from "@/lib/chain/dynavault";
import type { VaultMode } from "@/lib/chain/vault-mode";

import { Series1BitcoinAccumulation } from "./Series1BitcoinAccumulation";
import {
  Series1CapitalArchitecture,
  Series1CapitalFlow,
  type Series1Pocket,
} from "./Series1CapitalArchitecture";
import {
  groupMotive,
  isUnresolved,
  Series1DataState,
  Series1Provenance,
  wiredValue,
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
function vaultModeCell(mode: "v2" | "legacy" | "not_configured"): {
  value: string;
  hint: string;
} {
  switch (mode) {
    case "v2":
      return { value: "DynaVault v2.1", hint: "Active deployment" };
    case "legacy":
      return { value: "Legacy vault", hint: "v2.1 address not posted yet" };
    case "not_configured":
      return { value: "Not configured", hint: "No address on this network" };
  }
}

/**
 * Props mirror the adapter's own envelope types rather than restating them:
 * `Wired<T>` carries `address` as a `0x${string}` template literal, and a
 * hand-written `string` would silently diverge from the single passage point.
 */
export interface Series1DashboardProps {
  core: Wired<VaultCore>;
  strategies: Wired<StrategyInfo[]>;
  mining: Wired<MiningMetrics>;
  elec: Wired<ElecStatus>;
  ops: Wired<OpsState>;
  duration: Wired<ProductDuration>;
  mode: VaultMode;
}

export function Series1Dashboard({
  core,
  strategies,
  mining,
  elec,
  ops,
  duration,
  mode,
}: Series1DashboardProps) {
  // ── Hero: accumulated BTC is the principal investor outcome (canon §2).
  const btcEarned = selectWired(mining, (m) => m.totalBtcEarnedSats);
  const totalAssets = selectWired(core, (c) => c.totalAssets);
  const currentMonth = selectWired(ops, (o) => o.currentMonth);
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
              selectWired(mining, (m) => m.reportedHashrateTh),
              (h) => formatHashrateTh(h),
            ),
            muted: isUnresolved(mining),
            hint: "Last keeper report",
          },
          {
            label: "Mining state",
            value: wiredValue(
              selectWired(ops, (o) => o.isCurtailed),
              (c) => (c ? "Curtailed" : "Active"),
            ),
            muted: isUnresolved(ops),
            hint: "Current window",
          },
          {
            label: "Allocation mode",
            value: wiredValue(
              selectWired(ops, (o) => o.miningNoteMode),
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
      <div className="grid min-w-0 grid-cols-1 gap-[var(--ct-space-4)] xl:grid-cols-[2fr_1fr]">
        <Series1BitcoinAccumulation motive={miningMotive} />
        <Series1CapitalArchitecture
          pockets={pocketAllocations}
          policyNotice={
            strategiesWired
              ? null
              : "the measured pocket allocation appears once the v2.1 contract is deployed"
          }
        />
      </div>

      <Series1DashboardSection
        title="Mining register and reserve"
        description="Operational reports, kept separate from the investor outcome."
      >
        <div className="grid min-w-0 grid-cols-1 gap-[var(--ct-space-3)] lg:grid-cols-3">
          <Series1CapitalFlow />
          <Series1MiningRegister
            title="Mining register"
            caption="Reported on-chain by the keeper"
            trailing={<Series1Provenance read={mining} />}
            motive={miningMotive}
            rows={[
              {
                label: "BTC earned",
                value: wiredValue(
                  selectWired(mining, (m) => m.totalBtcEarnedSats),
                  (s) => formatBtcFromSats(s),
                ),
                muted: isUnresolved(mining),
                hint: "Cumulative, delivered at maturity",
              },
              {
                label: "Last report",
                value: wiredValue(
                  selectWired(mining, (m) => m.lastReportTime),
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
            title="Reserve and contract"
            caption="B3 Operating Reserve funds electricity; the contract state is read directly."
            trailing={<Series1Provenance read={elec} />}
            motive={reserveMotive ?? contractMotive}
            rows={[
              {
                label: "Monthly electricity cost",
                value: wiredValue(
                  selectWired(elec, (e) => e.monthlyElecCost),
                  (c) => formatUsdcAmount(c),
                ),
                muted: isUnresolved(elec),
              },
              {
                label: "Total paid since inception",
                value: wiredValue(
                  selectWired(elec, (e) => e.totalElecPaid),
                  (t) => formatUsdcAmount(t),
                ),
                muted: isUnresolved(elec),
              },
              {
                label: "Last payment",
                value: wiredValue(
                  selectWired(elec, (e) => e.lastElecPaymentTime),
                  (t) =>
                    t > 0n
                      ? new Date(Number(t) * 1000).toISOString().slice(0, 10)
                      : "Never paid",
                ),
                muted: isUnresolved(elec),
              },
              {
                label: "Underlying asset",
                value: wiredValue(
                  selectWired(core, (c) => c.asset),
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
