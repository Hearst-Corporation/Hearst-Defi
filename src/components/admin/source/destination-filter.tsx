"use client";

// Destination filter — the customs-duty destination toggle for the machines
// market. Routes via the URL (`?dest=`) so the cost model (landed = ex-works +
// freight + duty) re-derives server-side. Canon DS: it renders the SegmentedControl
// primitive instead of a hand-rolled row of <a> links, so its active/quiet/focus
// language matches the cooling filter and every other segmented control.

import { useRouter } from "next/navigation";

import { SegmentedControl } from "@/components/catalyst/segmented-control";
import {
  COUNTRY_LABELS,
  CUSTOMS_DUTY_PCT,
  DEFAULT_DESTINATION,
  type DestinationCountry,
} from "@/lib/telegram/cost-model";

const COUNTRY_ORDER: DestinationCountry[] = [
  "china",
  "uae",
  "france",
  "usa",
  "russia",
];

export function DestinationFilter({
  destination,
}: {
  destination: DestinationCountry;
}) {
  const router = useRouter();

  const items = COUNTRY_ORDER.map((c) => ({
    value: c,
    label: (
      <span>
        {COUNTRY_LABELS[c]} · {CUSTOMS_DUTY_PCT[c]}%
      </span>
    ),
  }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="ct-bento-label">Destination</span>
      <SegmentedControl
        items={items}
        value={destination}
        onChange={(c) =>
          router.push(
            c === DEFAULT_DESTINATION ? "/admin/source" : `/admin/source?dest=${c}`,
          )
        }
        ariaLabel="Destination douane"
        variant="radiogroup"
      />
    </div>
  );
}
