"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { submitKycDocument } from "@/lib/onboarding/actions";
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
      className={cn("product-doc-stack", className)}
      aria-label="Identity document upload"
      data-testid="kyc-document-form"
    >
      <div className="product-doc-stack--actions">
        {/* Document type */}
        <div className="flex flex-col">
          <label htmlFor="kyc-doc-type" className="ct-form-label">
            Document type
          </label>
          <select
            id="kyc-doc-type"
            name="idDocType"
            defaultValue="PASSPORT"
            required
            disabled={submitting || succeeded}
            className="ct-select body-sm"
          >
            {DOCUMENT_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Issuing country (ISO3) */}
        <div className="flex flex-col">
          <label htmlFor="kyc-country" className="ct-form-label">
            Issuing country
          </label>
          <select
            id="kyc-country"
            name="country"
            defaultValue="GBR"
            required
            disabled={submitting || succeeded}
            className="ct-select body-sm"
          >
            {COUNTRIES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label} ({value})
              </option>
            ))}
          </select>
        </div>

        {/* Document file */}
        <div className="flex flex-col">
          <span className="ct-form-label" id="kyc-file-label">
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
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={submitting || succeeded}
              onClick={() => fileInputRef.current?.click()}
            >
              Choose document
            </Button>
            <span
              className={cn(
                "body-xs m-0 truncate",
                fileName ? "ct-text-muted" : "ct-text-faint",
              )}
              aria-live="polite"
            >
              {fileName ?? "No file selected"}
            </span>
          </div>
          <p className="body-xs ct-text-faint m-0 mt-[var(--ct-space-1)]">
            JPEG, PNG or PDF · max 10 MB. Document only — no selfie required.
          </p>
        </div>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={submitting || succeeded}
      >
        {submitting ? "Uploading…" : "Submit for verification"}
      </Button>

      {succeeded ? (
        <p className="body-xs ct-status-success m-0" role="status">
          Document submitted — verification in progress. You will be notified by
          email once your identity has been verified.
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="body-xs ct-status-danger m-0" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
