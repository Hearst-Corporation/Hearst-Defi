import { Markdown } from "@/components/admin/markdown";

interface MemoSectionProps {
  title: string;
  body: string;
}

export function MemoSection({ title, body }: MemoSectionProps) {
  return (
    <section className="admin-doc-stack--actions border-b border-[var(--ct-border-soft)] pb-[var(--ct-space-8)] last:border-b-0 last:pb-0">
      <h2 className="h2">{title}</h2>
      <Markdown content={body} />
    </section>
  );
}
