import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * StatusValue — un état métier affiché sans ambiguïté.
 *
 * LE PROBLÈME QU'IL RÉSOUT
 * Les vues rendaient des chaînes brutes venues du backend : « unavailable »,
 * « None », « Unavailable », « Live ». Trois conventions de casse, et surtout
 * une confusion de fond — « unavailable » ne dit pas si le service est en
 * panne, si le compte n'a pas de dossier, ou si la donnée n'a pas été chargée.
 * Une panne backend ne doit jamais se lire comme un état réel du compte.
 *
 * Chaque `kind` répond à une question différente :
 *   not-started  le parcours existe, l'utilisateur ne l'a pas commencé
 *   pending      soumis, en cours d'examen
 *   verified     abouti
 *   rejected     abouti négativement — un fait, pas une erreur système
 *   not-linked   aucune ressource rattachée (wallet, document)
 *   unavailable  LE SERVICE n'a pas répondu — `reason` est obligatoire
 *   unknown      la donnée n'a pas été chargée ; on ne prétend rien
 *
 * COULEUR : un seul vert, zéro rouge (doctrine produit). `verified` porte
 * l'accent-INK (lisible dans les deux thèmes, contrairement au vert de
 * remplissage). `rejected` est GRIS FORT et non rouge : un refus de dossier est
 * un état, pas une panne. Le rouge reste réservé aux erreurs bloquantes.
 * La couleur ne porte jamais l'information seule : le libellé suffit.
 */

export type StatusKind =
  | "not-started"
  | "pending"
  | "verified"
  | "rejected"
  | "not-linked"
  | "unavailable"
  | "unknown";

const LABEL: Record<StatusKind, string> = {
  "not-started": "Not started",
  pending: "In review",
  verified: "Verified",
  rejected: "Rejected",
  "not-linked": "Not linked",
  unavailable: "Service unavailable",
  unknown: "Unknown",
};

const TONE: Record<StatusKind, string> = {
  "not-started": "text-muted",
  pending: "text-foreground",
  verified: "text-accent-ink",
  rejected: "text-foreground",
  "not-linked": "text-muted",
  unavailable: "text-muted",
  unknown: "text-muted",
};

/** Pastille : redondante avec le libellé, jamais porteuse seule du sens. */
const DOT: Record<StatusKind, string> = {
  "not-started": "bg-faint",
  pending: "bg-warning",
  verified: "bg-accent-ink",
  rejected: "bg-subtle",
  "not-linked": "bg-faint",
  unavailable: "bg-warning",
  unknown: "bg-faint",
};

export interface StatusValueProps {
  kind: StatusKind;
  /**
   * OBLIGATOIRE quand `kind === "unavailable"` : dire POURQUOI le service n'a
   * pas répondu est ce qui distingue une panne d'un état de compte.
   */
  reason?: string;
  /** Remplace le libellé canon (rare — préférer un `kind` juste). */
  label?: ReactNode;
  className?: string;
}

export function StatusValue({
  kind,
  reason,
  label,
  className,
}: StatusValueProps) {
  const text = label ?? LABEL[kind];
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn("size-1.5 shrink-0 rounded-full", DOT[kind])}
      />
      <span className={cn("font-medium", TONE[kind])}>{text}</span>
      {kind === "unavailable" && reason ? (
        <span className="hc-caption">— {reason}</span>
      ) : null}
    </span>
  );
}
