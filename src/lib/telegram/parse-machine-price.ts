/**
 * parse-machine-price.ts — PURE parser (no I/O, fully testable).
 *
 * Turns a Letine-style daily price list (Telegram text) into structured machine
 * price samples. Calibrated on @LetineSidonia "Letine Mining Update Miner Price"
 * messages, which are grouped under cooling headers and list one model per line:
 *
 *   *Air Cooling*
 *   S21++ 235T: $1296 (6U/T)
 *   *Hydro Cooling*
 *   S21+ Hyd 358T: $2273 (6.35U/T)
 *   *Whatsminer BTC Miners*
 *   M63S 18.5W 372/374/390/398T: $6.6/T      ← price quoted per-TH
 *
 * Two price conventions appear:
 *   - unit price:   "$1296"          → priceUsd, perTh = priceUsd / th
 *   - per-TH price: "$6.6/T"         → perThUsd, priceUsd = perThUsd * th
 *
 * The amortization period is decided by cooling (air 36m, hydro/immersion 60m)
 * but that math lives in the engine layer, NOT here — this file only extracts.
 */

export type Cooling = "air" | "hydro" | "immersion" | "unknown";

export interface MachinePriceSample {
  /** Raw model label as listed, e.g. "S21++ 235T". */
  model: string;
  cooling: Cooling;
  /** Hashrate in TH/s parsed from the model line (e.g. 235). */
  thPerUnit: number;
  /** Unit price in USD (derived when only a per-TH price is quoted). */
  priceUsd: number;
  /** Price per TH/s in USD (derived when only a unit price is quoted). */
  perThUsd: number;
  /**
   * Energy efficiency in J/TH (= W per TH/s) when stated in the line, else null.
   * Letine encodes it as "18.5W", "14.9J", "13.5w" etc. next to the model.
   */
  efficiencyJTh: number | null;
  /** Verbatim source line (audit trail). */
  rawLine: string;
}

export interface ParsedPriceList {
  /** Date string from the message header, ISO yyyy-mm-dd when resolved. */
  listDate: string | null;
  samples: MachinePriceSample[];
}

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** Parse "(26th June. 2026)" / "25th June. 2026" → "2026-06-26". */
export function parseListDate(text: string): string | null {
  const m = text.match(/(\d{1,2})(?:st|nd|rd|th)?\.?\s+([A-Za-z]{3})[A-Za-z.]*\.?\s+(\d{4})/);
  if (!m || !m[1] || !m[2] || !m[3]) return null;
  const day = m[1].padStart(2, "0");
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
  const year = m[3];
  if (!mon) return null;
  return `${year}-${mon}-${day}`;
}

/** Classify a cooling section header line. Returns null if not a header. */
function coolingFromHeader(line: string): Cooling | null {
  const l = line.toLowerCase();
  if (!l.includes("cooling") && !l.includes("immersion")) return null;
  if (l.includes("immersion") || l.includes("oil")) return "immersion";
  if (l.includes("hydro")) return "hydro";
  if (l.includes("air")) return "air";
  return null;
}

/** Cooling implied by the model label itself (overrides section when explicit). */
function coolingFromModel(model: string): Cooling | null {
  const l = model.toLowerCase();
  if (/\b(imm|immersion)\b/.test(l)) return "immersion";
  if (/\bhyd\b|hydro/.test(l)) return "hydro";
  return null;
}

/** First TH value in a line: "235T", "372/374/390T", "4.8TH/s", "90T". */
function parseTh(label: string): number | null {
  const m = label.match(/(\d+(?:\.\d+)?)\s*T(?:H)?(?:\/s)?\b/i);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * Efficiency J/TH (= W per TH) from a model label. Letine writes it as a
 * standalone "18.5W", "14.9J", "13.5w" token — NOT the hashrate "235T". We take
 * the first plausible value in [5, 60] J/TH (real ASIC band) to avoid catching
 * unrelated numbers (e.g. "16w" immersion notes, kW radiator specs).
 */
function parseEfficiency(label: string): number | null {
  const matches = label.matchAll(/(\d+(?:\.\d+)?)\s*([JjWw])\b/g);
  for (const m of matches) {
    const v = Number(m[1]);
    if (Number.isFinite(v) && v >= 5 && v <= 60) return v;
  }
  return null;
}

/**
 * Parse one price line. Returns null when the line carries no usable price.
 * Examples handled:
 *   "S21++ 235T: $1296 (6U/T)"
 *   "M63S 18.5W 372/374/390T: $6.6/T"
 *   "Avalon Q 90T: $1365"
 */
export function parsePriceLine(
  rawLine: string,
  sectionCooling: Cooling,
): MachinePriceSample | null {
  const line = rawLine.trim();
  if (!line || !line.includes("$")) return null;

  // Split "model : price" on the LAST colon before the first '$'.
  const dollarIdx = line.indexOf("$");
  const head = line.slice(0, dollarIdx);
  const colonIdx = head.lastIndexOf(":");
  if (colonIdx < 0) return null;

  const model = head.slice(0, colonIdx).trim();
  if (!model) return null;

  const th = parseTh(model);
  if (th === null) return null; // need hashrate to be useful

  // Price token: either "$6.6/T" (per-TH) or "$1296" (unit).
  const priceChunk = line.slice(dollarIdx);
  const perThMatch = priceChunk.match(/\$\s*(\d+(?:\.\d+)?)\s*\/\s*T/i);
  const unitMatch = priceChunk.match(/\$\s*(\d+(?:[.,]\d+)?)/);

  let priceUsd: number;
  let perThUsd: number;
  if (perThMatch?.[1]) {
    perThUsd = Number(perThMatch[1]);
    priceUsd = perThUsd * th;
  } else if (unitMatch?.[1]) {
    priceUsd = Number(unitMatch[1].replace(",", ""));
    perThUsd = priceUsd / th;
  } else {
    return null;
  }
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) return null;

  const cooling = coolingFromModel(model) ?? sectionCooling;

  return {
    model,
    cooling,
    thPerUnit: th,
    priceUsd: round(priceUsd, 2),
    perThUsd: round(perThUsd, 4),
    efficiencyJTh: parseEfficiency(model),
    rawLine: line,
  };
}

/** Parse a full Letine-style message into a dated list of samples. */
export function parseMachinePriceMessage(text: string): ParsedPriceList {
  const listDate = parseListDate(text);
  const samples: MachinePriceSample[] = [];
  let section: Cooling = "unknown";

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const header = coolingFromHeader(line);
    if (header) {
      section = header;
      continue;
    }
    // A bold section that is NOT a cooling header (e.g. "*Whatsminer BTC Miners*")
    // resets the section to unknown so per-line cooling hints take over.
    if (/^\*.*\*$/.test(line) && !line.includes("$")) {
      section = "unknown";
      continue;
    }

    const sample = parsePriceLine(line, section);
    if (sample) samples.push(sample);
  }

  return { listDate, samples };
}

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
