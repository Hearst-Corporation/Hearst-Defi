/**
 * Resolve IPFS CIDs and URIs to an HTTPS gateway URL.
 *
 * Security: arbitrary/attacker-controlled strings are NOT silently forwarded
 * to the gateway. Only well-formed CIDs (v0 Qm…, v1 baf…) and explicit
 * https:// / http:// / ipfs:// URLs are accepted. Anything else returns an
 * empty string so callers receive a no-op href rather than a gateway URL built
 * from untrusted input. (BLA-6)
 *
 * CID regexes mirror the ones used in src/app/admin/proofs/actions.ts.
 */

/** CIDv0: Qm + 44 base58 chars (total 46). */
const CID_V0_RE = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/;
/** CIDv1: baf + 49–56 alphanumeric chars (covers common base32/base58 CIDv1). */
const CID_V1_RE = /^baf[a-zA-Z0-9]{49,56}$/;

function isValidCid(value: string): boolean {
  return CID_V0_RE.test(value) || CID_V1_RE.test(value);
}

/**
 * Returns an HTTPS gateway URL for the given CID or IPFS URI, or `""`
 * when the input is not a recognised CID/URL (safe no-op href).
 *
 * Accepted forms:
 *   - `ipfs://<CID>` — stripped of the scheme, CID is validated before use.
 *   - `https://…` / `http://…` — returned as-is (already absolute).
 *   - Bare `Qm…` or `baf…` CID — prefixed with the gateway base.
 *
 * Anything else returns `""` to prevent forwarding arbitrary strings to the
 * gateway. The CID path segment is percent-encoded so special characters
 * cannot escape the path.
 */
export function ipfsGatewayUrl(cid: string): string {
  if (cid.startsWith("https://") || cid.startsWith("http://")) {
    return cid;
  }

  if (cid.startsWith("ipfs://")) {
    const rawCid = cid.slice(7);
    if (!isValidCid(rawCid)) return "";
    return `https://ipfs.io/ipfs/${encodeURIComponent(rawCid)}`;
  }

  if (isValidCid(cid)) {
    return `https://ipfs.io/ipfs/${encodeURIComponent(cid)}`;
  }

  return "";
}
