import "server-only";

/**
 * AES-256-GCM symmetric encryption for sensitive DB fields.
 *
 * Used for TOTP secrets (and any future at-rest field encryption).
 *
 * Key env: AUTH_TOTP_KEY — a 64-char hex string representing 32 bytes.
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Ciphertext format (all hex, joined by ":"): iv:authTag:ciphertext
 * This is a stable, self-describing format so old rows can always be decrypted.
 *
 * NEVER call these functions with a hardcoded key argument.
 * NEVER store the plaintext — always encrypt before persisting to the DB.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { readServerEnv } from "@/lib/env";

const ALGORITHM = "aes-256-gcm" as const;
const IV_BYTES = 12; // 96-bit IV recommended for GCM
const TAG_BYTES = 16;

const HEX_64_RE = /^[0-9a-fA-F]{64}$/;

function getKey(): Buffer {
  // LIVE read via the canon helper — unit tests rotate/delete the key per test.
  const hex = readServerEnv("AUTH_TOTP_KEY");
  if (!hex || !HEX_64_RE.test(hex)) {
    throw new Error(
      "AUTH_TOTP_KEY is missing or not 64 hex chars — TOTP cannot encrypt/decrypt. " +
        "Set it in env. Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt `plaintext` with AES-256-GCM.
 * Returns a colon-separated hex string: `iv:authTag:ciphertext`.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Decrypt a value previously produced by `encrypt`.
 * Throws on tampered ciphertext or wrong key (GCM auth tag mismatch).
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format — expected iv:authTag:data");
  }
  const [ivHex, tagHex, dataHex] = parts as [string, string, string];
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");

  if (iv.length !== IV_BYTES) throw new Error("Invalid IV length");
  if (tag.length !== TAG_BYTES) throw new Error("Invalid auth tag length");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}
