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
import { ChatKimi } from "../chat/ChatKimi";
import { ChatSettings } from "../chat/ChatSettings";
import { ChatHistory } from "../chat/ChatHistory";
import { useCockpit } from "./context";

const TITLES: Record<string, string> = {
  chat: "Assistant",
  settings: "Réglages",
  history: "Historique",
};

function WidthIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
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
  const { getProduct } = useCockpit();
  const product = getProduct(active);

  const railClass = [
    "ct-rail-right",
    mode === "collapsed" ? "collapsed" : "",
    mode === "expanded" ? "expanded" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={railClass}>
      <div className="ct-rail-right-header">
        {open && (
          <span className="ct-rail-right-title">
            <span
              className="ct-chat-ctx-dot"
              style={{ background: product.color }}
            />
            {TITLES[view] ?? "Assistant"}
            <span className="ct-chat-ctx-name">· {product.name}</span>
          </span>
        )}
        {open && (
          <>
            <button
              className={`ct-rail-right-btn${view === "history" ? " active" : ""}`}
              onClick={() => setView(view === "history" ? "chat" : "history")}
              aria-label={view === "history" ? "Back to chat" : "Chat history"}
              title={view === "history" ? "Back to chat" : "History"}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.2" />
                <path d="M6.5 3.5V6.5L8.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              className={`ct-rail-right-btn${view === "settings" ? " active" : ""}`}
              onClick={() => setView(view === "settings" ? "chat" : "settings")}
              aria-label={view === "settings" ? "Back to chat" : "Chat settings"}
              title={view === "settings" ? "Back to chat" : "Settings"}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="1.75" stroke="currentColor" strokeWidth="1.2" />
                <path d="M6.5 1v1.5M6.5 10.5V12M12 6.5h-1.5M2.5 6.5H1M10.3 2.7l-1.06 1.06M3.76 9.24l-1.06 1.06M10.3 10.3l-1.06-1.06M3.76 3.76 2.7 2.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              className={`ct-rail-right-btn ct-rail-right-btn--width${expanded ? " active" : ""}`}
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
          className="ct-rail-right-btn"
          onClick={toggle}
          aria-label={open ? "Collapse chat panel" : "Expand chat panel"}
          aria-expanded={open}
          title={open ? "Collapse" : "Expand"}
        >
          {open ? "›" : "‹"}
        </button>
      </div>
      <div className="ct-rail-right-body">
        {view === "settings" && <ChatSettings productName={product.name} />}
        {view === "history" && <ChatHistory productColor={product.color} />}
        {view === "chat" && <ChatKimi productName={product.name} productColor={product.color} />}
      </div>
    </aside>
  );
}
