import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Markdown } from "@/components/admin/markdown";
import { requireAdmin } from "@/lib/auth/require-admin";
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
  await requireAdmin();
  const { slug } = await params;
  const [doc, index] = await Promise.all([getSpecDoc(slug), getSpecIndex()]);
  if (!doc) {
    notFound();
  }

  return (
    <div className="admin-doc-spec-layout">
      <aside className="md:sticky md:top-24 md:self-start">
        <nav className="admin-doc-stack admin-doc-stack--compact" aria-label="Spec documents">
          {index.map((entry) => {
            const active = entry.slug === slug;
            return (
              <Link
                key={entry.slug}
                href={`/admin/spec/${entry.slug}`}
                className={cn(
                  "block rounded-lg px-2 py-1.5 body-sm transition-colors",
                  active
                    ? "ct-surface-1 ct-text-primary"
                    : "ct-text-muted hover:ct-text-primary",
                )}
              >
                <span className="mono tabular mr-2 body-xs ct-text-faint">
                  {String(entry.order).padStart(2, "0")}
                </span>
                {entry.title}
              </Link>
            );
          })}
        </nav>
      </aside>

      <article className="min-w-0 flex flex-col gap-6">
        <AdminPageHeader
          title={doc.title}
          description="Reference specification for product, operations, or methodology review."
        />
        <Markdown content={doc.content} demoteH1 />
      </article>
    </div>
  );
}
