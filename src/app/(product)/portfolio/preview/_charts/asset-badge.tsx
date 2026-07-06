/**
 * AssetBadge — a small round asset identity mark for the sandbox: the real Bitcoin / USDC logo
 * (colored SVG badge from /public) or, for Hearst mining power (wordmark-only, no round icon), a
 * green compute glyph on the accent. Server component, token-only for the Hearst case; the crypto
 * badges are already brand-colored. Reusable across pockets / stats / bridge so asset identity is
 * consistent everywhere. `<img>` is used deliberately (static colored SVG, no optimization needed).
 */
import { Cpu } from "lucide-react";

import { ASSET_LOGO, type AssetKind } from "../_data/brand";

export function AssetBadge({
  asset,
  size = 20,
}: {
  asset: AssetKind;
  size?: number;
}) {
  const logo = ASSET_LOGO[asset];
  if (logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo.src}
        alt={logo.alt}
        width={size}
        height={size}
        className="shrink-0 rounded-full"
        style={{ width: size, height: size, display: "block" }}
      />
    );
  }
  // Hearst / mining power — accent badge with a compute glyph.
  return (
    <span
      aria-label="Hearst mining power"
      role="img"
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: "var(--ct-accent)", color: "var(--ct-bg-deep)" }}
    >
      <Cpu size={Math.round(size * 0.58)} strokeWidth={2.25} aria-hidden="true" />
    </span>
  );
}
