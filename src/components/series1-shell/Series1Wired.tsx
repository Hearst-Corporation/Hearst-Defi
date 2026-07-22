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
      /**
       * Which deployment answered. A plain `string`, not `"v2" | "legacy"`:
       * the reads now come from hearst-connect-backend, whose mode vocabulary
       * is its own ("v2-fork", "v2-mainnet", "v2-testnet", …). The adapter's
       * two values remain assignable, so both read paths satisfy this during
       * the cutover.
       */
      source: string;
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
  // Absences reported BY hearst-connect-backend (see
  // src/lib/backend/resolved-view.ts `BACKEND_REASONS`). Namespaced motives so
  // an operator can tell a backend-side absence from the local adapter's — but
  // the investor-facing wording says the same plain thing, because the
  // distinction is ours, not theirs.
  "backend:not_configured": "Not configured yet",
  "backend:not_supported": "Not exposed by contract",
  "backend:permission_denied": "Not available for your account",
  "backend:unavailable": "Read unavailable",
  "backend:missing_value": "Read unavailable",
  // A backend outage — the request never came back. Deliberately distinct
  // wording from every motive above: those mean "the value is honestly absent",
  // this one means "we could not reach the data at all".
  "backend:unreachable": "Couldn’t reach the data",
};

/**
 * Investor-facing label for a motive.
 *
 * Backend motives arrive namespaced and may carry the backend's own machine
 * reason appended (`backend:not_configured:dynavault_not_deployed`) so the
 * detail survives into logs. The UI shows only the mapped prefix — the raw
 * machine reason is operator vocabulary and must not leak onto the surface.
 * An unknown motive still degrades to its raw string rather than to silence.
 */
export function reasonLabel(reason: string): string {
  const exact = REASON_LABELS[reason];
  if (exact) return exact;

  if (reason.startsWith("backend:")) {
    const prefixed = REASON_LABELS[reason.split(":").slice(0, 2).join(":")];
    if (prefixed) return prefixed;
  }

  return reason;
}

/**
 * Which deployment answered, in one short term.
 *
 * A previous version read `source === "v2" ? "PermissionedDynaVault v2.1" :
 * "Legacy vault"`, which mislabels every value it does not recognise as
 * legacy. With the backend's wider mode vocabulary that would print "Legacy
 * vault" over reads of the v2.1 contract on a preprod fork — a false statement
 * about which contract produced the number. Unknown sources now surface
 * verbatim instead of being coerced into one of two guesses.
 *
 * "fork" is named on the surface on purpose: those figures are real reads of a
 * real contract, but the chain is ephemeral and must not read as a record.
 */
export function sourceLabel(source: string): string {
  switch (source) {
    case "v2":
    case "v2-mainnet":
      return "PermissionedDynaVault v2.1";
    case "v2-testnet":
      return "PermissionedDynaVault v2.1 · testnet";
    case "v2-fork":
      return "PermissionedDynaVault v2.1 · preprod fork";
    case "legacy":
      return "Legacy vault";
    default:
      return source;
  }
}

/** Short provenance line: which contract answered, and when. */
export function Series1Provenance({ read }: { read: Series1Wired<unknown> }) {
  if (read.status === "unavailable") {
    return (
      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
        {reasonLabel(read.reason)}
      </span>
    );
  }
  return (
    <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
      {sourceLabel(read.source)} · read {new Date(read.readAt).toISOString().slice(11, 16)} UTC
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
      <span className="text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="min-w-0 text-right">
        <span
          className={cn(
            "block text-sm font-semibold tabular-nums",
            ok ? "text-zinc-950 dark:text-white" : "text-zinc-500 dark:text-zinc-400",
          )}
        >
          {ok ? render(read.data) : "—"}
        </span>
        <span className="mt-0.5 block text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
          {ok ? hint : reasonLabel(read.reason)}
        </span>
      </span>
    </div>
  );
}

// Series1Unavailable (block-level notice dumping the adapter's raw `detail`)
// was removed: the panels that used it now render the policy ring plus one
// investor-worded motive line — the adapter's ops vocabulary (env vars, deploy
// steps) stays off investor surfaces.
