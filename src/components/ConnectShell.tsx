import { CockpitShell } from "@hearst/cockpit-shell";
import type { ChatConfig } from "@hearst/cockpit-shell";
import type { ReactNode } from "react";
import { CONNECT_ACCENT_HEX } from "@/lib/brand-constants";

const CONNECT_ACCENT = CONNECT_ACCENT_HEX;

const CONNECT_PRODUCTS = [
  { id: "connect" as const, name: "Hearst Connect", short: "CN", color: CONNECT_ACCENT },
];

const CHAT_CONFIG: ChatConfig = {
  apiEndpoint: "/api/cockpit-chat",
  productContext: "Hearst Connect — Institutional RWA yield vault backed by Bitcoin mining cash flows. Principal held in a USDC reserve (Model B); monthly USDC distributions funded by mining revenue-share; BTC is an economic factor, not the primary exposure. Target net range 8–15%.",
};

export function ConnectShell({
  children,
  footer,
  enableChat = false,
  masterAgentEnabled,
}: {
  children: ReactNode;
  footer?: ReactNode;
  enableChat?: boolean;
  masterAgentEnabled?: boolean;
}) {
  return (
    <CockpitShell
      products={CONNECT_PRODUCTS}
      appId="connect"
      chatConfig={
        enableChat
          ? { ...CHAT_CONFIG, masterAgentEnabled }
          : undefined
      }
      footer={footer}
    >
      {children}
    </CockpitShell>
  );
}
