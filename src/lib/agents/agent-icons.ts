import {
  BrainCircuit,
  ClipboardCheck,
  FileText,
  type LucideIcon,
  MessageSquare,
  Send,
  ServerCog,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import type { AgentIconKey } from "@/lib/agents/agent-catalog";

/**
 * Icon key → lucide component. Single source of truth shared by the agent
 * catalog page and the template form (both render the same agent glyphs).
 * Kept out of `agent-catalog.ts` so the catalog stays data-only (no React
 * component imports) and out of `agent-template-constants.ts` so that
 * client-safe text constants stay free of lucide.
 */
export const AGENT_ICONS: Record<AgentIconKey, LucideIcon> = {
  chat: MessageSquare,
  narrative: Sparkles,
  memo: FileText,
  mining: ServerCog,
  risk: ShieldAlert,
  outreach: Send,
  memory: BrainCircuit,
  review: ClipboardCheck,
};
