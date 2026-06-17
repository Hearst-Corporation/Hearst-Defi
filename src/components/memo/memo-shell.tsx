"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";

import { generateMemoAction } from "@/app/admin/investor-memo/actions";
import { generateMemoPdfAction } from "@/app/admin/investor-memo/pdf-action";
import { MemoSection } from "@/components/memo/memo-section";
import { MemoToolbar } from "@/components/memo/memo-toolbar";
import { Card } from "@/components/ui/card";
import type { InvestorMemoOutput } from "@/lib/agents/schemas";

interface SectionMeta {
  key: keyof InvestorMemoOutput;
  title: string;
}

const SECTIONS: ReadonlyArray<SectionMeta> = [
  { key: "executive_summary", title: "1 · Executive summary" },
  { key: "vault_structure", title: "2 · Vault structure" },
  { key: "scenario_analysis", title: "3 · Scenario analysis" },
  { key: "risk_section", title: "4 · Risk section" },
  { key: "mining_section", title: "5 · Mining section" },
  { key: "performance_section", title: "6 · Performance section" },
  { key: "methodology_note", title: "7 · Methodology note" },
  { key: "disclaimer", title: "8 · Disclaimer" },
];

function buildMarkdown(memo: InvestorMemoOutput, vaultName: string): string {
  const generatedHeader = [
    `# ${vaultName} — Investor Memo`,
    "",
    `_Generated ${new Date().toISOString()}_`,
    "_Methodology v1.0_",
    "",
  ].join("\n");
  const body = SECTIONS.map(
    ({ key, title }) => `## ${title}\n\n${memo[key]}`,
  ).join("\n\n");
  return `${generatedHeader}\n${body}\n`;
}

function downloadMarkdown(memo: InvestorMemoOutput, vaultName: string): void {
  const md = buildMarkdown(memo, vaultName);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = vaultName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  a.href = url;
  a.download = `${slug || "hearst-vault"}-memo_${stamp}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function SkeletonSection() {
  return (
    <Card hoverOverlay={false}>
      <div className="mb-[var(--ct-space-4)] h-5 w-1/3 animate-pulse rounded ct-surface-1" />
      <div className="admin-doc-stack--tight">
        <div className="h-3 w-full animate-pulse rounded ct-surface-1" />
        <div className="h-3 w-11/12 animate-pulse rounded ct-surface-1" />
        <div className="h-3 w-4/5 animate-pulse rounded ct-surface-1" />
      </div>
    </Card>
  );
}

function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
  // Copy into a fresh ArrayBuffer so the Blob constructor sees a clean buffer
  // (Uint8Arrays returned across the server-action boundary can carry the
  // underlying transfer buffer; making a copy keeps types narrow).
  const copy = new Uint8Array(bytes);
  const blob = new Blob([copy.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface MemoShellProps {
  /**
   * Vault id this memo is being generated for. Threaded into every server
   * action call so the loader binds to the right vault. ADR-006 #9: a memo
   * is bound to exactly one vault — switching vaults is a fresh navigation.
   */
  vaultId?: string;
  /** Human label of the active vault (used for filename + Markdown header). */
  vaultName?: string;
}

export function MemoShell({
  vaultId,
  vaultName = "Hearst Yield Vault",
}: MemoShellProps) {
  const [memo, setMemo] = useState<InvestorMemoOutput | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isPdfPending, startPdfTransition] = useTransition();

  const handleGenerate = useCallback(() => {
    // Guard against accidental destruction of a reviewed memo. There is no
    // server-side draft persistence yet; once regenerated the previous copy
    // is gone from this session unless it was downloaded.
    if (memo !== null) {
      const confirmed = window.confirm(
        "This will replace the current memo. Continue?",
      );
      if (!confirmed) return;
    }
    setError(null);
    const toastId = toast.loading(
      `Generating ${vaultName} memo with GPT-4.1...`,
    );
    startTransition(async () => {
      try {
        const result = await generateMemoAction(vaultId);
        setMemo(result);
        setLastGeneratedAt(new Date().toISOString());
        toast.success(`${vaultName} memo generated successfully`, {
          id: toastId,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        toast.error(`Generation failed: ${message}`, { id: toastId });
      }
    });
  }, [memo, vaultId, vaultName]);

  const handleDownload = useCallback(() => {
    if (!memo) return;
    downloadMarkdown(memo, vaultName);
    toast.success("Markdown memo downloaded");
  }, [memo, vaultName]);

  const handleDownloadPdf = useCallback(() => {
    setError(null);
    const toastId = toast.loading("Generating PDF...");
    startPdfTransition(async () => {
      try {
        const { bytes, filename } = await generateMemoPdfAction(memo, vaultId);
        downloadPdfBytes(bytes, filename);
        toast.success("PDF downloaded", { id: toastId });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        toast.error(`PDF generation failed: ${message}`, { id: toastId });
      }
    });
  }, [memo, vaultId]);

  return (
    <div className="admin-doc-stack">
      <MemoToolbar
        hasMemo={memo !== null}
        isPending={isPending}
        isPdfPending={isPdfPending}
        lastGeneratedAt={lastGeneratedAt}
        onGenerate={handleGenerate}
        onDownload={handleDownload}
        onDownloadPdf={handleDownloadPdf}
      />

      {error ? (
        <div className="rounded-md border border-[var(--ct-status-danger)] bg-transparent px-[var(--ct-space-4)] py-[var(--ct-space-3)]">
          <p className="stat-label ct-status-danger">Generation failed</p>
          <p className="mt-1 mono body-xs ct-status-danger break-words">
            {error}
          </p>
        </div>
      ) : null}

      {isPending && memo === null ? (
        <div className="admin-doc-stack--relaxed">
          {SECTIONS.map((s) => (
            <SkeletonSection key={s.key} />
          ))}
        </div>
      ) : memo ? (
        <div className="admin-doc-stack--relaxed">
          {SECTIONS.map(({ key, title }) => (
            <MemoSection key={key} title={title} body={memo[key]} />
          ))}
        </div>
      ) : (
        <div className="ct-empty-surface min-h-48">
          <p className="body-sm max-w-md ct-text-muted">
            Press{" "}
            <span className="ct-text-primary">Generate memo</span> to produce
            the 8-section institutional memo via GPT-4.1 (OpenAI). Generation
            takes a few seconds; nothing is auto-distributed.
          </p>
        </div>
      )}
    </div>
  );
}
