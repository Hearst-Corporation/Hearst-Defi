import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { safeUrl } from "@/lib/safe-url";

/**
 * Markdown renderer — Portfolio bento prose canon.
 * Headings + body in zinc/white, accent-green (#A7FB90) links, inline/block
 * code on the `bg-[#15191C]` sub-surface, hairline table + rules. Pure render —
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
    <div className="prose-spec text-[14px] text-zinc-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrl}
        components={{
          h1: ({ children }) =>
            demoteH1 ? (
              <h2 className="mt-8 mb-3 text-[18px] font-semibold tracking-tight text-white first:mt-0">
                {children}
              </h2>
            ) : (
              <h1 className="mt-10 mb-4 text-[24px] font-semibold tracking-tight text-white first:mt-0">
                {children}
              </h1>
            ),
          h2: ({ children }) => (
            <h2 className="mt-8 mb-3 text-[18px] font-semibold tracking-tight text-white">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 mb-2 text-[15px] font-semibold tracking-tight text-zinc-100">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-3 text-[14px] leading-relaxed text-zinc-300">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="my-3 list-disc space-y-1.5 pl-5 text-[14px] text-zinc-300 marker:text-zinc-600">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 list-decimal space-y-1.5 pl-5 text-[14px] text-zinc-300 marker:text-zinc-600">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-[14px] leading-relaxed">{children}</li>,
          code: ({ children, className }) => {
            if (className?.startsWith("language-")) {
              return (
                <code className="font-mono text-[12px] text-zinc-200">
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded-sm bg-[#15191C] px-1 py-0.5 font-mono text-[12px] text-[#A7FB90]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto rounded-lg border border-white/10 bg-[#15191C] p-4 text-[12px]">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-white/10">
              <table className="w-full border-collapse text-[12px]">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-white/10 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-white/5 px-3 py-2 align-top text-zinc-300">
              {children}
            </td>
          ),
          a: ({ children, href }) => {
            const safeHref = safeUrl(href);
            return (
              <a
                href={safeHref}
                className="text-[#A7FB90] underline-offset-2 hover:underline"
                target={safeHref.startsWith("http") ? "_blank" : undefined}
                rel={safeHref.startsWith("http") ? "noreferrer" : undefined}
              >
                {children}
              </a>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-[#A7FB90]/40 pl-4 text-[14px] italic text-zinc-400">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-8 border-t border-white/10" />,
          strong: ({ children }) => (
            <strong className="font-semibold text-white">{children}</strong>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
