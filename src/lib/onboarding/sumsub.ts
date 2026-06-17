import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// =============================================================================
// Sumsub backend — API request signing, access-token minting, webhook verify.
// =============================================================================
//
// Replaces the retired Persona vendor. The agnostic security model is unchanged:
// the applicantId binding to a userId lives in the KycInquiry claim table (P0-4),
// and this module never trusts the webhook payload to resolve a userId — see
// src/app/api/sumsub/webhook/route.ts.
//
// Two integration styles coexist here:
//   - createAccessToken() — legacy WebSDK launch token (kept, not removed).
//   - createApplicant() / uploadIdDoc() / requestApplicantCheck() — the CUSTOM
//     server-side flow: we POST the Sumsub REST API directly from our own
//     Cockpit form, with NO WebSDK, NO iframe, NO Sumsub CDN asset. The investor
//     uploads their document through our UI; the verdict returns via the webhook.
//
// All functions are server-only: they read SUMSUB_SECRET_KEY / SUMSUB_APP_TOKEN
// which must never reach the client bundle.

/** Sumsub production/sandbox API base. Sandbox app tokens carry the `sbx:` prefix. */
const SUMSUB_BASE_URL = "https://api.sumsub.com";

// Default verification level. id-only = document-only (no liveness/selfie) →
// the custom Cockpit form path, no Sumsub WebSDK/iframe. Overridable per call or
// via SUMSUB_LEVEL_NAME. Kept in sync with the active env so an unset var never
// silently falls back to the iframe-requiring "id-and-liveness" level.
const DEFAULT_LEVEL_NAME = "id-only";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** True when both the app token and secret key are present. */
export function isSumsubConfigured(): boolean {
  return (
    (process.env.SUMSUB_APP_TOKEN ?? "").length > 0 &&
    (process.env.SUMSUB_SECRET_KEY ?? "").length > 0
  );
}

/** Resolves the configured level name, falling back to the default. */
export function sumsubLevelName(): string {
  const fromEnv = process.env.SUMSUB_LEVEL_NAME;
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_LEVEL_NAME;
}

// ---------------------------------------------------------------------------
// API request signing
// ---------------------------------------------------------------------------
//
// Sumsub signs every API call with:
//   X-App-Token        — the app token (sbx:... in sandbox)
//   X-App-Access-Ts    — UNIX seconds when the request is signed
//   X-App-Access-Sig   — HMAC_SHA256(secret, ts + METHOD + path + body), hex
//
// `path` MUST include the query string (e.g. "/resources/accessTokens?userId=x").
// `body` is the raw request body string ("" for bodyless GET/POST).

export interface SignedSumsubHeaders {
  "X-App-Token": string;
  "X-App-Access-Ts": string;
  "X-App-Access-Sig": string;
}

/**
 * Builds the signed headers for a Sumsub API request.
 *
 * The HMAC is computed over `ts + METHOD + path + body`. For JSON calls `body`
 * is the raw request body string; for the multipart idDoc upload it MUST be the
 * EXACT bytes of the multipart body (Buffer / Uint8Array) — signing the string
 * representation would corrupt the binary parts and fail Sumsub validation.
 *
 * @param method HTTP method, upper-case (GET/POST/...).
 * @param path   Request path INCLUDING the query string, e.g.
 *               "/resources/accessTokens?userId=u1&levelName=id-and-liveness".
 * @param body   Raw request body — string ("" when none) or raw bytes for
 *               multipart uploads.
 * @throws when SUMSUB_APP_TOKEN / SUMSUB_SECRET_KEY are not configured.
 */
export function signApiRequest(
  method: string,
  path: string,
  body: string | Uint8Array = "",
): SignedSumsubHeaders {
  const appToken = process.env.SUMSUB_APP_TOKEN;
  const secret = process.env.SUMSUB_SECRET_KEY;
  if (!appToken || !secret) {
    throw new Error(
      "signApiRequest: SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY must be set",
    );
  }

  const ts = Math.floor(Date.now() / 1000).toString();
  const hmac = createHmac("sha256", secret).update(ts + method.toUpperCase() + path);
  // The body is appended to the SAME running HMAC: as a UTF-8 string for JSON
  // calls, or as raw bytes for the multipart upload so the binary image content
  // is signed verbatim.
  hmac.update(typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body));
  const signature = hmac.digest("hex");

  return {
    "X-App-Token": appToken,
    "X-App-Access-Ts": ts,
    "X-App-Access-Sig": signature,
  };
}

// ---------------------------------------------------------------------------
// Access token minting (WebSDK launch)
// ---------------------------------------------------------------------------

interface AccessTokenResponse {
  token: string;
  userId: string;
}

/**
 * POST /resources/accessTokens — mints a short-lived token used by the WebSDK
 * to launch the verification flow for `externalUserId`.
 *
 * `externalUserId` is OUR id (the authenticated session userId). It is echoed
 * back by Sumsub as `externalUserId` in webhooks, but the webhook NEVER trusts
 * it for authorization: the applicantId→userId binding is the KycInquiry claim.
 *
 * @returns the WebSDK access token.
 * @throws when Sumsub returns a non-2xx response or the body is malformed.
 */
export async function createAccessToken(
  externalUserId: string,
  levelName: string = sumsubLevelName(),
): Promise<string> {
  if (!externalUserId || externalUserId.trim() === "") {
    throw new Error("createAccessToken: externalUserId must be a non-empty string");
  }

  const path =
    `/resources/accessTokens?userId=${encodeURIComponent(externalUserId)}` +
    `&levelName=${encodeURIComponent(levelName)}`;
  const headers = signApiRequest("POST", path, "");

  const res = await fetch(`${SUMSUB_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    // No request body — the parameters travel in the query string. The empty
    // body must match the "" used when computing the signature above.
    body: "",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `createAccessToken: Sumsub returned ${res.status} ${res.statusText} ${detail}`.trim(),
    );
  }

  const json: unknown = await res.json();
  if (
    typeof json !== "object" ||
    json === null ||
    typeof (json as { token?: unknown }).token !== "string"
  ) {
    throw new Error("createAccessToken: malformed Sumsub response (missing token)");
  }

  return (json as AccessTokenResponse).token;
}

// ---------------------------------------------------------------------------
// CUSTOM document-upload flow (no WebSDK)
// ---------------------------------------------------------------------------
//
// id-only level: document upload only, NO liveness / selfie. The investor picks
// a document type + country and uploads an image/PDF through our own form; we
// relay it to the Sumsub REST API server-side. The GREEN/RED verdict still lands
// asynchronously on the webhook (unchanged).

/** The document types Sumsub accepts for the id-only level. */
export const ID_DOC_TYPES = [
  "PASSPORT",
  "ID_CARD",
  "DRIVERS",
  "RESIDENCE_PERMIT",
] as const;

/** One of the supported {@link ID_DOC_TYPES}. */
export type IdDocType = (typeof ID_DOC_TYPES)[number];

/** Reads a header tolerant of casing differences across runtimes. */
function readHeader(headers: Headers, name: string): string | null {
  return headers.get(name) ?? headers.get(name.toLowerCase());
}

/**
 * POST /resources/applicants?levelName=... — creates a Sumsub applicant for OUR
 * externalUserId (always the authenticated session userId; never client input).
 *
 * Idempotent: if an applicant already exists for this externalUserId Sumsub
 * answers 409 ("already exists"); we then GET the existing applicant and return
 * its id, so a retried submission re-uses the same applicant.
 *
 * @returns the Sumsub applicantId.
 * @throws when Sumsub returns an unexpected non-2xx response or a malformed body.
 */
export async function createApplicant(
  externalUserId: string,
  levelName: string = sumsubLevelName(),
): Promise<{ applicantId: string }> {
  if (!externalUserId || externalUserId.trim() === "") {
    throw new Error("createApplicant: externalUserId must be a non-empty string");
  }

  const path = `/resources/applicants?levelName=${encodeURIComponent(levelName)}`;
  const body = JSON.stringify({ externalUserId });
  const headers = signApiRequest("POST", path, body);

  const res = await fetch(`${SUMSUB_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
  });

  if (res.ok) {
    const json: unknown = await res.json();
    const id =
      typeof json === "object" && json !== null
        ? (json as { id?: unknown }).id
        : undefined;
    if (typeof id !== "string" || id === "") {
      throw new Error("createApplicant: malformed Sumsub response (missing id)");
    }
    return { applicantId: id };
  }

  // 409 — an applicant already exists for this externalUserId. Recover its id.
  if (res.status === 409) {
    await res.text().catch(() => "");
    return { applicantId: await getApplicantIdByExternalUserId(externalUserId) };
  }

  const detail = await res.text().catch(() => "");
  throw new Error(
    `createApplicant: Sumsub returned ${res.status} ${res.statusText} ${detail}`.trim(),
  );
}

/**
 * GET /resources/applicants/-/{externalUserId}/one — resolves the applicantId
 * already attached to OUR externalUserId. Used to make {@link createApplicant}
 * idempotent on the 409 ("already exists") path.
 */
export async function getApplicantIdByExternalUserId(
  externalUserId: string,
): Promise<string> {
  // Sumsub addresses an applicant by externalUserId with a matrix parameter:
  // /resources/applicants/-;externalUserId=<id>/one  (NOT /-/<id>/one, which 404s).
  const path = `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`;
  const headers = signApiRequest("GET", path, "");

  const res = await fetch(`${SUMSUB_BASE_URL}${path}`, {
    method: "GET",
    headers: { ...headers, Accept: "application/json" },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `getApplicantIdByExternalUserId: Sumsub returned ${res.status} ${res.statusText} ${detail}`.trim(),
    );
  }

  const json: unknown = await res.json();
  const id =
    typeof json === "object" && json !== null
      ? (json as { id?: unknown }).id
      : undefined;
  if (typeof id !== "string" || id === "") {
    throw new Error(
      "getApplicantIdByExternalUserId: malformed Sumsub response (missing id)",
    );
  }
  return id;
}

/** Parameters for {@link uploadIdDoc}. */
export interface UploadIdDocInput {
  idDocType: IdDocType;
  /** ISO 3166-1 alpha-3 country code, e.g. "GBR" / "FRA". */
  country: string;
  /** Raw bytes of the document image / PDF. */
  fileBytes: Uint8Array;
  /** Original file name (used for the multipart filename). */
  fileName: string;
  /** MIME type, e.g. "image/jpeg" / "application/pdf". */
  mimeType: string;
}

/**
 * POST /resources/applicants/{applicantId}/info/idDoc — uploads ONE document to
 * the applicant as a multipart/form-data request, built manually so the HMAC
 * signature is computed over the EXACT bytes we send (Sumsub validates the
 * signature against the raw multipart body — the binary image included).
 *
 * Parts:
 *   - "metadata" — JSON { idDocType, country }
 *   - "content"  — the file bytes (binary)
 *
 * @returns the Sumsub image id from the `X-Image-Id` response header.
 * @throws when Sumsub returns a non-2xx response.
 */
export async function uploadIdDoc(
  applicantId: string,
  input: UploadIdDocInput,
): Promise<{ imageId: string }> {
  if (!applicantId || applicantId.trim() === "") {
    throw new Error("uploadIdDoc: applicantId must be a non-empty string");
  }

  const path = `/resources/applicants/${encodeURIComponent(applicantId)}/info/idDoc`;

  // Stable boundary — random enough to never collide with the body content.
  const boundary =
    "----HearstSumsub" + createHmac("sha256", "boundary").update(applicantId + Date.now()).digest("hex").slice(0, 24);
  const CRLF = "\r\n";
  const metadata = JSON.stringify({
    idDocType: input.idDocType,
    country: input.country,
  });

  // Build the multipart body as raw bytes. The image part is appended verbatim
  // so the bytes signed by signApiRequest match the bytes sent on the wire.
  const head =
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="metadata"${CRLF}` +
    `Content-Type: application/json${CRLF}${CRLF}` +
    `${metadata}${CRLF}` +
    `--${boundary}${CRLF}` +
    `Content-Disposition: form-data; name="content"; filename="${input.fileName.replace(/"/g, "")}"${CRLF}` +
    `Content-Type: ${input.mimeType}${CRLF}${CRLF}`;
  const tail = `${CRLF}--${boundary}--${CRLF}`;

  const body = Buffer.concat([
    Buffer.from(head, "utf8"),
    Buffer.from(input.fileBytes),
    Buffer.from(tail, "utf8"),
  ]);

  const headers = signApiRequest("POST", path, body);

  const res = await fetch(`${SUMSUB_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      Accept: "application/json",
    },
    // Buffer is a Uint8Array — accepted as a BodyInit by fetch.
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `uploadIdDoc: Sumsub returned ${res.status} ${res.statusText} ${detail}`.trim(),
    );
  }

  const imageId = readHeader(res.headers, "X-Image-Id");
  if (!imageId) {
    throw new Error("uploadIdDoc: Sumsub response missing X-Image-Id header");
  }
  return { imageId };
}

/**
 * POST /resources/applicants/{applicantId}/status/pending?reason=docs_sent —
 * moves the applicant to "pending" so Sumsub runs the verification now that the
 * document is uploaded. Best-effort: failures are logged, never thrown, so a
 * transient hiccup here does not lose an already-uploaded document.
 *
 * @returns true when the request succeeded.
 */
export async function requestApplicantCheck(applicantId: string): Promise<boolean> {
  if (!applicantId || applicantId.trim() === "") {
    console.error("[sumsub] requestApplicantCheck: empty applicantId");
    return false;
  }

  const path =
    `/resources/applicants/${encodeURIComponent(applicantId)}/status/pending` +
    `?reason=docs_sent`;
  try {
    const headers = signApiRequest("POST", path, "");
    const res = await fetch(`${SUMSUB_BASE_URL}${path}`, {
      method: "POST",
      headers: { ...headers, Accept: "application/json" },
      body: "",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(
        `[sumsub] requestApplicantCheck: ${res.status} ${res.statusText} ${detail}`.trim(),
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[sumsub] requestApplicantCheck failed:", err);
    return false;
  }
}

/** Read model returned by {@link getApplicantStatus}. */
export interface ApplicantStatus {
  /** Sumsub `reviewStatus` (e.g. "init" | "pending" | "completed"). */
  reviewStatus: string;
  /** `reviewResult.reviewAnswer` when present (GREEN | RED). */
  reviewAnswer?: string;
}

/**
 * GET /resources/applicants/{applicantId}/status — optional status read used by
 * the UI to surface progress. The authoritative approval still flows through the
 * webhook; this is a convenience poll only.
 */
export async function getApplicantStatus(
  applicantId: string,
): Promise<ApplicantStatus> {
  if (!applicantId || applicantId.trim() === "") {
    throw new Error("getApplicantStatus: applicantId must be a non-empty string");
  }

  const path = `/resources/applicants/${encodeURIComponent(applicantId)}/status`;
  const headers = signApiRequest("GET", path, "");

  const res = await fetch(`${SUMSUB_BASE_URL}${path}`, {
    method: "GET",
    headers: { ...headers, Accept: "application/json" },
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `getApplicantStatus: Sumsub returned ${res.status} ${res.statusText} ${detail}`.trim(),
    );
  }

  const json: unknown = await res.json();
  if (typeof json !== "object" || json === null) {
    throw new Error("getApplicantStatus: malformed Sumsub response");
  }
  const obj = json as {
    reviewStatus?: unknown;
    reviewResult?: { reviewAnswer?: unknown } | null;
  };
  const reviewStatus =
    typeof obj.reviewStatus === "string" ? obj.reviewStatus : "unknown";
  const reviewAnswer =
    obj.reviewResult && typeof obj.reviewResult.reviewAnswer === "string"
      ? obj.reviewResult.reviewAnswer
      : undefined;

  return reviewAnswer !== undefined
    ? { reviewStatus, reviewAnswer }
    : { reviewStatus };
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------
//
// Sumsub signs the RAW request body with HMAC over SUMSUB_WEBHOOK_SECRET. The
// digest is sent in `x-payload-digest` (hex) and the algorithm in
// `x-payload-digest-alg` (default HMAC_SHA256_HEX). We support the SHA-1/256/512
// HEX variants Sumsub may send. Comparison is timing-safe.

/** Maps Sumsub's algorithm header to a Node crypto hash name. */
function hashForAlg(alg: string | null | undefined): string | null {
  switch ((alg ?? "HMAC_SHA256_HEX").toUpperCase()) {
    case "HMAC_SHA1_HEX":
      return "sha1";
    case "HMAC_SHA256_HEX":
      return "sha256";
    case "HMAC_SHA512_HEX":
      return "sha512";
    default:
      return null;
  }
}

/**
 * Verifies a Sumsub webhook signature in constant time.
 *
 * @param rawBody The raw request body string (must be the exact bytes received).
 * @param header  Value of the `x-payload-digest` header (hex digest).
 * @param secret  SUMSUB_WEBHOOK_SECRET.
 * @param alg     Value of the `x-payload-digest-alg` header (default SHA256 hex).
 */
export function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  alg?: string | null,
): boolean {
  if (!header || !secret) return false;

  const hashName = hashForAlg(alg);
  if (!hashName) return false;

  const expected = createHmac(hashName, secret).update(rawBody).digest("hex");

  // Explicit length-check before timingSafeEqual (avoids throw → catch path).
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(header.trim(), "utf8");
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}
