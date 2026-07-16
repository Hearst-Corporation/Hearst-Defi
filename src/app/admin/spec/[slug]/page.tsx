import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageShell, AdminSectionCard } from "@/components/admin/admin-page-shell";
import { Markdown } from "@/components/admin/markdown";
import { cn } from "@/lib/cn";
import { getSpecDoc, getSpecIndex } from "@/lib/spec";

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  const entries = await getSpecIndex();
  return entries.map((entry) => ({ slug: entry.slug }));
}

export default async function SpecPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [doc, index] = await Promise.all([getSpecDoc(slug), getSpecIndex()]);
  if (!doc) {
    notFound();
  }

  return (
    <AdminPageShell
      titleLead="Spec"
      titleAccent={doc.title}
      contextLabel="Operations"
    >
      {/* ANTI-TROU : la nav (liste courte) et le contenu (markdown long) sont
          des volumes très inégaux. Tracks asymétriques minmax + items-start →
          la nav se cale en haut (self-start) sans creuser un trou sous elle. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)]">
        <AdminSectionCard
          title="Documents"
          subtitle="Browse the specification library; the active document is highlighted."
          ariaLabel="Spec documents"
          className="lg:self-start"
        >
          <nav className="flex min-w-0 flex-col p-2" aria-label="Spec documents">
            {index.map((entry) => {
              const active = entry.slug === slug;
              return (
                <Link
                  key={entry.slug}
                  href={`/admin/spec/${entry.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "ct-metric-value flex min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 font-normal transition-colors",
                    active
                      ? "bg-[color-mix(in_srgb,var(--ct-accent)_10%,transparent)] text-[var(--ct-accent)]"
                      : "text-[var(--ct-text-muted)] hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] hover:text-[var(--ct-text-strong)]",
                  )}
                >
                  <span
                    className={cn(
                      "ct-metric-caption mono tabular-nums",
                      active
                        ? "text-[var(--ct-accent)]"
                        : "text-[var(--ct-text-muted)]",
                    )}
                  >
                    {String(entry.order).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 truncate">{entry.title}</span>
                </Link>
              );
            })}
          </nav>
        </AdminSectionCard>

        <AdminSectionCard
          title={doc.title}
          subtitle="Reference specification for product, operations, or methodology review."
          ariaLabel={doc.title}
          className="min-w-0"
        >
          <div className="min-w-0 p-5 lg:p-6">
            <Markdown content={doc.content} demoteH1 />
          </div>
        </AdminSectionCard>
      </div>
    </AdminPageShell>
  );
}
