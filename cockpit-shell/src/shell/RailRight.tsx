"use client";

import { useSyncExternalStore } from "react";
import {
  subscribe,
  getModeSnapshot,
  getModeServerSnapshot,
  toggle,
  toggleWidth,
} from "../stores/railOpenStore";
import {
  subscribe as subActive,
  getSnapshot as getActive,
  getServerSnapshot as getActiveSSR,
} from "../stores/activeProductStore";
import {
  subscribe as subView,
  getSnapshot as getView,
  getServerSnapshot as getViewSSR,
  setView,
} from "../stores/chatViewStore";
import {
  subscribe as subStreaming,
  getSnapshot as getStreaming,
  getServerSnapshot as getStreamingSSR,
} from "../stores/chatStreamingStore";
import { ChatKimi } from "../chat/ChatKimi";
import { ChatSettings } from "../chat/ChatSettings";
import { ChatHistory } from "../chat/ChatHistory";
import { useCockpit } from "./context";

const TITLES: Record<string, string> = {
  chat: "Assistant",
  settings: "Settings",
  history: "History",
};

// Bento toolbar button — shared treatment for history / settings / width / collapse.
const TOOLBAR_BTN =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 text-zinc-400 transition-colors duration-150 hover:text-white hover:border-white/20";
const TOOLBAR_BTN_ACTIVE = "text-[#A7FB90] border-[#A7FB90]/30";

function toolbarBtnClass(active: boolean): string {
  return active ? `${TOOLBAR_BTN} ${TOOLBAR_BTN_ACTIVE}` : TOOLBAR_BTN;
}

function WidthIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 13 13" fill="none" aria-hidden="true">
      <path
        d="M2 6.5H11M2 6.5L3.5 5M2 6.5L3.5 8M11 6.5L9.5 5M11 6.5L9.5 8"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={expanded ? 1 : 0.85}
      />
    </svg>
  );
}

export function RailRight() {
  const mode = useSyncExternalStore(subscribe, getModeSnapshot, getModeServerSnapshot);
  const open = mode !== "collapsed";
  const expanded = mode === "expanded";
  const active = useSyncExternalStore(subActive, getActive, getActiveSSR);
  const view = useSyncExternalStore(subView, getView, getViewSSR);
  const streaming = useSyncExternalStore(subStreaming, getStreaming, getStreamingSSR);
  const { getProduct } = useCockpit();
  const product = getProduct(active);

  // Structural hooks kept (ct-rail-right + state drive --ct-rail-right-eff /
  // width / collapse from the global cascade); bento Tailwind layered on top.
  const railClass = [
    "ct-rail-right",
    "flex flex-col bg-[#0B0E10] border-l border-white/10",
    mode === "collapsed" ? "collapsed" : "",
    mode === "expanded" ? "expanded" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={railClass}>
      <div className="ct-rail-right-header flex items-center gap-2 border-b border-white/10">
        {open && (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full${streaming ? " animate-pulse" : ""}`}
              style={{ background: product.color }}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2">
                <span className="truncate text-[15px] font-medium leading-none text-white">
                  {TITLES[view] ?? "Assistant"}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded border border-[#A7FB90]/20 bg-[#A7FB90]/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#A7FB90]">
                  <span className="h-1 w-1 rounded-full bg-[#A7FB90]" />
                  Ready
                </span>
              </span>
              <span className="truncate text-[10px] font-medium uppercase tracking-[0.15em] text-zinc-500">
                {product.name}
              </span>
            </span>
          </span>
        )}
        {open && (
          <>
            <button
              type="button"
              className={toolbarBtnClass(view === "history")}
              onClick={() => setView(view === "history" ? "chat" : "history")}
              aria-label={view === "history" ? "Back to chat" : "Chat history"}
              title={view === "history" ? "Back to chat" : "History"}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M6.5 3.5V6.5L8.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              className={toolbarBtnClass(view === "settings")}
              onClick={() => setView(view === "settings" ? "chat" : "settings")}
              aria-label={view === "settings" ? "Back to chat" : "Chat settings"}
              title={view === "settings" ? "Back to chat" : "Settings"}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="1.75" stroke="currentColor" strokeWidth="1.2" />
                <path d="M6.5 1v1.5M6.5 10.5V12M12 6.5h-1.5M2.5 6.5H1M10.3 2.7l-1.06 1.06M3.76 9.24l-1.06 1.06M10.3 10.3l-1.06-1.06M3.76 3.76 2.7 2.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              className={`${toolbarBtnClass(expanded)} ct-rail-right-btn--width`}
              onClick={toggleWidth}
              aria-label={expanded ? "Use default chat width" : "Expand chat panel"}
              aria-expanded={expanded}
              title={expanded ? "Default width (352px)" : "Expanded width (420px)"}
            >
              <WidthIcon expanded={expanded} />
            </button>
          </>
        )}
        <button
          type="button"
          className={`${TOOLBAR_BTN} text-[15px] leading-none`}
          onClick={toggle}
          aria-label={open ? "Collapse chat panel" : "Expand chat panel"}
          aria-expanded={open}
          title={open ? "Collapse" : "Expand"}
        >
          {open ? "›" : "‹"}
        </button>
      </div>
      <div className="ct-rail-right-body flex min-h-0 flex-1 flex-col">
        {view === "settings" && <ChatSettings productName={product.name} />}
        {view === "history" && <ChatHistory productColor={product.color} />}
        {view === "chat" && <ChatKimi productName={product.name} productColor={product.color} />}
      </div>
    </aside>
  );
}
