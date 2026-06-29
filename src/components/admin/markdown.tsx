import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { safeUrl } from "@/lib/safe-url";

/**
 * Markdown renderer — Portfolio bento prose canon.
 * Headings + body in zinc/white, accent-green (#A7FB90) links, inline/block
 * code on the `bg-surface-inset` sub-surface, hairline table + rules. Pure render —
 * the `content` / `demoteH1` API is unchanged.
 */
export function Markdown({
  content,
  demoteH1 = false,
}: {
  content: string;
  /** When the page already renders an H1 (e.g. spec viewer), demote MD `#` to h2. */
  demoteH1?: boolean;
}) {
  return (
    <div className="prose-spec text-[length:var(--ct-text-14)] text-[var(--ct-text-body)]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrl}
        components={{
          h1: ({ children }) =>
            demoteH1 ? (
              <h2 className="mt-8 mb-3 text-[length:var(--ct-text-xl-fixed)] font-semibold tracking-tight text-[var(--ct-text-strong)] first:mt-0">
                {children}
              </h2>
            ) : (
              <h1 className="mt-10 mb-4 text-[24px] font-semibold tracking-tight text-[var(--ct-text-strong)] first:mt-0">
                {children}
              </h1>
            ),
          h2: ({ children }) => (
            <h2 className="mt-8 mb-3 text-[length:var(--ct-text-xl-fixed)] font-semibold tracking-tight text-[var(--ct-text-strong)]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 mb-2 text-[length:var(--ct-text-sm)] font-semibold tracking-tight text-[var(--ct-text-strong)]">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-3 text-[length:var(--ct-text-14)] leading-relaxed text-[var(--ct-text-body)]">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-3 list-disc space-y-1.5 pl-5 text-[length:var(--ct-text-14)] text-[var(--ct-text-body)] marker:text-[var(--ct-text-faint)]">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 list-decimal space-y-1.5 pl-5 text-[length:var(--ct-text-14)] text-[var(--ct-text-body)] marker:text-[var(--ct-text-faint)]">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-[length:var(--ct-text-14)] leading-relaxed">{children}</li>,
          code: ({ children, className }) => {
            if (className?.startsWith("language-")) {
              return (
                <code className="font-mono text-[length:var(--ct-text-2xs)] text-[var(--ct-text-body)]">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded-sm bg-surface-inset px-1 py-0.5 font-mono text-[length:var(--ct-text-2xs)] text-[var(--ct-accent)]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto rounded-lg border border-[var(--ct-border)] bg-surface-inset p-4 text-[length:var(--ct-text-2xs)]">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-[var(--ct-border)]">
              <table className="w-full border-collapse text-[length:var(--ct-text-2xs)]">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-[var(--ct-border)] px-3 py-2 text-left text-[length:var(--ct-text-nano)] font-bold uppercase tracking-[0.15em] text-[var(--ct-text-faint)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-[var(--ct-border-soft)] px-3 py-2 align-top text-[var(--ct-text-body)]">
              {children}
            </td>
          ),
          a: ({ children, href }) => {
            const safeHref = safeUrl(href);
            return (
              <a
                href={safeHref}
                className="text-[var(--ct-accent)] underline-offset-2 hover:underline"
                target={safeHref.startsWith("http") ? "_blank" : undefined}
                rel={safeHref.startsWith("http") ? "noreferrer" : undefined}
              >
                {children}
              </a>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-[color-mix(in_srgb,var(--ct-accent)_40%,transparent)] pl-4 text-[length:var(--ct-text-14)] italic text-[var(--ct-text-muted)]">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-t border-[var(--ct-border)]" />,
          strong: ({ children }) => (
            <strong className="font-semibold text-[var(--ct-text-strong)]">{children}</strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
