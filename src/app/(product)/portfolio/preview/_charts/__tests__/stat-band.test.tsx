import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatBand, type StatCell } from "../stat-band";

/**
 * Scoped to the two new props added for the BTC-amber + hero-tier calibration:
 *  - valueTone="btc" → the value keeps the neutral/white class (never green), the
 *    amber identity (--ct-cat-btc) lands on the affix/dot only.
 *  - hero → the value picks up the DS hero-number tier class (.ct-text-hero-tier).
 * Component wasn't under test before this pass — stays scoped to these cases.
 */
describe("StatBand — valueTone=\"btc\"", () => {
  it("keeps the value neutral (not accent green) and puts amber on the affix", () => {
    const items: readonly StatCell[] = [
      {
        label: "Collateral",
        value: "3.20",
        affix: "BTC",
        valueTone: "btc",
        provenance: "estimated",
      },
    ];
    const html = renderToStaticMarkup(<StatBand items={items} />);
    expect(html).toContain("ct-bento-metric");
    expect(html).toContain("ct-text-strong");
    expect(html).not.toContain("ct-bento-metric--accent");
    expect(html).toContain("ct-text-cat-btc");
    expect(html).toContain("var(--ct-cat-btc)");
  });

  it("without an explicit asset, renders the BTC identity dot in amber", () => {
    const items: readonly StatCell[] = [
      { label: "Debt", value: "185.4k", valueTone: "btc", provenance: "estimated" },
    ];
    const html = renderToStaticMarkup(<StatBand items={items} />);
    expect(html).toContain('style="background:var(--ct-cat-btc)"');
  });
});

describe("StatBand — hero", () => {
  it("applies the DS hero-number tier class to the value", () => {
    const items: readonly StatCell[] = [
      { label: "Deployed", value: "$531.4k", hero: true, provenance: "estimated" },
    ];
    const html = renderToStaticMarkup(<StatBand items={items} />);
    expect(html).toContain("ct-text-hero-tier");
  });

  it("without hero, the value does not carry the hero-tier class", () => {
    const items: readonly StatCell[] = [
      { label: "Deposit", value: "$500k", provenance: "estimated" },
    ];
    const html = renderToStaticMarkup(<StatBand items={items} />);
    expect(html).not.toContain("ct-text-hero-tier");
  });
});

describe("StatBand — regressions preserved", () => {
  it("a zero value stays neutral even with valueTone=\"btc\"", () => {
    const items: readonly StatCell[] = [
      { label: "Debt", value: "$0", valueTone: "btc", provenance: "estimated" },
    ];
    const html = renderToStaticMarkup(<StatBand items={items} />);
    expect(html).toContain("ct-text-strong");
    expect(html).not.toContain("ct-bento-metric--accent");
  });

  it("the live heartbeat pulse still renders for live cells", () => {
    const items: readonly StatCell[] = [
      { label: "Hashprice", value: "$46.20", live: true, provenance: "live" },
    ];
    const html = renderToStaticMarkup(<StatBand items={items} />);
    expect(html).toContain("hyv-pulse");
  });
});
