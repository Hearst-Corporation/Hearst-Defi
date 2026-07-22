"use client";

import * as Headless from "@headlessui/react";
import {
  Bitcoin,
  ChevronLeft,
  FileText,
  LayoutDashboard,
  Menu,
  Pickaxe,
  ShieldCheck,
  Vault,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

const PREVIEW_NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, href: "#overview" },
  { id: "reserve", label: "Reserve construction", icon: Bitcoin, href: "#reserve" },
  { id: "maturity", label: "Maturity & delivery", icon: Vault, href: "#maturity" },
  { id: "proof", label: "Proof center", icon: ShieldCheck, href: "#proof" },
  { id: "mining", label: "B1 mining power", icon: Pickaxe, href: "#reserve" },
  { id: "receipt", label: "Smart contract receipt", icon: FileText, href: "#receipt" },
] as const;

function PreviewSidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex h-full min-h-0 flex-col" aria-label="Preview navigation">
      <div className="border-b border-(--shell-line) p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-(--shell-accent) text-sm font-bold text-(--shell-accent-ink)">
            H
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-(--shell-text)">Hearst</span>
            <span className="block truncate text-xs text-(--shell-muted)">
              Bitcoin Reserve Vault · Series 1
            </span>
          </span>
        </div>
        <p className="mt-3 inline-flex rounded-md bg-(--shell-warning-soft) px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-(--shell-warning)">
          Shell preview
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        <div className="flex flex-col gap-0.5">
          {PREVIEW_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href={item.href}
                onClick={onNavigate}
                className="relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-(--shell-muted) transition-colors hover:bg-(--shell-panel) hover:text-(--shell-text)"
              >
                <Icon className="size-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function PreviewRail({ onClose }: { onClose: () => void }) {
  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-(--shell-line) bg-(--shell-frame) shadow-2xl">
      <div className="flex items-center justify-between border-b border-(--shell-line) px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-(--shell-text)">Operator rail</p>
          <p className="text-xs text-(--shell-muted)">Preview — static guidance</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close rail"
          className="flex size-10 items-center justify-center rounded-lg text-(--shell-muted) hover:bg-(--shell-panel)"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-(--shell-muted)">
        Open on desktop to view the right rail inline.
      </div>
    </aside>
  );
}

export function KycPreviewShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [mobileOpen]);

  return (
    <div className="shell-root min-h-dvh text-(--shell-text)">
      {/* Preview-owned token layer — deliberately independent from the legacy
          cockpit DS (--ct-*). This shell defines its own palette so it can be
          iterated on without touching the product design system. Starting
          green matches the current brand accent (#A7FB90) but is a local
          value, not an import. */}
      <style jsx global>{`
        .shell-root {
          --shell-accent: #a7fb90;
          --shell-accent-ink: #0a1f06;
          --shell-accent-soft: color-mix(in srgb, var(--shell-accent) 15%, transparent);
          --shell-accent-line: color-mix(in srgb, var(--shell-accent) 45%, transparent);
          --shell-warning: #8a5a00;
          --shell-warning-soft: color-mix(in srgb, #f5b93d 20%, transparent);
          --shell-bg: color-mix(in srgb, #0e1410 34%, white);
          --shell-frame: color-mix(in srgb, #0e1410 15%, white);
          --shell-panel: color-mix(in srgb, #0e1410 18%, white);
          --shell-inset: color-mix(in srgb, #0e1410 13%, white);
          --shell-line: color-mix(in srgb, #0e1410 34%, white 12%);
          --shell-text: #0a1210;
          --shell-muted: color-mix(in srgb, #0a1210 45%, white 30%);

          background:
            radial-gradient(circle at 90% -12%, color-mix(in srgb, var(--shell-accent) 16%, transparent), transparent 34rem),
            radial-gradient(circle at 8% -18%, color-mix(in srgb, var(--shell-accent) 7%, transparent), transparent 28rem),
            var(--shell-bg);
          overflow-x: clip;
        }
        .shell-root .shell-sidebar {
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--shell-accent) 7%, transparent), transparent 9rem),
            color-mix(in srgb, #0e1410 24%, white);
          border-color: var(--shell-line);
          box-shadow:
            inset -1px 0 0 color-mix(in srgb, white 28%, transparent),
            14px 0 32px -28px color-mix(in srgb, #0e1410 56%, transparent);
        }
        .shell-root .shell-frame {
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--shell-accent) 8%, transparent), transparent 28rem),
            var(--shell-frame);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, white 58%, transparent),
            inset 0 -1px 0 color-mix(in srgb, black 8%, transparent),
            0 20px 42px -30px color-mix(in srgb, #0e1410 46%, transparent);
          border-color: var(--shell-line);
        }
        .shell-root .shell-section {
          border-color: var(--shell-line);
        }
        .shell-root .shell-panel,
        .shell-root .shell-chart,
        .shell-root .shell-kpi {
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--shell-accent) 7%, transparent), transparent 17rem),
            var(--shell-panel);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, white 44%, transparent),
            inset 0 -1px 0 color-mix(in srgb, black 7%, transparent),
            0 14px 30px -24px color-mix(in srgb, #0e1410 42%, transparent);
          border: 1px solid var(--shell-line);
        }
        .shell-root .shell-chart figcaption,
        .shell-root .shell-panel > div:first-child {
          border-color: color-mix(in srgb, var(--shell-line) 84%, #0e1410);
        }
        .shell-root .shell-empty {
          background: var(--shell-inset);
          border-color: color-mix(in srgb, var(--shell-line) 72%, #0e1410);
        }
        .shell-root .shell-kpi > div,
        .shell-root .shell-kpi dl {
          background: color-mix(in srgb, var(--shell-line) 58%, transparent);
        }
        .shell-root .shell-kpi > div > div,
        .shell-root .shell-kpi dl > div {
          background: color-mix(in srgb, #0e1410 16%, white);
        }
        .shell-root .shell-kpi > div > div:first-child {
          background:
            linear-gradient(140deg, color-mix(in srgb, var(--shell-accent) 17%, transparent), transparent 18rem),
            color-mix(in srgb, #0e1410 13%, white);
        }

        /* Catalyst's shared Kyc* primitives (KycPanel, KycSection, KycChartSurface,
           KycHeroKpiBand, KycEmptyChart) emit fixed "kyc-cockpit-*" class names —
           the component file itself carries no color. Styling those selectors here,
           scoped under .shell-root, means the shared layout primitives render with
           this shell's local tokens instead of depending on KycAppShell's global
           --ct-* stylesheet (which this preview never imports). */
        .shell-root .kyc-cockpit-section {
          border-color: var(--shell-line);
        }
        .shell-root .kyc-cockpit-panel,
        .shell-root .kyc-cockpit-chart,
        .shell-root .kyc-cockpit-kpi {
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--shell-accent) 7%, transparent), transparent 17rem),
            var(--shell-panel);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, white 44%, transparent),
            inset 0 -1px 0 color-mix(in srgb, black 7%, transparent),
            0 14px 30px -24px color-mix(in srgb, #0e1410 42%, transparent);
          border: 1px solid var(--shell-line);
          color: var(--shell-text);
        }
        .shell-root .kyc-cockpit-chart figcaption,
        .shell-root .kyc-cockpit-panel > div:first-child {
          border-color: color-mix(in srgb, var(--shell-line) 84%, #0e1410);
        }
        .shell-root .kyc-cockpit-empty {
          background: var(--shell-inset);
          border-color: color-mix(in srgb, var(--shell-line) 72%, #0e1410);
          color: var(--shell-muted);
        }
        .shell-root .kyc-cockpit-kpi > div,
        .shell-root .kyc-cockpit-kpi dl {
          background: color-mix(in srgb, var(--shell-line) 58%, transparent);
        }
        .shell-root .kyc-cockpit-kpi > div > div,
        .shell-root .kyc-cockpit-kpi dl > div {
          background: color-mix(in srgb, #0e1410 16%, white);
        }
        .shell-root .kyc-cockpit-kpi > div > div:first-child {
          background:
            linear-gradient(140deg, color-mix(in srgb, var(--shell-accent) 17%, transparent), transparent 18rem),
            color-mix(in srgb, #0e1410 13%, white);
        }
        .shell-root .kyc-cockpit-page-title {
          color: var(--shell-text);
        }
      `}</style>

      <aside className="shell-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 border-r lg:block">
        <PreviewSidebar />
      </aside>

      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-(--shell-line) bg-[color-mix(in_srgb,var(--shell-frame)_94%,transparent)] px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="flex size-11 items-center justify-center rounded-lg text-(--shell-muted) hover:bg-(--shell-panel)"
        >
          <Menu className="size-5" />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-xs font-semibold uppercase tracking-uppercase text-(--shell-accent-ink)">
            Series 1 preview
          </p>
          <p className="truncate text-sm font-semibold">Reserve cockpit</p>
        </div>
        <button
          type="button"
          onClick={() => setRailOpen(true)}
          aria-label="Open operator rail"
          className="flex size-11 items-center justify-center rounded-lg text-(--shell-muted) hover:bg-(--shell-panel)"
        >
          <ShieldCheck className="size-5" />
        </button>
      </header>

      {mobileOpen ? (
        <Headless.Dialog open={mobileOpen} onClose={setMobileOpen} className="lg:hidden">
          <Headless.DialogBackdrop className="fixed inset-0 z-40 bg-black/35" />
          <Headless.DialogPanel className="fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh w-full max-w-80 flex-col overflow-hidden bg-[var(--shell-frame)] shadow-2xl">
            <div className="absolute right-3 top-3 z-10">
              <Headless.CloseButton className="flex size-11 items-center justify-center rounded-lg text-(--shell-muted) hover:bg-(--shell-panel)">
                <ChevronLeft className="size-5" />
              </Headless.CloseButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <PreviewSidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </Headless.DialogPanel>
        </Headless.Dialog>
      ) : null}

      <div className="min-w-0 lg:pl-64">
        <div className="p-4 sm:p-6 lg:p-2">
          <div className="shell-frame mx-auto max-w-[1600px] rounded-xl border p-5 sm:p-7 lg:p-10">
            {children}
          </div>
        </div>
      </div>

      {railOpen ? <PreviewRail onClose={() => setRailOpen(false)} /> : null}
    </div>
  );
}

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "accent" | "amber" | "zinc";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        tone === "accent" && "bg-(--shell-accent-soft) text-(--shell-accent-ink)",
        tone === "amber" && "bg-(--shell-warning-soft) text-(--shell-warning)",
        tone === "zinc" && "bg-(--shell-line) text-(--shell-muted)",
      )}
    >
      {label}
    </span>
  );
}

export function PanelRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-(--shell-text)">{label}</p>
        {hint ? <p className="mt-0.5 text-xs leading-5 text-(--shell-muted)">{hint}</p> : null}
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-(--shell-text)">{value}</p>
    </div>
  );
}

export function PanelHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--shell-line) px-5 py-4">
      <h3 className="text-sm font-semibold text-(--shell-text)">{title}</h3>
      {meta ? <span className="text-xs text-(--shell-muted)">{meta}</span> : null}
    </div>
  );
}
