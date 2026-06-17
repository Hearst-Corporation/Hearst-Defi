import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Application received — Hearst Connect",
  robots: { index: false, follow: false },
};

export default function ConfirmedPage() {
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
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "3rem",
          height: "3rem",
          borderRadius: "50%",
          background: "rgba(167,251,144,0.12)",
          border: "1.5px solid var(--ct-accent, #A7FB90)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1.5rem",
          fontSize: "1.25rem",
        }}
      >
        ✓
      </div>

      <h1
        style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          color: "var(--ct-text-strong, #f5f5f5)",
          marginBottom: "0.75rem",
        }}
      >
        Application received
      </h1>

      <p
        style={{
          fontSize: "0.9375rem",
          color: "var(--ct-text-muted, #888)",
          maxWidth: "360px",
          lineHeight: 1.6,
          marginBottom: "2rem",
        }}
      >
        Thank you. Our team will review your profile and send a login link to access
        your investor cockpit within 1–2 business days.
      </p>

      <p
        style={{
          fontSize: "0.6875rem",
          color: "rgba(255,255,255,0.20)",
          fontFamily: "var(--ct-font-mono, monospace)",
          letterSpacing: "0.04em",
        }}
      >
        Hearst Connect · Institutional USDC yield
      </p>
    </div>
  );
}
