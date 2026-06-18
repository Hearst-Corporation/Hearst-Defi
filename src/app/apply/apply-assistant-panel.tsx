"use client";

/**
 * ApplyAssistantPanel — presentational assistant column rendered INSIDE the
 * qualification chamber (right side, beside the funnel). Static for now: the
 * suggestions and message field are visual only. Logic (wiring to the Master
 * Agent) is plugged in a follow-up once the layout is validated.
 *
 * /apply is a bare route (no Cockpit shell) — this panel carries the assistant
 * affordance inline beside the qualification funnel.
 */

type Step = "about" | "platform" | "sizing";

const SUGGESTIONS: Record<Step, readonly string[]> = {
  about: [
    "What information is required here?",
    "Who is eligible to apply?",
    "How is my information used?",
    "What comes after I submit?",
  ],
  platform: [
    "What counts as assets under management?",
    "Why do you ask how funds are deployed?",
    "Do I need an existing yield product?",
    "Is my platform a good fit?",
  ],
  sizing: [
    "What vault size should I pick?",
    "How is the yield product structured?",
    "What does the timeline commit me to?",
    "What happens after I submit?",
  ],
};

function PersonIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="ct-apply-assistant-suggestion-icon"
    >
      <circle cx="8" cy="5" r="2.6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M2.5 13.2c0-2.6 2.4-4.2 5.5-4.2s5.5 1.6 5.5 4.2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="ct-apply-assistant-chevron"
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ApplyAssistantPanel({ step }: { step: Step }) {
  const suggestions = SUGGESTIONS[step];

  return (
    <aside className="ct-apply-assistant" aria-label="Hearst Connect assistant">
      <header className="ct-apply-assistant-head">
        <span className="ct-apply-assistant-head-left">
          <span aria-hidden="true" className="ct-apply-assistant-status-dot" />
          <span className="eyebrow ct-text-strong">Hearst Connect Assistant</span>
        </span>
        <Chevron />
      </header>

      <div className="ct-apply-assistant-intro">
        <span aria-hidden="true" className="ct-apply-assistant-mark">
          H
        </span>
        <p className="ct-apply-assistant-intro-body m-0">
          I&apos;m your Hearst Connect assistant. I can help you with this step,
          the information we need, and what comes next.
        </p>
      </div>

      <div className="ct-apply-assistant-group">
        <p className="eyebrow ct-text-muted m-0">Suggested for this step</p>
        <div className="ct-apply-assistant-suggestions">
          {suggestions.map((label) => (
            <button
              key={label}
              type="button"
              disabled
              aria-disabled="true"
              className="ct-apply-assistant-suggestion ct-focus-ring"
            >
              <PersonIcon />
              <span className="ct-apply-assistant-suggestion-label">{label}</span>
              <Chevron />
            </button>
          ))}
        </div>
      </div>

      <div className="ct-apply-assistant-foot">
        <p className="ct-apply-assistant-prompt m-0">
          Ask me anything about this step…
        </p>
        <div className="ct-apply-assistant-field">
          <span className="ct-apply-assistant-field-text">
            Message the assistant…
          </span>
          <span aria-hidden="true" className="ct-apply-assistant-send">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 13V3M8 3L4 7M8 3l4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </aside>
  );
}
