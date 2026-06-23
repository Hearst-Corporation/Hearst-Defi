/**
 * Deterministic USD compact labels (SSR + client must match).
 * Avoids Node vs browser ICU differences on Intl compact notation ($500.0K vs $500K).
 *
 * Refined: small values (< $100) show cents for precision; $100-$999 show integers.
 */
export function formatUsdCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    const text = m >= 10 ? m.toFixed(0) : m.toFixed(1);
    return `${sign}$${text}M`;
  }

  if (abs >= 1_000) {
    const k = abs / 1_000;
    const text = Number.isInteger(k) ? String(Math.round(k)) : k.toFixed(1);
    return `${sign}$${text}K`;
  }

  // Small values: show cents if under $100 for precision, integers for $100-$999
  if (abs < 100) {
    return `${sign}$${abs.toFixed(2)}`;
  }

  return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
}
