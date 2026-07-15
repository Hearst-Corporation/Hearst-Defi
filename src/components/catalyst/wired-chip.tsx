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
  not_deployed: "Contrat non déployé",
  // Kept short so the chip never clips in a narrow row — the full sentence lives
  // in WIRED_UNAVAILABLE_DESCRIPTIONS (tooltip) and in the row's detail line.
  not_supported_by_legacy: "Non supporté",
  rpc_error: "Lecture indisponible",
  revert: "Rejeté par le contrat",
} as const;

export type WiredUnavailableReason = keyof typeof WIRED_UNAVAILABLE_LABELS;

const WIRED_UNAVAILABLE_DESCRIPTIONS: Record<WiredUnavailableReason, string> = {
  not_deployed:
    "Aucune adresse de contrat pour ce réseau : la donnée n'existe pas encore.",
  not_supported_by_legacy:
    "Le contrat actuellement déployé n'expose pas cette lecture.",
  rpc_error:
    "Le nœud RPC n'a pas répondu : la donnée n'a pas pu être lue — ce n'est pas une absence de donnée.",
  revert: "L'appel a été rejeté (revert) par le contrat.",
};

/** Libellé neutre de repli — distinct des motifs connus, et jamais silencieux. */
const UNKNOWN_REASON_LABEL = "Motif inconnu";
const UNKNOWN_REASON_DESCRIPTION =
  "La lecture est indisponible et le motif n'est pas reconnu.";
const NO_REASON_LABEL = "Donnée indisponible";
const NO_REASON_DESCRIPTION =
  "La lecture est indisponible et aucun motif n'a été renvoyé.";

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
    description: `${UNKNOWN_REASON_DESCRIPTION} Motif brut : ${reason}`,
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
 * - `wired`       → bleu plein, point plein, « Branché v2 » / « Branché (legacy) »
 * - `pending`     → bleu atténué, point creux, « En attente de déploiement »
 * - `unavailable` → NEUTRE (jamais bleu), pas de point, libellé dérivé du motif
 */
export function WiredChip({ state, source, reason, className }: WiredChipProps) {
  const resolved = resolveUnavailable(reason);

  const label =
    state === "wired"
      ? source === "legacy"
        ? "Branché (legacy)"
        : "Branché v2"
      : state === "pending"
        ? "En attente de déploiement"
        : resolved.label;

  const description =
    state === "wired"
      ? source === "legacy"
        ? "Valeur lue sur le contrat actuellement déployé (pas encore la v2)."
        : "Valeur lue via les routes v2, sur le nouveau contrat."
      : state === "pending"
        ? "Le contrat cible n'est pas encore déployé : aucune valeur réelle à afficher."
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
        aria-label={`Source de données : ${label}`}
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
