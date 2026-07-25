// Canon bridge — doctrine « délégation, jamais swap » (règles projet hearst-connect).
//
// Ces primitives ne définissent AUCUN vocabulaire visuel propre : elles RENDENT
// le canon admin (AdminPageHeader / AdminSectionCard, tokens --ct-*). Les vues
// gardent leur API (PageLayout/PageHeader/Panel/…) ; le rendu est celui du canon.
// Le gardien admin-canon-start-pattern.test.ts verrouille cette délégation :
// PageLayout+PageHeader ne sont canon QUE parce que ce fichier délègue — ne
// réintroduis jamais ici de titre h1 maison, de classe du vocabulaire parallèle
// retiré le 2026-07-25, ni de token hors --ct-*.

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  AdminPageFrame,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
import { cn } from "@/lib/cn";
import type { Provenance } from "@/lib/provenance";
import { ProvenanceBadge } from "@/ui/badge";
import { Button } from "@/ui/button";

/**
 * Boîte de page canon — DÉLÈGUE à AdminPageFrame (admin-page-shell.tsx),
 * la primitive extraite en Mission Z1 (D7). Plus aucun miroir de classes ici :
 * le frame admin a UNE seule source de vérité, le shell et le bridge la rendent.
 */
export function PageLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <AdminPageFrame className={className}>{children}</AdminPageFrame>;
}

/** Header canon — délègue à AdminPageHeader (jamais de titre h1 maison ici). */
export function PageHeader({
  eyebrow,
  title,
  meta,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  meta?: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <AdminPageHeader
      title={title}
      eyebrow={eyebrow}
      contextLabel={meta}
      description={description}
      titleRowEnd={actions}
    />
  );
}

export function Section({
  index,
  title,
  description,
  children,
}: {
  index?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--ct-text-strong)]">
          {index ? (
            <span className="font-mono text-xs text-[var(--ct-text-faint)]">
              {index}
            </span>
          ) : null}
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-[var(--ct-text-muted)]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Carte canon — délègue à AdminSectionCard (la « welded section » du canon). */
export function Panel({
  title,
  description,
  children,
  footer,
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <AdminSectionCard title={title} subtitle={description}>
      {children}
      {footer ? (
        <div className="border-t border-[var(--ct-border)] px-5 py-4 text-xs text-[var(--ct-text-muted)]">
          {footer}
        </div>
      ) : null}
    </AdminSectionCard>
  );
}

export function RowList({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-[var(--ct-border)]">{children}</div>;
}

export type RowTone = "ok" | "watch" | "alert" | "idle";

// Pastille de tonalité — nuances grises + accent UNIQUEMENT, jamais de rouge :
// une Row en alerte s'exprime par un texte fort + préfixe (voir plus bas),
// pas par une couleur d'erreur (doctrine « zéro rouge »).
const ROW_TONE_DOT: Record<RowTone, string> = {
  ok: "bg-[var(--ct-accent)]",
  watch: "bg-[var(--ct-text-strong)]",
  alert: "bg-[var(--ct-text-strong)]",
  idle: "bg-[var(--ct-text-faint)]",
};

export function Row({
  label,
  value,
  hint,
  provenance,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** Badge de provenance (canon src/ui) rendu à côté de la valeur. */
  provenance?: Provenance;
  /** Nuance sémantique SANS rouge. Absent = rendu historique inchangé. */
  tone?: RowTone;
}) {
  // Défauts absents ⇒ markup historique STRICTEMENT identique (au pixel).
  if (provenance == null && tone == null) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
        <div className="min-w-0">
          <p className="text-sm text-[var(--ct-text-muted)]">{label}</p>
          {hint ? (
            <p className="mt-0.5 text-xs text-[var(--ct-text-faint)]">{hint}</p>
          ) : null}
        </div>
        <p className="text-sm font-medium text-[var(--ct-text-strong)] tabular-nums">
          {value}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm text-[var(--ct-text-muted)]">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-xs text-[var(--ct-text-faint)]">{hint}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {tone ? (
          <span
            aria-hidden
            className={cn(
              "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
              ROW_TONE_DOT[tone],
            )}
          />
        ) : null}
        <p
          className={cn(
            "text-sm font-medium text-[var(--ct-text-strong)] tabular-nums",
            tone === "alert" && "font-semibold",
          )}
        >
          {tone === "alert" ? (
            <>
              <span aria-hidden className="mr-1.5">
                !
              </span>
              <span className="sr-only">Alert: </span>
            </>
          ) : null}
          {value}
        </p>
        {provenance ? <ProvenanceBadge source={provenance} /> : null}
      </div>
    </div>
  );
}

export function PageActions({
  primary,
  secondary,
}: {
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <>
      {secondary ? (
        <Link href={secondary.href}>
          <Button variant="secondary">{secondary.label}</Button>
        </Link>
      ) : null}
      <Link href={primary.href}>
        <Button>{primary.label}</Button>
      </Link>
    </>
  );
}

export function Disclaimer({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs leading-relaxed text-[var(--ct-text-faint)]">
      {children}
    </p>
  );
}
