/**
 * WiredChip — instrument de CHANTIER, pas un kind de provenance.
 *
 * Pourquoi un composant séparé de `ProvenanceBadge` : le vocabulaire de
 * provenance (live / oracle / attested / estimated / manual / stale …) est un
 * non-négociable produit. Y ajouter un kind « branché » changerait le langage
 * système et exigerait un ADR. Ce chip répond à une question DIFFÉRENTE et
 * temporaire — « cette valeur passe-t-elle par le nouveau contrat / les routes
 * v2 ? » — et disparaîtra avec le chantier. Il est donc réversible : supprimer
 * ce fichier n'entame pas le langage de provenance.
 *
 * Convention couleur : BLEU = la donnée vient du nouveau contrat / des routes v2.
 * Tokens uniquement (`--ct-status-info*`), zéro hex, zéro nouveau token.
 *
 * Honnêteté (non-négociable du repo) : une PANNE de lecture (`rpc_error`) ne doit
 * JAMAIS ressembler à une absence de donnée (`not_deployed`). Chaque motif porte
 * son propre libellé visible — la couleur n'est jamais le seul porteur de sens.
 *
 * Chrome délégué à la primitive canonique `catalyst/bento-badge` (ce dossier
 * `ui/` n'accueille que des wrappers qui délèguent à Catalyst, cf. son README).
 */
import { BentoBadge } from "@/components/catalyst/bento-badge";
import { Tooltip } from "@/components/catalyst/tooltip";
import { cn } from "@/lib/cn";

/** D'où la lecture provient réellement. */
export type WiredSource = "v2" | "legacy";

export type WiredChipState = "wired" | "pending" | "unavailable";

/**
 * Motifs connus d'indisponibilité. `reason` reste typé `string` côté props :
 * un motif inconnu doit dégrader honnêtement, jamais faire planter le rendu ni
 * se déguiser en « pas de données ».
 */
export const WIRED_UNAVAILABLE_LABELS = {
  not_deployed: "Contract not deployed",
  // Kept short so the chip never clips in a narrow row — the full sentence lives
  // in WIRED_UNAVAILABLE_DESCRIPTIONS (tooltip) and in the row's detail line.
  not_supported_by_legacy: "Not supported",
  rpc_error: "Read unavailable",
  revert: "Rejected by contract",
} as const;

export type WiredUnavailableReason = keyof typeof WIRED_UNAVAILABLE_LABELS;

const WIRED_UNAVAILABLE_DESCRIPTIONS: Record<WiredUnavailableReason, string> = {
  not_deployed:
    "No contract address for this network yet: the data does not exist.",
  not_supported_by_legacy:
    "The contract currently deployed does not expose this read.",
  rpc_error:
    "The RPC node did not respond: the data could not be read — this is not an absence of data.",
  revert: "The call was rejected (reverted) by the contract.",
};

/** Neutral fallback label — distinct from the known reasons, and never silent. */
const UNKNOWN_REASON_LABEL = "Unknown reason";
const UNKNOWN_REASON_DESCRIPTION =
  "The read is unavailable and the reason is not recognized.";
const NO_REASON_LABEL = "Data unavailable";
const NO_REASON_DESCRIPTION =
  "The read is unavailable and no reason was returned.";

function isKnownReason(reason: string): reason is WiredUnavailableReason {
  return Object.hasOwn(WIRED_UNAVAILABLE_LABELS, reason);
}

function resolveUnavailable(reason: string | undefined): {
  label: string;
  description: string;
} {
  if (reason === undefined || reason.length === 0) {
    return { label: NO_REASON_LABEL, description: NO_REASON_DESCRIPTION };
  }
  if (isKnownReason(reason)) {
    return {
      label: WIRED_UNAVAILABLE_LABELS[reason],
      description: WIRED_UNAVAILABLE_DESCRIPTIONS[reason],
    };
  }
  return {
    label: UNKNOWN_REASON_LABEL,
    description: `${UNKNOWN_REASON_DESCRIPTION} Raw reason: ${reason}`,
  };
}

export interface WiredChipProps {
  state: WiredChipState;
  /** Renseigné pour `wired` : d'où sort réellement la valeur. Défaut `v2`. */
  source?: WiredSource;
  /** Renseigné pour `unavailable` : voir `WIRED_UNAVAILABLE_LABELS`. */
  reason?: string;
  className?: string;
}

/**
 * Rendu :
 * - `wired`       → bleu plein, point plein, « Wired v2 » / « Wired (legacy) »
 * - `pending`     → bleu atténué, point creux, « Pending deployment »
 * - `unavailable` → NEUTRE (jamais bleu), pas de point, libellé dérivé du motif
 */
export function WiredChip({ state, source, reason, className }: WiredChipProps) {
  const resolved = resolveUnavailable(reason);

  const label =
    state === "wired"
      ? source === "legacy"
        ? "Wired (legacy)"
        : "Wired v2"
      : state === "pending"
        ? "Pending deployment"
        : resolved.label;

  const description =
    state === "wired"
      ? source === "legacy"
        ? "Value read from the currently deployed contract (not yet v2)."
        : "Value read via v2 routes, from the new contract."
      : state === "pending"
        ? "The target contract is not yet deployed: no real value to display."
        : resolved.description;

  const tone =
    state === "wired"
      ? "border-[var(--ct-status-info-border)] bg-[var(--ct-status-info-soft)] text-info"
      : state === "pending"
        ? cn(
            "border-[var(--ct-status-info-border)] bg-transparent text-info",
            "opacity-[var(--ct-opacity-60)]",
          )
        : "border-[var(--ct-border)] bg-transparent text-[var(--ct-text-faint)]";

  return (
    <Tooltip content={description}>
      <BentoBadge
        variant="default"
        role="status"
        aria-label={`Data source: ${label}`}
        title={description}
        className={cn("shrink-0 whitespace-nowrap", tone, className)}
      >
        {state !== "unavailable" ? (
          <span
            aria-hidden
            className={cn(
              "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
              state === "wired"
                ? "bg-current"
                : "border border-current bg-transparent",
            )}
          />
        ) : null}
        {/* Le libellé texte porte le sens : la couleur ne fait que l'appuyer. */}
        <span>{label}</span>
      </BentoBadge>
    </Tooltip>
  );
}
