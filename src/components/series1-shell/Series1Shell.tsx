"use client";

import * as Headless from "@headlessui/react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, Menu } from "lucide-react";

import { matchesNavPath } from "@/components/nav/product-nav-items";

import "./series1-tokens.css";
import { SERIES1_NAV, Series1Nav } from "./Series1Nav";

export function Series1Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeLabel = SERIES1_NAV.find((item) => matchesNavPath(pathname, item.href))?.label ?? "Overview";

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
    <div className="s1-scope min-h-dvh" style={{ overflowX: "clip" }}>
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r lg:block"
        style={{ background: "var(--s1-shell)", borderColor: "var(--s1-line)" }}
      >
        <Series1Nav pathname={pathname} />
      </aside>

      <header
        className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b px-4 backdrop-blur lg:hidden"
        style={{ borderColor: "var(--s1-line)", background: "color-mix(in srgb, var(--s1-shell) 92%, transparent)" }}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="flex size-11 items-center justify-center rounded-lg"
          style={{ color: "var(--s1-muted)" }}
        >
          <Menu className="size-5" />
        </button>
        <div className="min-w-0 text-center">
          <p className="text-xs font-semibold tracking-[0.14em] uppercase" style={{ color: "var(--s1-accent)" }}>
            Series 1
          </p>
          <p className="truncate text-sm font-semibold">{activeLabel}</p>
        </div>
        <span className="size-11" aria-hidden="true" />
      </header>

      {mobileOpen ? (
        <Headless.Dialog open={mobileOpen} onClose={setMobileOpen} className="lg:hidden">
          <Headless.DialogBackdrop className="fixed inset-0 z-40 bg-black/50" />
          <Headless.DialogPanel
            className="fixed inset-y-0 left-0 z-50 flex h-dvh max-h-dvh w-full max-w-80 flex-col overflow-hidden shadow-2xl"
            style={{ background: "var(--s1-shell)" }}
          >
            <div className="absolute top-3 right-3 z-10">
              <Headless.CloseButton
                className="flex size-11 items-center justify-center rounded-lg"
                style={{ color: "var(--s1-muted)" }}
              >
                <ChevronLeft className="size-5" />
              </Headless.CloseButton>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <Series1Nav pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </div>
          </Headless.DialogPanel>
        </Headless.Dialog>
      ) : null}

      <div className="min-w-0 lg:pl-64">
        <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-10">{children}</div>
      </div>
    </div>
  );
}
