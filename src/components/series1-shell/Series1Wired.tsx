/**
 * Series1Wired — the honest rendering of a `Wired<T>` read.
 *
 * The adapter (`src/lib/chain/dynavault.ts`) never invents a value: a read is
 * either `wired` (with source / address / readAt) or `unavailable` (with a
 * MOTIVE). This module is the one place the Series 1 surfaces turn that
 * envelope into pixels, and its whole job is to not lose information on the
 * way: an RPC outage must never look like "no data", and a contract that isn't
 * deployed must never look like a zero.
 *
 * Deliberately NOT `@/components/catalyst/wired-chip`: that chip is built on
 * `--ct-*` tokens, which the Series 1 shell does not use. The vocabulary below
 * mirrors its labels so both surfaces say the same thing about the same motive.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A `Wired<T>` after it crosses into a Server Component. Structurally the
 * adapter's own type; restated here so this module imports no `server-only`
 * code (it renders on both sides of the boundary).
 */
export type Series1Wired<T> =
  | {
      status: "wired";
      data: T;
      source: "v2" | "legacy";
      address: string;
      chainId: number;
      readAt: string;
    }
  | { status: "unavailable"; reason: string; detail?: string };

/**
 * Motives this UI knows how to name. Kept in sync with
 * `UNAVAILABLE_REASONS` (dynavault.ts) + `REASON_NOT_EXPOSED_BY_CONTRACT`
 * (wired-json.ts) + the route-level motives. An unknown motive degrades to its
 * raw string rather than to silence — never a blank, never a zero.
 */
const REASON_LABELS: Record<string, string> = {
  not_deployed: "Contract not deployed",
  not_supported_by_legacy: "Not exposed in legacy mode",
  not_exposed_by_contract: "Not exposed by contract",
  rpc_error: "Read unavailable",
  revert: "Rejected by contract",
  decode_error: "Unexpected contract response",
  invalid_input: "Invalid request",
  tvl_cap_zero: "No cap configured",
  no_session: "Sign in required",
  no_wallet: "No wallet linked",
};

export function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

/** Short provenance line: which contract answered, and when. */
export function Series1Provenance({ read }: { read: Series1Wired<unknown> }) {
  if (read.status === "unavailable") {
    return (
      <span className="text-[10px]" style={{ color: "var(--s1-muted)" }}>
        {reasonLabel(read.reason)}
      </span>
    );
  }
  const label = read.source === "v2" ? "PermissionedDynaVault v2.1" : "Legacy vault";
  return (
    <span className="text-[10px]" style={{ color: "var(--s1-muted)" }}>
      {label} · read {new Date(read.readAt).toISOString().slice(11, 16)} UTC
    </span>
  );
}

/**
 * A single value row driven by a `Wired` read.
 *
 * `render` only runs on the `wired` branch, so a page can never accidentally
 * format an absent value into a plausible-looking figure. On `unavailable` the
 * row shows an em dash plus the motive — the value slot stays visibly empty.
 */
export function Series1WiredRow<T>({
  label,
  read,
  render,
  hint,
}: {
  label: string;
  read: Series1Wired<T>;
  render: (data: T) => ReactNode;
  hint?: ReactNode;
}) {
  const ok = read.status === "wired";
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <span className="text-sm" style={{ color: "var(--s1-muted)" }}>
        {label}
      </span>
      <span className="min-w-0 text-right">
        <span
          className={cn("block text-sm font-semibold tabular-nums")}
          style={{ color: ok ? "var(--s1-text)" : "var(--s1-muted)" }}
        >
          {ok ? render(read.data) : "—"}
        </span>
        <span className="mt-0.5 block text-[10px] font-normal" style={{ color: "var(--s1-muted)" }}>
          {ok ? hint : reasonLabel(read.reason)}
        </span>
      </span>
    </div>
  );
}

/**
 * Discreet block-level notice for a whole panel whose source did not resolve.
 * Deliberately a quiet line, not a dominant error card: an unconfigured
 * contract is the expected state today, not an incident.
 */
export function Series1Unavailable({
  reason,
  detail,
}: {
  reason: string;
  detail?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-8 text-center">
      <p className="text-sm font-medium" style={{ color: "var(--s1-muted)" }}>
        {reasonLabel(reason)}
      </p>
      {detail ? (
        <p className="max-w-sm text-xs leading-5" style={{ color: "var(--s1-muted)" }}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}
