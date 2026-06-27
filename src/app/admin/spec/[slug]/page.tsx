import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Markdown } from "@/components/admin/markdown";
import { BentoPanel, BentoHeader } from "@/components/ui/bento";
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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Spec"
          titleAccent={doc.title}
          contextLabel="Operations"
          description="Reference specification for product, operations, or methodology review."
        />

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(220px,260px)_1fr]">
          <BentoPanel className="lg:self-start">
            <BentoHeader title="Documents" />
            <nav
              className="flex flex-col p-2"
              aria-label="Spec documents"
            >
              {index.map((entry) => {
                const active = entry.slug === slug;
                return (
                  <Link
                    key={entry.slug}
                    href={`/admin/spec/${entry.slug}`}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors",
                      active
                        ? "bg-[#A7FB90]/10 text-[#A7FB90]"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <span
                      className={cn(
                        "font-mono text-[11px] tabular-nums",
                        active ? "text-[#A7FB90]" : "text-zinc-600",
                      )}
                    >
                      {String(entry.order).padStart(2, "0")}
                    </span>
                    {entry.title}
                  </Link>
                );
              })}
            </nav>
          </BentoPanel>

          <BentoPanel className="min-w-0">
            <div className="p-5 lg:p-6">
              <Markdown content={doc.content} demoteH1 />
            </div>
          </BentoPanel>
        </div>
      </div>
    </div>
  );
}
