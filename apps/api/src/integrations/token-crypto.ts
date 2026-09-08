import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Authenticated encryption for OAuth tokens at rest.
 *
 * A leaked `calendar_connections` row must not be enough to read someone's
 * calendar, so refresh tokens are sealed with AES-256-GCM before they touch the
 * database. GCM (not CBC) because we need tamper detection: a swapped
 * ciphertext should fail to open, not decrypt to attacker-chosen bytes.
 */
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const VERSION = "v1";

let cachedKey: Buffer | null = null;

/** Accepts base64 or hex so operators can paste whichever their tooling emits. */
function parseKey(raw: string): Buffer {
  const trimmed = raw.trim();
  const candidates = /^[0-9a-fA-F]+$/.test(trimmed)
    ? [Buffer.from(trimmed, "hex"), Buffer.from(trimmed, "base64")]
    : [Buffer.from(trimmed, "base64")];

  for (const candidate of candidates) {
    if (candidate.length === KEY_BYTES) return candidate;
  }
  throw new Error(
    `CALENDAR_TOKEN_KEY must decode to ${KEY_BYTES} bytes (got ${candidates[0].length}). ` +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
  );
}

function key(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.CALENDAR_TOKEN_KEY;
  if (!raw) {
    // Deliberately fatal in every environment: silently falling back to
    // plaintext would make a dev misconfiguration indistinguishable from a
    // working setup right up until it shipped.
    throw new Error(
      "CALENDAR_TOKEN_KEY is not set — calendar OAuth tokens cannot be stored safely. " +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  cachedKey = parseKey(raw);
  return cachedKey;
}

/** True when the server is configured to hold provider tokens. */
export function isTokenCryptoConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/** Returns `v1:<iv>:<tag>:<ciphertext>`, all base64. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Reverses {@link encryptToken}. Throws on a wrong key, a truncated payload or
 * any tampering — callers should treat a failure as "this connection needs to
 * be re-authorised" rather than retrying.
 */
export function decryptToken(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Unrecognised encrypted token payload");
  }
  const [, ivB64, tagB64, ciphertextB64] = parts;
  const decipher = createDecipheriv(
    ALGORITHM,
    key(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** `null`-tolerant wrapper for optional columns. */
export function decryptOptional(payload: string | null): string | null {
  if (!payload) return null;
  return decryptToken(payload);
}

/** Test seam — clears the memoised key after `process.env` changes. */
export function resetTokenCryptoCache(): void {
  cachedKey = null;
}
