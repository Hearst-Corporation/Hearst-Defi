"use client";

import { useRef, useState } from "react";

import { submitKycDocument } from "@/lib/onboarding/actions";
import { BENTO_PRIMARY_BTN, BENTO_SECONDARY_BTN } from "@/components/ui/bento";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// KycDocumentForm — OUR native Cockpit KYC document upload form.
//
// This REPLACES the Sumsub WebSDK / iframe / CDN bundle. There is NO Sumsub
// asset, NO "Powered by Sumsub", NO static.sumsub.com here. The investor picks
// a document type + country and uploads an image/PDF through our own UI; the
// <form action={submitKycDocument}> server action creates the Sumsub applicant,
// binds applicantId→userId server-side (P0-4), uploads the document over the
// REST API and asks Sumsub to start the review. The GREEN/RED verdict lands
// later on the existing webhook — this form never approves KYC itself.
//
// Level: id-only (document only, NO liveness / selfie).
// ---------------------------------------------------------------------------

/** UI option → the Sumsub idDocType the server action expects. */
const DOCUMENT_TYPES = [
  { value: "PASSPORT", label: "Passport" },
  { value: "ID_CARD", label: "National ID card" },
  { value: "DRIVERS", label: "Driver's license" },
  { value: "RESIDENCE_PERMIT", label: "Residence permit" },
] as const;

/**
 * A short list of common investor-base countries → ISO 3166-1 alpha-3. The
 * server re-validates the code (`^[A-Z]{3}$`), so this is purely a convenience
 * picker — there is no client-trusted authorization here.
 */
const COUNTRIES = [
  { value: "GBR", label: "United Kingdom" },
  { value: "USA", label: "United States" },
  { value: "FRA", label: "France" },
  { value: "DEU", label: "Germany" },
  { value: "CHE", label: "Switzerland" },
  { value: "ARE", label: "United Arab Emirates" },
  { value: "SGP", label: "Singapore" },
  { value: "HKG", label: "Hong Kong" },
  { value: "CAN", label: "Canada" },
  { value: "AUS", label: "Australia" },
  { value: "ITA", label: "Italy" },
  { value: "ESP", label: "Spain" },
  { value: "NLD", label: "Netherlands" },
  { value: "LUX", label: "Luxembourg" },
  { value: "IRL", label: "Ireland" },
  { value: "CYM", label: "Cayman Islands" },
  { value: "JPN", label: "Japan" },
  { value: "KOR", label: "South Korea" },
] as const;

/** Accepted client-side file types — mirrors ACCEPTED_KYC_MIME (actions.ts),
 *  incl. HEIC/WebP so iPhone photos aren't blocked by the native file picker. */
const FILE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";

type FormState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

const FIELD_LABEL =
  "text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500";
const SELECT_INPUT =
  "bg-[#15191C] border border-white/10 focus:border-[#A7FB90]/40 text-white rounded-lg px-4 py-2.5 text-[13px] outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
// Shared bento CTA chrome (single source of truth in @/components/ui/bento).
// The submit button keeps `w-full` (full-width on its own row); the shared
// BENTO_PRIMARY_BTN has the identical chrome otherwise.
const PRIMARY_BTN = cn("w-full", BENTO_PRIMARY_BTN);
const SECONDARY_BTN = BENTO_SECONDARY_BTN;

export interface KycDocumentFormProps {
  /** Called after a successful submission (e.g. navigate to the next step). */
  onSuccess?: () => void;
  className?: string;
}

export function KycDocumentForm({ onSuccess, className }: KycDocumentFormProps) {
  const [state, setState] = useState<FormState>({ status: "idle" });
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitting = state.status === "submitting";
  const succeeded = state.status === "success";

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setFileName(file ? file.name : null);
  }

  async function handleAction(formData: FormData) {
    setState({ status: "submitting" });
    try {
      const result = await submitKycDocument(formData);
      if (result.ok) {
        setState({ status: "success" });
        onSuccess?.();
      } else {
        setState({ status: "error", message: result.error });
      }
    } catch {
      setState({
        status: "error",
        message: "Could not submit your document. Please try again.",
      });
    }
  }

  return (
    <form
      action={handleAction}
      className={cn(
        "rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col",
        className,
      )}
      aria-label="Identity document upload"
      data-testid="kyc-document-form"
    >
      <div className="p-5 border-b border-white/5">
        <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em]">
          Identity document
        </h2>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Document type */}
        <div className="flex flex-col gap-2">
          <label htmlFor="kyc-doc-type" className={FIELD_LABEL}>
            Document type
          </label>
          <select
            id="kyc-doc-type"
            name="idDocType"
            defaultValue="PASSPORT"
            required
            disabled={submitting || succeeded}
            className={SELECT_INPUT}
          >
            {DOCUMENT_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Issuing country (ISO3) */}
        <div className="flex flex-col gap-2">
          <label htmlFor="kyc-country" className={FIELD_LABEL}>
            Issuing country
          </label>
          <select
            id="kyc-country"
            name="country"
            defaultValue="GBR"
            required
            disabled={submitting || succeeded}
            className={SELECT_INPUT}
          >
            {COUNTRIES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label} ({value})
              </option>
            ))}
          </select>
        </div>

        {/* Document file */}
        <div className="flex flex-col gap-2">
          <span className={FIELD_LABEL} id="kyc-file-label">
            Document image
          </span>
          <input
            ref={fileInputRef}
            id="kyc-file"
            name="file"
            type="file"
            accept={FILE_ACCEPT}
            required
            disabled={submitting || succeeded}
            onChange={handleFileChange}
            aria-labelledby="kyc-file-label"
            className="sr-only"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={submitting || succeeded}
              onClick={() => fileInputRef.current?.click()}
              className={SECONDARY_BTN}
            >
              Choose document
            </button>
            <span
              className={cn(
                "text-[12px] m-0 truncate",
                fileName ? "text-zinc-400" : "text-zinc-600",
              )}
              aria-live="polite"
            >
              {fileName ?? "No file selected"}
            </span>
          </div>
          <p className="text-[11px] text-zinc-600 leading-relaxed m-0">
            JPEG, PNG or PDF · max 10 MB. Document only — no selfie required.
          </p>
        </div>

        <button
          type="submit"
          className={PRIMARY_BTN}
          disabled={submitting || succeeded}
        >
          {submitting ? "Uploading…" : "Submit for verification"}
        </button>

        {succeeded ? (
          <p className="text-[12px] text-[#A7FB90] m-0" role="status">
            Document submitted — verification in progress. You will be notified
            by email once your identity has been verified.
          </p>
        ) : null}

        {state.status === "error" ? (
          <p className="text-[12px] text-red-400 m-0" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
