import { Metric } from "@/components/ui/metric";
import type { Provenance } from "@/components/ui/provenance-badge";

export interface CommandStripCell {
  /** Short institutional label, e.g. "Capital deployed". */
  label: string;
  /** Headline value — string or composite (e.g. an <ApyRange/>). */
  value: React.ReactNode;
  /** Secondary context line under the value. */
  sublabel?: string;
  /** Provenance badge kind. Omit only when genuinely not applicable. */
  provenance?: Provenance;
  /** Hover hint expanding on the metric. */
  tooltip?: string;
}

/**
 * Executive command strip — the top band of the admin command center. Answers
 * "is the platform healthy, where is capital, is yield in band, where is risk,
 * is proof current, what needs action" at a glance. Each cell is the dense
 * dashboard `Metric` treatment so provenance and units stay legible. Six cells
 * collapse 6→3→2 columns as the centre panel narrows (chat rail open / tablet /
 * mobile) — never clipping a badge or unit.
 */
export function CommandStrip({ cells }: { cells: CommandStripCell[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 2xl:grid-cols-6">
      {cells.map((cell) => (
        <Metric
          key={cell.label}
          variant="dashboard"
          label={cell.label}
          value={cell.value}
          sublabel={cell.sublabel}
          provenance={cell.provenance}
          tooltip={cell.tooltip}
        />
      ))}
    </div>
  );
}
