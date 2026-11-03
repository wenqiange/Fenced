/**
 * RFC 4122 v4 UUID.
 *
 * Used as an idempotency key and future server id, not a secret, so
 * Math.random is acceptable. shortcut: swap for expo-crypto's randomUUID if an
 * id ever needs to be unguessable.
 */
export function uuidv4(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === "function") return g.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function localId(prefix: string): string {
  return `${prefix}-${uuidv4()}`;
}
