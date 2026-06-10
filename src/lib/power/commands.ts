/**
 * Command registry for the ⌘K command palette.
 *
 * 30 commands across 4 sections: Navigate, Action, Search, View.
 * No external deps — pure data module.
 */

export type CommandSection = "Navigate" | "Action" | "Search" | "View";

export type Command = {
  id: string;
  label: string;
  section: CommandSection;
  /** Present on Navigate commands — triggers router.push(href). */
  href?: string;
  /** Present on Action/Search/View commands — called on Enter. */
  handler?: () => void;
  /** Extra terms for fuzzy matching (beyond the label). */
  keywords?: string[];
  /** Displayed shortcut badge, e.g. "g d". */
  shortcut?: string;
};

// ── Section order for rendering ──────────────────────────────────────────────

export const SECTION_ORDER: CommandSection[] = [
  "Navigate",
  "Action",
  "Search",
  "View",
];

// ── Static commands (handler-less; client layer injects handlers at runtime) ──
// NOTE: `handler` is intentionally absent here — it cannot be serialised.
//       The provider binds real handlers after reading the registry.

/** Navigate (10) */
const NAVIGATE_COMMANDS: Omit<Command, "handler">[] = [
  {
    id: "nav-dashboard",
    label: "Dashboard",
    section: "Navigate",
    href: "/admin/dashboard",
    keywords: ["home", "overview", "main"],
    shortcut: "g d",
  },
  {
    id: "nav-vaults",
    label: "Vaults",
    section: "Navigate",
    href: "/admin/vaults",
    keywords: ["vault", "allocation", "treasury"],
    shortcut: "g v",
  },
  {
    id: "nav-investors",
    label: "Investors",
    section: "Navigate",
    href: "/admin/customers",
    keywords: ["customers", "lp", "limited partners", "investors"],
    shortcut: "g i",
  },
  {
    id: "nav-distributions",
    label: "Distributions",
    section: "Navigate",
    href: "/admin/distributions",
    keywords: ["dist", "usdc", "payout", "distributions"],
    shortcut: "g y",
  },
  {
    id: "nav-proofs",
    label: "Proofs",
    section: "Navigate",
    href: "/admin/proofs",
    keywords: ["proof", "por", "attestation", "proof-of-reserves"],
  },
  {
    id: "nav-signers",
    label: "Signers Queue",
    section: "Navigate",
    href: "/admin/monitoring",
    keywords: ["signer", "multisig", "queue", "approvals", "signatures"],
    shortcut: "g s",
  },
  {
    id: "nav-scenarios",
    label: "Scenarios",
    section: "Navigate",
    href: "/admin/scenario-lab",
    keywords: ["scenario", "simulation", "stress", "lab", "engine"],
    shortcut: "g l",
  },
  {
    id: "nav-memos",
    label: "Investor Memos",
    section: "Navigate",
    href: "/admin/investor-memo",
    keywords: ["memo", "investor", "report", "document"],
    shortcut: "g m",
  },
  {
    id: "nav-audit",
    label: "Audit Trail",
    section: "Navigate",
    href: "/admin/roadmap",
    keywords: ["audit", "trail", "log", "history", "events"],
    shortcut: "g a",
  },
  {
    id: "nav-governance",
    label: "Governance",
    section: "Navigate",
    href: "/admin/governance",
    keywords: ["governance", "policy", "compliance", "legal"],
    shortcut: "g g",
  },
];

/** Action (10) */
const ACTION_COMMANDS: Omit<Command, "href">[] = [
  {
    id: "action-pause-vault",
    label: "Pause vault",
    section: "Action",
    keywords: ["pause", "halt", "freeze", "stop vault"],
  },
  {
    id: "action-approve-signers",
    label: "Approve all signers",
    section: "Action",
    keywords: ["approve", "signers", "multisig", "confirm"],
  },
  {
    id: "action-generate-memo",
    label: "Generate memo",
    section: "Action",
    keywords: ["generate", "memo", "ai", "report", "create"],
  },
  {
    id: "action-oracle-refresh",
    label: "Trigger oracle refresh",
    section: "Action",
    keywords: ["oracle", "refresh", "price", "feed", "update"],
  },
  {
    id: "action-stress-scenario",
    label: "Run scenario stress",
    section: "Action",
    keywords: ["stress", "scenario", "simulation", "run", "engine"],
  },
  {
    id: "action-rotate-signer",
    label: "Rotate signer key",
    section: "Action",
    keywords: ["rotate", "signer", "key", "security", "multisig"],
  },
  {
    id: "action-new-distribution",
    label: "New distribution",
    section: "Action",
    keywords: ["new", "distribution", "usdc", "payout", "create"],
  },
  {
    id: "action-mint-proof",
    label: "Mint proof",
    section: "Action",
    keywords: ["mint", "proof", "nft", "attestation", "create"],
  },
  {
    id: "action-export-lp",
    label: "Export LP register CSV",
    section: "Action",
    keywords: ["export", "lp", "register", "csv", "download", "investors"],
  },
  {
    id: "action-export-audit",
    label: "Export audit log",
    section: "Action",
    keywords: ["export", "audit", "log", "download", "csv"],
  },
];

/** Search (5) */
const SEARCH_COMMANDS: Omit<Command, "href">[] = [
  {
    id: "search-address",
    label: "Search by address 0x…",
    section: "Search",
    keywords: ["address", "wallet", "0x", "ethereum", "hex"],
  },
  {
    id: "search-tx",
    label: "Search by tx hash",
    section: "Search",
    keywords: ["tx", "transaction", "hash", "onchain", "block"],
  },
  {
    id: "search-dist",
    label: "Search dist_xxx",
    section: "Search",
    keywords: ["dist", "distribution", "id", "reference"],
  },
  {
    id: "search-sig",
    label: "Search sig_xxx",
    section: "Search",
    keywords: ["sig", "signature", "signer", "id", "reference"],
  },
  {
    id: "search-lp-name",
    label: "Search LP by name",
    section: "Search",
    keywords: ["lp", "limited partner", "investor", "name", "person"],
  },
];

/** View (5) */
const VIEW_COMMANDS: Omit<Command, "href">[] = [
  {
    id: "view-compliance",
    label: "Switch Compliance view",
    section: "View",
    keywords: ["compliance", "kyc", "aml", "regulatory", "view"],
  },
  {
    id: "view-treasury",
    label: "Switch Treasury view",
    section: "View",
    keywords: ["treasury", "finance", "accounting", "balance", "view"],
  },
  {
    id: "view-events-24h",
    label: "Last 24h events",
    section: "View",
    keywords: ["events", "24h", "recent", "activity", "feed"],
  },
  {
    id: "view-density",
    label: "Toggle density",
    section: "View",
    keywords: ["density", "compact", "comfortable", "layout", "display"],
  },
  {
    id: "view-help",
    label: "Help & shortcuts",
    section: "View",
    keywords: ["help", "shortcuts", "keyboard", "docs", "commands"],
    shortcut: "?",
  },
];

// ── Registry (static — no handlers) ─────────────────────────────────────────

export const COMMAND_REGISTRY: Command[] = [
  ...NAVIGATE_COMMANDS,
  ...ACTION_COMMANDS,
  ...SEARCH_COMMANDS,
  ...VIEW_COMMANDS,
] as Command[];

// ── Fuzzy search ──────────────────────────────────────────────────────────────

/**
 * Simple token-based fuzzy match.
 * Returns true if every character of `query` appears in order in `text`.
 */
function fuzzyMatch(text: string, query: string): boolean {
  if (query.length === 0) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    if (ch === undefined) break;
    const found = t.indexOf(ch, ti);
    if (found === -1) return false;
    ti = found + 1;
  }
  return true;
}

/**
 * Returns the commands that match `query`, preserving section order.
 * When `query` is empty, returns all commands.
 */
export function filterCommands(commands: Command[], query: string): Command[] {
  const q = query.trim();
  if (q.length === 0) return commands;

  return commands.filter((cmd) => {
    const searchable = [
      cmd.label,
      ...(cmd.keywords ?? []),
      cmd.section,
    ].join(" ");
    return fuzzyMatch(searchable, q);
  });
}

/**
 * Groups commands by section, maintaining SECTION_ORDER.
 */
export function groupBySection(
  commands: Command[],
): Map<CommandSection, Command[]> {
  const map = new Map<CommandSection, Command[]>(
    SECTION_ORDER.map((s) => [s, []]),
  );
  for (const cmd of commands) {
    const bucket = map.get(cmd.section);
    if (bucket) bucket.push(cmd);
  }
  return map;
}
