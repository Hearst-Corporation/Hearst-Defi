import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
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
    <>
      <div className="admin-doc-spec-layout">
        <aside className="admin-doc-spec-aside">
          <nav className="admin-doc-stack admin-doc-stack--compact" aria-label="Spec documents">
            {index.map((entry) => {
              const active = entry.slug === slug;
              return (
                <Link
                  key={entry.slug}
                  href={`/admin/spec/${entry.slug}`}
                  className={cn("admin-doc-spec-link body-sm", active && "is-active")}
                >
                  <span className="admin-doc-spec-link__order mono tabular body-xs">
                    {String(entry.order).padStart(2, "0")}
                  </span>
                  {entry.title}
                </Link>
              );
            })}
          </nav>
        </aside>

        <article className="admin-doc-article">
          <div className="admin-doc-prose-shell">
            <AdminPageHeader
              titleLead="Spec"
              titleAccent={doc.title}
              description="Reference specification for product, operations, or methodology review."
            />
          </div>
          <div className="admin-doc-prose-shell">
            <Markdown content={doc.content} demoteH1 />
          </div>
        </article>
      </div>
    </>
  );
}
