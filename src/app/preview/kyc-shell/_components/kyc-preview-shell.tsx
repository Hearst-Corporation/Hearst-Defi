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
      <div className="border-b border-zinc-950/8 p-5 dark:border-white/8">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-400 text-sm font-bold text-zinc-950">
            H
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-zinc-950 dark:text-white">Hearst</span>
            <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
              Bitcoin Reserve Vault · Series 1
            </span>
          </span>
        </div>
        <p className="mt-3 inline-flex rounded-md bg-amber-400/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
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
                className="relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-950/4 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
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
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-zinc-950/10 bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-950/8 px-5 py-4 dark:border-white/8">
        <div>
          <p className="text-sm font-semibold text-zinc-950 dark:text-white">Operator rail</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Preview — static guidance</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close rail"
          className="flex size-10 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-950/5 dark:hover:bg-white/5"
        >
          <X className="size-5" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-zinc-500">
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
    <div className="kyc-app-root kyc-cockpit-shell min-h-dvh text-zinc-950">
      <style jsx global>{`
        .kyc-cockpit-shell {
          --kyc-cockpit-canvas: color-mix(in srgb, var(--ct-bg-deep) 34%, white);
          --kyc-cockpit-frame: color-mix(in srgb, var(--ct-bg-deep) 15%, white);
          --kyc-cockpit-panel: color-mix(in srgb, var(--ct-bg-deep) 18%, white);
          --kyc-cockpit-inset: color-mix(in srgb, var(--ct-bg-deep) 13%, white);
          --kyc-cockpit-line: color-mix(in srgb, var(--ct-bg-deep) 34%, white 12%);
          --kyc-cockpit-accent: color-mix(in srgb, var(--ct-accent) 62%, var(--ct-bg-deep));
          background:
            radial-gradient(circle at 90% -12%, color-mix(in srgb, var(--ct-accent) 16%, transparent), transparent 34rem),
            radial-gradient(circle at 8% -18%, color-mix(in srgb, var(--ct-accent) 7%, transparent), transparent 28rem),
            var(--kyc-cockpit-canvas);
          overflow-x: clip;
        }
        .kyc-cockpit-shell .kyc-cockpit-sidebar {
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--ct-accent) 7%, transparent), transparent 9rem),
            color-mix(in srgb, var(--ct-bg-deep) 24%, white);
          border-color: var(--kyc-cockpit-line);
          box-shadow:
            inset -1px 0 0 color-mix(in srgb, white 28%, transparent),
            14px 0 32px -28px color-mix(in srgb, var(--ct-bg-deep) 56%, transparent);
        }
        .kyc-cockpit-shell .kyc-cockpit-frame {
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--ct-accent) 8%, transparent), transparent 28rem),
            var(--kyc-cockpit-frame);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, white 58%, transparent),
            inset 0 -1px 0 color-mix(in srgb, black 8%, transparent),
            0 20px 42px -30px color-mix(in srgb, var(--ct-bg-deep) 46%, transparent);
          border-color: var(--kyc-cockpit-line);
        }
        .kyc-cockpit-shell .kyc-cockpit-section {
          border-color: var(--kyc-cockpit-line);
        }
        .kyc-cockpit-shell .kyc-cockpit-panel,
        .kyc-cockpit-shell .kyc-cockpit-chart,
        .kyc-cockpit-shell .kyc-cockpit-kpi {
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--ct-accent) 7%, transparent), transparent 17rem),
            var(--kyc-cockpit-panel);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, white 44%, transparent),
            inset 0 -1px 0 color-mix(in srgb, black 7%, transparent),
            0 14px 30px -24px color-mix(in srgb, var(--ct-bg-deep) 42%, transparent);
          border: 1px solid var(--kyc-cockpit-line);
        }
        .kyc-cockpit-shell .kyc-cockpit-chart figcaption,
        .kyc-cockpit-shell .kyc-cockpit-panel > div:first-child {
          border-color: color-mix(in srgb, var(--kyc-cockpit-line) 84%, var(--ct-bg-deep));
        }
        .kyc-cockpit-shell .kyc-cockpit-empty {
          background: var(--kyc-cockpit-inset);
          border-color: color-mix(in srgb, var(--kyc-cockpit-line) 72%, var(--ct-bg-deep));
        }
        .kyc-cockpit-shell .kyc-cockpit-kpi > div,
        .kyc-cockpit-shell .kyc-cockpit-kpi dl {
          background: color-mix(in srgb, var(--kyc-cockpit-line) 58%, transparent);
        }
        .kyc-cockpit-shell .kyc-cockpit-kpi > div > div,
        .kyc-cockpit-shell .kyc-cockpit-kpi dl > div {
          background: color-mix(in srgb, var(--ct-bg-deep) 16%, white);
        }
        .kyc-cockpit-shell .kyc-cockpit-kpi > div > div:first-child {
          background:
            linear-gradient(140deg, color-mix(in srgb, var(--ct-accent) 17%, transparent), transparent 18rem),
            color-mix(in srgb, var(--ct-bg-deep) 13%, white);
        }
      `}</style>

      <aside className="kyc-cockpit-sidebar fixed inset-y-0 left-0 z-30 hidden w-64 border-r lg:block">
        <PreviewSidebar />
      </aside>

      <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-(--kyc-cockpit-line) bg-[color-mix(in_srgb,var(--kyc-cockpit-frame)_94%,transparent)] px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="flex size-11 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-950/5 dark:text-zinc-300 dark:hover:bg-white/5"
        >
          <Menu className="size-5" />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-xs font-semibold uppercase tracking-uppercase text-emerald-600 dark:text-emerald-400">
            Series 1 preview
          </p>
          <p className="truncate text-sm font-semibold">Reserve cockpit</p>
        </div>
        <button
          type="button"
          onClick={() => setRailOpen(true)}
          aria-label="Open operator rail"
          className="flex size-11 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-950/5 dark:text-zinc-300 dark:hover:bg-white/5"
        >
          <ShieldCheck className="size-5" />
        </button>
      </header>

      {mobileOpen ? (
        <Headless.Dialog open={mobileOpen} onClose={setMobileOpen} className="lg:hidden">
          <Headless.DialogBackdrop className="fixed inset-0 z-40 bg-black/35" />
          <Headless.DialogPanel className="fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh w-full max-w-80 flex-col overflow-hidden bg-[var(--kyc-cockpit-frame)] shadow-2xl">
            <div className="absolute right-3 top-3 z-10">
              <Headless.CloseButton className="flex size-11 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-950/5 dark:hover:bg-white/5">
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
          <div className="kyc-cockpit-frame mx-auto max-w-[1600px] rounded-xl border p-5 sm:p-7 lg:p-10">
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
  tone: "emerald" | "amber" | "zinc";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        tone === "emerald" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        tone === "amber" && "bg-amber-400/15 text-amber-800 dark:text-amber-300",
        tone === "zinc" && "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300",
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
        <p className="text-sm font-medium text-zinc-950 dark:text-white">{label}</p>
        {hint ? <p className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-zinc-950 dark:text-white">{value}</p>
    </div>
  );
}

export function PanelHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
      <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{title}</h3>
      {meta ? <span className="text-xs text-zinc-500 dark:text-zinc-400">{meta}</span> : null}
    </div>
  );
}
