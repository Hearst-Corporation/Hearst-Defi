import type { Metadata } from "next";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = {
  title: "Apply — Hearst Connect",
  description:
    "Qualify for access to Hearst Connect — institutional USDC yield, mining-backed structured product.",
  robots: { index: false, follow: false },
};

export default function ApplyPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--ct-bg-deep, #0a0a0a)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.25rem",
      }}
    >
      {/* Logo / wordmark */}
      <div style={{ marginBottom: "3rem", textAlign: "center" }}>
        <span
          style={{
            display: "inline-block",
            fontSize: "0.6875rem",
            fontFamily: "var(--ct-font-mono, monospace)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--ct-accent, #A7FB90)",
            marginBottom: "0.5rem",
          }}
        >
          Hearst Connect
        </span>
        <p
          style={{
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.30)",
            fontFamily: "var(--ct-font-mono, monospace)",
            margin: 0,
          }}
        >
          Institutional USDC yield · Qualification form
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "1rem",
          padding: "2.5rem 2rem",
        }}
      >
        <ApplyForm />
      </div>

      {/* Legal footer */}
      <p
        style={{
          marginTop: "2rem",
          fontSize: "0.6875rem",
          color: "rgba(255,255,255,0.20)",
          textAlign: "center",
          maxWidth: "380px",
          lineHeight: 1.6,
          fontFamily: "var(--ct-font-mono, monospace)",
        }}
      >
        Not a guarantee of return. Past performance is not indicative of future results.
        For qualified investors only. Cayman SPV structure.
      </p>
    </div>
  );
}
