import { CockpitShell } from "@hearst/cockpit-shell";
import type { ChatConfig } from "@hearst/cockpit-shell";
import type { ReactNode } from "react";

/** Mirrors --ct-accent / --ct-product-connect in cockpit.css */
const CONNECT_ACCENT = "#A7FB90";

const CONNECT_PRODUCTS = [
  { id: "connect" as const, name: "Hearst Connect", short: "CN", color: CONNECT_ACCENT },
];

const CHAT_CONFIG: ChatConfig = {
  apiEndpoint: "/api/cockpit-chat",
  productContext: "Hearst Connect — Institutional RWA yield vault backed by Bitcoin mining cash flows. Principal held in a USDC reserve (Model B); monthly USDC distributions funded by mining revenue-share; BTC is an economic factor, not the primary exposure. Target net range 8–15%.",
};

export function ConnectShell({
  children,
  enableChat = false,
}: {
  children: ReactNode;
  enableChat?: boolean;
}) {
  return (
    <CockpitShell
      products={CONNECT_PRODUCTS}
      appId="connect"
      chatConfig={enableChat ? CHAT_CONFIG : undefined}
    >
      {children}
    </CockpitShell>
  );
}
