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
    <div className="grid gap-8 md:grid-cols-[var(--ct-spec-nav-w)_1fr]">
      <aside className="md:sticky md:top-24 md:self-start">
        <p className="eyebrow mb-3">Spec — v1.0</p>
        <nav className="space-y-1">
          {index.map((entry) => {
            const active = entry.slug === slug;
            return (
              <Link
                key={entry.slug}
                href={`/admin/spec/${entry.slug}`}
                className={cn(
                  "block rounded-[var(--ct-radius-lg)] px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "glass-panel-subtle ct-text-primary"
                    : "ct-text-muted hover:glass-panel-subtle",
                )}
              >
                <span className="mono tabular mr-2 text-xs ct-text-faint">
                  {String(entry.order).padStart(2, "0")}
                </span>
                {entry.title}
              </Link>
            );
          })}
        </nav>
      </aside>

      <article className="min-w-0">
        <AdminPageHeader
          eyebrow={`/docs/spec/${slug}.mdx`}
          title={doc.title}
          className="mb-6"
        />
        <Markdown content={doc.content} />
      </article>
    </div>
  );
}
