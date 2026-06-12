import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { safeUrl } from "@/lib/safe-url";

export function Markdown({
  content,
  demoteH1 = false,
}: {
  content: string;
  /** When the page already renders an H1 (e.g. spec viewer), demote MD `#` to h2. */
  demoteH1?: boolean;
}) {
  return (
    <div className="prose-spec">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrl}
        components={{
          h1: ({ children }) =>
            demoteH1 ? (
              <h2 className="mt-6 mb-3 h2 first:mt-0">{children}</h2>
            ) : (
              <h1 className="mt-8 mb-4 h1 first:mt-0">{children}</h1>
            ),
          h2: ({ children }) => (
            <h2 className="mt-6 mb-3 h2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-5 mb-2 h3">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-3 body-sm leading-[var(--ct-leading-relaxed)] ct-text-body">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-3 admin-doc-list admin-doc-list--disc body-sm ct-text-body">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 admin-doc-list admin-doc-list--decimal body-sm ct-text-body">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="body-sm">{children}</li>,
          code: ({ children, className }) => {
            if (className?.startsWith("language-")) {
              return (
                <code className="mono body-xs ct-text-strong">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded-sm ct-surface-1 px-1 py-0.5 mono body-xs ct-text-primary">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto rounded-md border border-[var(--ct-border)] ct-surface-1 p-4 body-xs">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full border-collapse body-xs">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-[var(--ct-border)] ct-table-header text-left ct-text-body uppercase tracking-[var(--ct-tracking-wide)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-[var(--ct-border)] ct-table-cell align-top ct-text-body">
              {children}
            </td>
          ),
          a: ({ children, href }) => {
            const safeHref = safeUrl(href);
            return (
              <a
                href={safeHref}
                className="ct-text-strong underline-offset-2 hover:underline"
                target={safeHref.startsWith("http") ? "_blank" : undefined}
                rel={safeHref.startsWith("http") ? "noreferrer" : undefined}
              >
                {children}
              </a>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-[var(--ct-text-strong)] pl-4 body-sm italic ct-text-body">
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="my-6 border-t border-[var(--ct-border)]" />
          ),
          strong: ({ children }) => (
            <strong className="font-medium ct-text-primary">
              {children}
            </strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
