/**
 * @hearst/cockpit-shell — exports publics.
 *
 * Stylesheet à importer une fois dans `app/layout.tsx` :
 *   `import "@hearst/cockpit-shell/tokens.css";`
 */

// Shell
export { CockpitShell } from "./shell/CockpitShell";
export { RailLeft } from "./shell/RailLeft";
export { CenterPanel } from "./shell/CenterPanel";
export { RailRight } from "./shell/RailRight";
export { ChatRailToggle } from "./shell/ChatRailToggle";
export { ThemeAccent } from "./shell/ThemeAccent";
export { HearstMark } from "./shell/HearstMark";
export { useCockpit } from "./shell/context";
export { attachHubBridge, pushContext } from "./shell/hubBridge";
export type { HubContext } from "./shell/hubBridge";
export type {
  CockpitShellProps,
  CockpitProduct,
  CenterPanelProps,
} from "./shell/types";

// Chat
export { ChatKimi } from "./chat/ChatKimi";
export { ChatSettings } from "./chat/ChatSettings";
export { ChatHistory } from "./chat/ChatHistory";
export { useChat } from "./chat/useChat";
export type { UseChatOptions, UseChatReturn, DisplayMessage } from "./chat/useChat";
export type { ChatPersistence, ChatMessage, ChatConfig } from "./chat/types";

// Stores (pour les apps qui veulent piloter l'état du shell depuis l'extérieur)
export {
  subscribe as subscribeActiveProduct,
  setDefaultActive,
  getSnapshot as getActiveProduct,
  setActive as setActiveProduct,
} from "./stores/activeProductStore";
export {
  subscribe as subscribeRailRight,
  getSnapshot as getRailRightOpen,
  getServerSnapshot as getRailRightOpenServer,
  getModeSnapshot as getRailRightMode,
  getModeServerSnapshot as getRailRightModeServer,
  forceOpen as forceOpenRailRight,
  toggle as toggleRailRight,
  toggleWidth as toggleRailRightWidth,
} from "./stores/railOpenStore";
export type { RailRightMode } from "./stores/railOpenStore";
export { subscribe as subscribeLauncher } from "./stores/launcherStore";
