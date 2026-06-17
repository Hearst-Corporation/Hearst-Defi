"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitApplication } from "./actions";

type Step = 0 | 1 | 2;

const TOTAL_STEPS = 3;

// Q1
const PLATFORM_OPTIONS = [
  { value: "wealth", label: "Wealth manager / family office" },
  { value: "crypto", label: "Crypto-native / DeFi" },
  { value: "exchange", label: "Crypto exchange / OTC desk" },
  { value: "custody", label: "Custodian / infrastructure" },
] as const;

// Q2
const AUM_OPTIONS = [
  { value: "lt_10m", label: "< $10M" },
  { value: "10_50m", label: "$10M – $50M" },
  { value: "50_250m", label: "$50M – $250M" },
  { value: "250m_plus", label: "$250M+" },
  { value: "unsure", label: "Prefer not to say" },
] as const;

// Q3
const FUNDS_OPTIONS = [
  { value: "idle", label: "Mostly sitting unused / idle" },
  { value: "mix", label: "A mix of both" },
  { value: "earning", label: "Mostly earning yield already" },
] as const;

// Q4
const YIELD_STATUS_OPTIONS = [
  { value: "not_yet", label: "Not yet" },
  { value: "in_progress", label: "In progress / building" },
  { value: "live", label: "Yes, we're live" },
] as const;

// Q5
const YIELD_TYPE_OPTIONS = [
  { value: "low_risk", label: "Low-risk / capital preservation" },
  { value: "balanced", label: "Balanced risk / return" },
  { value: "growth", label: "Growth / higher return" },
  { value: "unsure", label: "Not sure yet" },
] as const;

// Q6
const VAULT_SIZE_OPTIONS = [
  { value: "100_500k", label: "$100K – $500K" },
  { value: "500k_1m", label: "$500K – $1M" },
  { value: "1_5m", label: "$1M – $5M" },
  { value: "5m_plus", label: "$5M+" },
  { value: "unsure", label: "Not sure yet" },
] as const;

// Q7
const TIMELINE_OPTIONS = [
  { value: "asap", label: "ASAP" },
  { value: "1_3m", label: "1 – 3 months" },
  { value: "3_6m", label: "3 – 6 months" },
  { value: "exploring", label: "Just exploring" },
] as const;

function ChoiceCard({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-lg border transition-all"
      style={{
        background: selected
          ? "rgba(167,251,144,0.08)"
          : "rgba(255,255,255,0.03)",
        borderColor: selected ? "var(--ct-accent)" : "rgba(255,255,255,0.10)",
        color: selected ? "var(--ct-accent)" : "var(--ct-text-muted)",
        fontFamily: "var(--ct-font-mono, monospace)",
        fontSize: "0.875rem",
        cursor: "pointer",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: "1rem",
          height: "1rem",
          borderRadius: "50%",
          border: selected
            ? "2px solid var(--ct-accent)"
            : "2px solid rgba(255,255,255,0.25)",
          background: selected ? "var(--ct-accent)" : "transparent",
          marginRight: "0.75rem",
          verticalAlign: "middle",
          flexShrink: 0,
        }}
      />
      {label}
    </button>
  );
}

export function ApplyForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(0);
  const [error, setError] = useState<string | null>(null);

  // Identity
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Answers
  const [platformType, setPlatformType] = useState("");
  const [aum, setAum] = useState("");
  const [fundsUsage, setFundsUsage] = useState("");
  const [yieldStatus, setYieldStatus] = useState("");
  const [yieldType, setYieldType] = useState("");
  const [vaultSize, setVaultSize] = useState("");
  const [timeline, setTimeline] = useState("");

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  function goNext() {
    if (step === 0) {
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError("Please enter a valid email address.");
        return;
      }
    }
    setError(null);
    setStep((s) => (s + 1) as Step);
  }

  function goBack() {
    setError(null);
    setStep((s) => (s - 1) as Step);
  }

  function handleSubmit() {
    const fd = new FormData();
    fd.set("email", email.trim());
    if (firstName.trim()) fd.set("firstName", firstName.trim());
    if (lastName.trim()) fd.set("lastName", lastName.trim());
    if (phone.trim()) fd.set("phone", phone.trim());
    if (platformType) fd.set("platformType", platformType);
    if (aum) fd.set("aum", aum);
    if (fundsUsage) fd.set("fundsUsage", fundsUsage);
    if (yieldStatus) fd.set("yieldStatus", yieldStatus);
    if (yieldType) fd.set("yieldType", yieldType);
    if (vaultSize) fd.set("vaultSize", vaultSize);
    if (timeline) fd.set("timeline", timeline);

    startTransition(async () => {
      const result = await submitApplication(fd);
      if (result.ok) {
        router.push("/apply/confirmed");
      } else {
        setError(result.error);
      }
    });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "0.5rem",
    padding: "0.75rem 1rem",
    color: "var(--ct-text-strong, #f5f5f5)",
    fontSize: "0.9375rem",
    outline: "none",
    fontFamily: "inherit",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.75rem",
    fontFamily: "var(--ct-font-mono, monospace)",
    color: "var(--ct-text-muted, #888)",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    marginBottom: "0.375rem",
  };

  return (
    <div style={{ width: "100%", maxWidth: "480px", margin: "0 auto" }}>
      {/* Progress bar */}
      <div
        style={{
          height: "2px",
          background: "rgba(255,255,255,0.08)",
          borderRadius: "1px",
          marginBottom: "2.5rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: "var(--ct-accent, #A7FB90)",
            borderRadius: "1px",
            transition: "width 0.3s ease",
          }}
        />
      </div>

      {/* Step 0 — Identity */}
      {step === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <h2
              style={{
                fontSize: "1.375rem",
                fontWeight: 600,
                color: "var(--ct-text-strong, #f5f5f5)",
                marginBottom: "0.5rem",
              }}
            >
              Tell us about yourself
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--ct-text-muted, #888)" }}>
              Takes 2 minutes. We'll reach out to discuss fit.
            </p>
          </div>

          <div>
            <label style={labelStyle}>Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@fund.io"
              style={inputStyle}
              autoFocus
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={labelStyle}>First name</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Alice"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Last name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Dupont"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Phone (optional)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+33 6 00 00 00 00"
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {/* Step 1 — Q1-Q4 */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div>
            <h2
              style={{
                fontSize: "1.375rem",
                fontWeight: 600,
                color: "var(--ct-text-strong, #f5f5f5)",
                marginBottom: "0.25rem",
              }}
            >
              About your platform
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={labelStyle}>What best describes your platform?</label>
            {PLATFORM_OPTIONS.map((o) => (
              <ChoiceCard
                key={o.value}
                label={o.label}
                selected={platformType === o.value}
                onClick={() => setPlatformType(o.value)}
              />
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={labelStyle}>Assets under management?</label>
            {AUM_OPTIONS.map((o) => (
              <ChoiceCard
                key={o.value}
                label={o.label}
                selected={aum === o.value}
                onClick={() => setAum(o.value)}
              />
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={labelStyle}>How are client funds currently deployed?</label>
            {FUNDS_OPTIONS.map((o) => (
              <ChoiceCard
                key={o.value}
                label={o.label}
                selected={fundsUsage === o.value}
                onClick={() => setFundsUsage(o.value)}
              />
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={labelStyle}>Do you offer yield or reward products?</label>
            {YIELD_STATUS_OPTIONS.map((o) => (
              <ChoiceCard
                key={o.value}
                label={o.label}
                selected={yieldStatus === o.value}
                onClick={() => setYieldStatus(o.value)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Q5-Q7 */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div>
            <h2
              style={{
                fontSize: "1.375rem",
                fontWeight: 600,
                color: "var(--ct-text-strong, #f5f5f5)",
                marginBottom: "0.25rem",
              }}
            >
              Sizing &amp; timing
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={labelStyle}>What type of yield product suits your clients?</label>
            {YIELD_TYPE_OPTIONS.map((o) => (
              <ChoiceCard
                key={o.value}
                label={o.label}
                selected={yieldType === o.value}
                onClick={() => setYieldType(o.value)}
              />
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={labelStyle}>Vault size for a first allocation?</label>
            {VAULT_SIZE_OPTIONS.map((o) => (
              <ChoiceCard
                key={o.value}
                label={o.label}
                selected={vaultSize === o.value}
                onClick={() => setVaultSize(o.value)}
              />
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={labelStyle}>What is your launch timeline?</label>
            {TIMELINE_OPTIONS.map((o) => (
              <ChoiceCard
                key={o.value}
                label={o.label}
                selected={timeline === o.value}
                onClick={() => setTimeline(o.value)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p
          style={{
            marginTop: "1rem",
            fontSize: "0.8125rem",
            color: "var(--ct-status-danger, #f87171)",
            fontFamily: "var(--ct-font-mono, monospace)",
          }}
        >
          {error}
        </p>
      )}

      {/* Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: step === 0 ? "flex-end" : "space-between",
          marginTop: "2rem",
          gap: "0.75rem",
        }}
      >
        {step > 0 && (
          <button
            type="button"
            onClick={goBack}
            disabled={pending}
            style={{
              padding: "0.625rem 1.25rem",
              borderRadius: "0.5rem",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "transparent",
              color: "var(--ct-text-muted, #888)",
              fontSize: "0.875rem",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ← Back
          </button>
        )}

        {step < 2 ? (
          <button
            type="button"
            onClick={goNext}
            style={{
              padding: "0.625rem 1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: "var(--ct-accent, #A7FB90)",
              color: "#0a0a0a",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Continue →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            style={{
              padding: "0.625rem 1.5rem",
              borderRadius: "0.5rem",
              border: "none",
              background: pending ? "rgba(167,251,144,0.4)" : "var(--ct-accent, #A7FB90)",
              color: "#0a0a0a",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: pending ? "default" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {pending ? "Submitting…" : "Submit application"}
          </button>
        )}
      </div>

      {/* Step counter */}
      <p
        style={{
          textAlign: "center",
          marginTop: "1.5rem",
          fontSize: "0.75rem",
          color: "rgba(255,255,255,0.25)",
          fontFamily: "var(--ct-font-mono, monospace)",
        }}
      >
        {step + 1} / {TOTAL_STEPS}
      </p>
    </div>
  );
}
