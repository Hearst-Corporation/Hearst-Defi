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

import { cn } from "@/lib/cn";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminSectionCard } from "@/components/admin/admin-page-shell";
import { Button } from "@/ui/button";

/**
 * Boîte de page canon. Miroir STRICT du wrapper d'AdminPageShell
 * (admin-page-shell.tsx) — même surface, même frame, même rythme. Dupliqué ici
 * (2 classes) car le shell soude header+box alors que les vues composent le
 * header en enfant ; toute évolution du shell se répercute ICI.
 */
export function PageLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8",
        className,
      )}
    >
      <div className="admin-canon-page-frame min-w-0 p-5 lg:p-6 xl:px-12 min-[1700px]:px-20 flex flex-col gap-y-5">
        {children}
      </div>
    </div>
  );
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

export function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
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
