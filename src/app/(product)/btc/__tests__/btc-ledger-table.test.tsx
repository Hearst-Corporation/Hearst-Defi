// BtcLedgerTable — P2.4 register upgrade tests (owned by the P2.4 lot).
// Pattern: renderToStaticMarkup (vitest env = node, no RTL/jsdom — cf.
// btc-page-content.render.test.tsx).
//
// Locks:
//  - running balance is a PURE view-model fold (buildBtcLedgerRows), anchored
//    on the reserve's closing balance, walked backwards; no anchor → null
//    (the table renders "—", never a balance folded from a fabricated base);
//  - tx hash column: mono truncated + Catalyst copy button per row;
//  - month band rows (th scope="colgroup") + tfoot Total movements / Net BTC;
//  - "Verified" badge is NOT on the green success/accent tone — the single
//    green stays reserved for real Live.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { BtcLedgerTable } from "../_components/btc-ledger-table";
import { buildBtcLedgerRows } from "../_data/btc-ledger-rows";
import { btcPageExtraCompleteFixture } from "../_data/btc-page-fixtures";

const EVENTS = btcPageExtraCompleteFixture.events.value ?? [];
// Matches the complete fixture's vault reserve (6.12 BTC).
const CLOSING_SATS = "612000000";

describe("buildBtcLedgerRows — running balance fold", () => {
  it("anchors on the closing balance and walks backwards through movements", () => {
    const rows = buildBtcLedgerRows(EVENTS, CLOSING_SATS);

    // Newest first (register convention).
    expect(rows.map((r) => r.occurredAt)).toEqual(
      [...EVENTS].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).map((r) => r.occurredAt),
    );

    // 06-30 mining settlement (+0.517) closes AT the reserve figure.
    expect(rows[0]?.label).toContain("Mining settlement");
    expect(rows[0]?.balanceAfterSats).toBe("612000000");
    // Same-day attestation: no balance change, no figure.
    expect(rows[1]?.deltaSats).toBeNull();
    expect(rows[1]?.balanceAfterSats).toBeNull();
    // 06-28 purchase (+0.091): 612M − 51.7M = 560.3M.
    expect(rows[2]?.balanceAfterSats).toBe("560300000");
    // 06-15 conversion (−0.032): 560.3M − 9.1M = 551.2M.
    expect(rows[3]?.balanceAfterSats).toBe("551200000");
    // 06-01 attestation.
    expect(rows[4]?.balanceAfterSats).toBeNull();
  });

  it("renders no balance at all without an anchor (honest, not fabricated)", () => {
    const rows = buildBtcLedgerRows(EVENTS, null);
    expect(rows.every((r) => r.balanceAfterSats === null)).toBe(true);
  });
});

describe("BtcLedgerTable — register rendering (P2.4)", () => {
  const html = renderToStaticMarkup(
    <BtcLedgerTable events={buildBtcLedgerRows(EVENTS, CLOSING_SATS)} provenance="simulated" />,
  );

  it("shows the Balance after column with folded figures", () => {
    expect(html).toContain("Balance after");
    expect(html).toContain("6.1200 BTC");
    expect(html).toContain("5.6030 BTC");
    expect(html).toContain("5.5120 BTC");
  });

  it("shows tx hashes mono-truncated with a copy button per row", () => {
    expect(html).toContain("Tx hash");
    expect(html).toContain("0x8f2a...c19e");
    expect(html).toContain("0x1d90...44ab");
    expect(html).toContain(
      "Copy transaction hash for Mining settlement credited to B2 reserve",
    );
    expect(html).toContain(">Copy<");
  });

  it("groups rows under a month band and totals them in a tfoot", () => {
    expect(html).toContain('scope="colgroup"');
    expect(html).toContain("Jun 2026");
    expect(html).toContain("<tfoot>");
    expect(html).toContain("Total movements (3)");
    // Net over the period: +0.517 + 0.091 − 0.032 = +0.576 BTC.
    expect(html).toContain("+0.576 BTC");
  });

  it("keeps signed deltas with no red and the plus on inflows", () => {
    expect(html).toContain("+0.517 BTC");
    expect(html).toContain("0.032 BTC");
  });

  it("renders Verified OFF the green success tone (green = Live only)", () => {
    const verifiedBadge = /<span class="([^"]*)">Verified<\/span>/.exec(html);
    expect(verifiedBadge).not.toBeNull();
    expect(verifiedBadge?.[1] ?? "").not.toContain("success");
    expect(verifiedBadge?.[1] ?? "").not.toContain("--ct-accent");
    const confirmedBadge = /<span class="([^"]*)">Confirmed<\/span>/.exec(html);
    expect(confirmedBadge?.[1] ?? "").not.toContain("success");
    expect(confirmedBadge?.[1] ?? "").not.toContain("--ct-accent");
  });

  it("accepts raw events without a balance field (compat) and stays honest", () => {
    const compat = renderToStaticMarkup(
      <BtcLedgerTable events={EVENTS} provenance="simulated" />,
    );
    expect(compat).toContain("Balance after");
    expect(compat).not.toContain("6.1200 BTC");
  });

  it("renders the honest empty state without a table", () => {
    const empty = renderToStaticMarkup(<BtcLedgerTable events={[]} provenance="simulated" />);
    expect(empty).toContain("Bitcoin movements will appear here once settlements are indexed.");
    expect(empty).not.toContain("<table");
  });
});
