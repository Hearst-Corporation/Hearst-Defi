import "server-only";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Durable file storage on Supabase Storage (private `reports` bucket).
 *
 * We talk to the Storage REST API directly via `fetch` rather than pulling in
 * `@supabase/supabase-js` — the SDK is a large dependency and we only need two
 * operations (upload + signed URL). This mirrors how the rest of the codebase
 * integrates external services (HubSpot, Resend) with plain `fetch`.
 *
 * The service-role key bypasses RLS so the server can write into a private
 * bucket. It is SERVER-ONLY (`server-only` import above + never a NEXT_PUBLIC_*
 * var). Files are never world-readable: download URLs are short-lived signed
 * links minted on demand.
 *
 * When the storage env (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 * is unset, every function degrades gracefully — `isStorageConfigured()`
 * returns false and callers skip the durable upload (the PDF still streams to
 * the browser). This keeps local dev and unconfigured previews working.
 */

const BUCKET = env.SUPABASE_STORAGE_BUCKET;

export function isStorageConfigured(): boolean {
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

function storageBase(): { url: string; key: string } | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

export interface UploadResult {
  /** Object path inside the bucket, e.g. "memos/yield/2026-06.pdf". */
  path: string;
  /** Fully-qualified bucket-relative key used to mint signed URLs later. */
  bucket: string;
}

/**
 * Uploads a binary artifact to the private bucket. Overwrites any existing
 * object at the same path (idempotent for a deterministic monthly memo path).
 * Returns null when storage is unconfigured so callers degrade gracefully.
 */
export async function uploadReport(
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<UploadResult | null> {
  const base = storageBase();
  if (!base) {
    logger.warn("storage.upload skipped — SUPABASE storage env not configured", {
      path,
    });
    return null;
  }

  const cleanPath = path.replace(/^\/+/, "");
  const res = await fetch(
    `${base.url}/storage/v1/object/${BUCKET}/${cleanPath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${base.key}`,
        apikey: base.key,
        "Content-Type": contentType,
        // Overwrite an existing object at the same key instead of 409-ing —
        // the monthly memo path is deterministic and re-runs should replace.
        "x-upsert": "true",
      },
      // Buffer view → BodyInit. Copy into a fresh ArrayBuffer so we never hand
      // fetch a view over a larger pooled buffer.
      body: bytes.slice().buffer as ArrayBuffer,
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.error("storage.upload failed", { path: cleanPath, status: res.status }, detail);
    throw new Error(`Supabase storage upload failed (${res.status}): ${detail}`);
  }

  return { path: cleanPath, bucket: BUCKET };
}

/**
 * Mints a short-lived signed download URL for a stored object.
 * `expiresInSeconds` defaults to 1 hour. Returns null when unconfigured.
 */
export async function signedReportUrl(
  path: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const base = storageBase();
  if (!base) return null;

  const cleanPath = path.replace(/^\/+/, "");
  const res = await fetch(
    `${base.url}/storage/v1/object/sign/${BUCKET}/${cleanPath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${base.key}`,
        apikey: base.key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    },
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.error("storage.sign failed", { path: cleanPath, status: res.status }, detail);
    return null;
  }

  const data = (await res.json()) as { signedURL?: string };
  if (!data.signedURL) return null;
  // Storage returns a bucket-relative signed path; prefix with the project URL.
  return `${base.url}/storage/v1${data.signedURL}`;
}
