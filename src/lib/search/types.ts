/**
 * Global Search — shared types.
 * Safe to import from both client and server code (no side effects, no I/O).
 */

export type Entity =
  | "vault"
  | "investor"
  | "position"
  | "distribution"
  | "proof"
  | "signature"
  | "scenario"
  | "backtest"
  | "memo"
  | "event";

export interface SearchResult {
  entity: Entity;
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  href: string;
  score?: number;
}

/** Max results returned per entity section. */
export const MAX_PER_SECTION = 8;

/** Regex patterns used for direct-jump detection. */
export const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
export const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

/** ID-prefix → entity mapping for entity-specific lookups. */
export const ID_PREFIX_MAP: Record<string, Entity> = {
  cu_: "investor",
  dist_: "distribution",
  sig_: "signature",
  "HYV-": "vault",
};

export interface SearchApiResponse {
  results: SearchResult[];
  /** Server-stamped query echo for stale-check in the client. */
  query: string;
  /** Whether a direct-jump was detected. */
  directJump: boolean;
  directHref?: string;
}
