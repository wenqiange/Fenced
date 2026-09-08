import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Stateless CSRF protection for the OAuth round trip.
 *
 * The `state` parameter has to survive a redirect through Google and come back
 * naming the user who started the flow. Signing it means no pending-flow table
 * and no server affinity, while still making it unforgeable — without the
 * signature, anyone could complete a flow against another user's account id.
 */
const TTL_MS = 10 * 60 * 1000;

interface StatePayload {
  /** Fenced user id that started the flow. */
  uid: string;
  /** Issued-at, epoch ms. */
  iat: number;
  /** Nonce, so two flows started in the same millisecond differ. */
  n: string;
}

function secret(): string {
  const value =
    process.env.CALENDAR_OAUTH_STATE_SECRET ??
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  if (!value) {
    throw new Error(
      "CALENDAR_OAUTH_STATE_SECRET (or GOOGLE_CALENDAR_CLIENT_SECRET) must be set to sign OAuth state"
    );
  }
  return value;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function createOAuthState(userId: string): string {
  const payload: StatePayload = {
    uid: userId,
    iat: Date.now(),
    n: randomBytes(8).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  return `${body}.${sign(body)}`;
}

/**
 * Returns the user id the state was minted for, or `null` if it is malformed,
 * unsigned, signed with a different secret, or older than {@link TTL_MS}.
 */
export function verifyOAuthState(state: string): { userId: string } | null {
  const [body, signature] = state.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body), "utf8");
  const provided = Buffer.from(signature, "utf8");
  // timingSafeEqual throws on a length mismatch, which is itself a rejection.
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as StatePayload;
    if (typeof payload.uid !== "string" || typeof payload.iat !== "number") {
      return null;
    }
    if (Date.now() - payload.iat > TTL_MS) return null;
    return { userId: payload.uid };
  } catch {
    return null;
  }
}
