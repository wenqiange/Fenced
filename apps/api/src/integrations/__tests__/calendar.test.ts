import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const KEY = randomBytes(32).toString("base64");
process.env.CALENDAR_TOKEN_KEY = KEY;
process.env.CALENDAR_OAUTH_STATE_SECRET = "test-state-secret";

const {
  encryptToken,
  decryptToken,
  decryptOptional,
  isTokenCryptoConfigured,
  resetTokenCryptoCache,
} = await import("../token-crypto");
const { createOAuthState, verifyOAuthState } = await import("../oauth-state");
const { timingFromGoogle, timingToGoogle } = await import("../calendar-sync");

describe("token-crypto", () => {
  beforeEach(() => {
    process.env.CALENDAR_TOKEN_KEY = KEY;
    resetTokenCryptoCache();
  });

  it("round-trips a token", () => {
    const secret = "1//0abcdefgHIJKLMNOP_refresh-token";
    assert.equal(decryptToken(encryptToken(secret)), secret);
  });

  it("produces a different ciphertext each time", () => {
    // A fresh IV per call: identical tokens must not be linkable in the table.
    const a = encryptToken("same");
    const b = encryptToken("same");
    assert.notEqual(a, b);
    assert.equal(decryptToken(a), decryptToken(b));
  });

  it("emits the versioned four-part envelope", () => {
    const parts = encryptToken("x").split(":");
    assert.equal(parts.length, 4);
    assert.equal(parts[0], "v1");
  });

  it("rejects a tampered ciphertext", () => {
    const payload = encryptToken("sensitive");
    const parts = payload.split(":");
    const bytes = Buffer.from(parts[3], "base64");
    bytes[0] ^= 0xff;
    parts[3] = bytes.toString("base64");
    assert.throws(() => decryptToken(parts.join(":")));
  });

  it("rejects a swapped authentication tag", () => {
    const a = encryptToken("first");
    const b = encryptToken("second");
    const [, ivA, , ctA] = a.split(":");
    const [, , tagB] = b.split(":");
    assert.throws(() => decryptToken(["v1", ivA, tagB, ctA].join(":")));
  });

  it("rejects a payload sealed with a different key", () => {
    const payload = encryptToken("secret");
    process.env.CALENDAR_TOKEN_KEY = randomBytes(32).toString("base64");
    resetTokenCryptoCache();
    assert.throws(() => decryptToken(payload));
  });

  it("rejects an unknown envelope version", () => {
    const payload = encryptToken("secret").replace(/^v1:/, "v9:");
    assert.throws(() => decryptToken(payload), /Unrecognised/);
  });

  it("rejects a key of the wrong length", () => {
    process.env.CALENDAR_TOKEN_KEY = randomBytes(16).toString("base64");
    resetTokenCryptoCache();
    assert.throws(() => encryptToken("x"), /32 bytes/);
  });

  it("accepts a hex-encoded key", () => {
    process.env.CALENDAR_TOKEN_KEY = randomBytes(32).toString("hex");
    resetTokenCryptoCache();
    assert.equal(decryptToken(encryptToken("hexy")), "hexy");
  });

  it("reports missing configuration instead of throwing", () => {
    delete process.env.CALENDAR_TOKEN_KEY;
    resetTokenCryptoCache();
    assert.equal(isTokenCryptoConfigured(), false);
    // A misconfigured server must fail loudly at the point of storing a token.
    assert.throws(() => encryptToken("x"), /CALENDAR_TOKEN_KEY is not set/);
  });

  it("passes null through decryptOptional", () => {
    assert.equal(decryptOptional(null), null);
    assert.equal(decryptOptional(encryptToken("v")), "v");
  });
});

describe("oauth-state", () => {
  it("round-trips the user id", () => {
    const userId = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    assert.deepEqual(verifyOAuthState(createOAuthState(userId)), { userId });
  });

  it("mints a distinct state each time", () => {
    const userId = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    assert.notEqual(createOAuthState(userId), createOAuthState(userId));
  });

  it("rejects a forged payload", () => {
    // The attack this defends against: swapping in someone else's user id.
    const body = Buffer.from(
      JSON.stringify({ uid: "victim", iat: Date.now(), n: "x" })
    ).toString("base64url");
    assert.equal(verifyOAuthState(`${body}.not-a-real-signature`), null);
  });

  it("rejects a state signed with a different secret", () => {
    const state = createOAuthState("user-1");
    process.env.CALENDAR_OAUTH_STATE_SECRET = "rotated-secret";
    assert.equal(verifyOAuthState(state), null);
    process.env.CALENDAR_OAUTH_STATE_SECRET = "test-state-secret";
  });

  it("rejects malformed input", () => {
    assert.equal(verifyOAuthState(""), null);
    assert.equal(verifyOAuthState("no-dot"), null);
    assert.equal(verifyOAuthState("."), null);
  });

  it("rejects an expired state", () => {
    const realNow = Date.now;
    try {
      // Mint at T-11 minutes; the TTL is 10.
      Date.now = () => realNow() - 11 * 60 * 1000;
      const state = createOAuthState("user-1");
      Date.now = realNow;
      assert.equal(verifyOAuthState(state), null);
    } finally {
      Date.now = realNow;
    }
  });
});

describe("Google timing conversion", () => {
  it("reads a timed event as an instant", () => {
    const timing = timingFromGoogle({
      id: "e1",
      start: { dateTime: "2026-09-08T14:00:00Z" },
      end: { dateTime: "2026-09-08T15:00:00Z" },
    });
    assert.equal(timing?.allDay, false);
    assert.equal(timing?.startAt.toISOString(), "2026-09-08T14:00:00.000Z");
  });

  it("reads an all-day event, keeping Google's exclusive end", () => {
    const timing = timingFromGoogle({
      id: "e2",
      start: { date: "2026-09-08" },
      end: { date: "2026-09-09" },
    });
    assert.equal(timing?.allDay, true);
    assert.equal(timing?.endAt.toISOString(), "2026-09-09T00:00:00.000Z");
  });

  it("returns null for an event with no usable bounds", () => {
    assert.equal(timingFromGoogle({ id: "e3" }), null);
    assert.equal(timingFromGoogle({ id: "e4", start: { date: "2026-09-08" } }), null);
    assert.equal(
      timingFromGoogle({
        id: "e5",
        start: { dateTime: "not-a-date" },
        end: { dateTime: "also-not" },
      }),
      null
    );
  });

  it("writes a timed event as ISO instants", () => {
    const out = timingToGoogle({
      allDay: false,
      startAt: new Date("2026-09-08T14:00:00Z"),
      endAt: new Date("2026-09-08T15:00:00Z"),
    });
    assert.deepEqual(out, {
      start: { dateTime: "2026-09-08T14:00:00.000Z" },
      end: { dateTime: "2026-09-08T15:00:00.000Z" },
    });
  });

  it("forces an exclusive end for a same-day all-day event", () => {
    // Google rejects an all-day event whose end is not after its start.
    const out = timingToGoogle({
      allDay: true,
      startAt: new Date("2026-09-08T00:00:00Z"),
      endAt: new Date("2026-09-08T00:00:00Z"),
    });
    assert.deepEqual(out, {
      start: { date: "2026-09-08" },
      end: { date: "2026-09-09" },
    });
  });

  it("rolls the forced end over a month boundary", () => {
    const out = timingToGoogle({
      allDay: true,
      startAt: new Date("2026-09-30T00:00:00Z"),
      endAt: new Date("2026-09-30T00:00:00Z"),
    });
    assert.deepEqual(out.end, { date: "2026-10-01" });
  });

  it("keeps a multi-day all-day range as given", () => {
    const out = timingToGoogle({
      allDay: true,
      startAt: new Date("2026-09-08T00:00:00Z"),
      endAt: new Date("2026-09-11T00:00:00Z"),
    });
    assert.deepEqual(out, {
      start: { date: "2026-09-08" },
      end: { date: "2026-09-11" },
    });
  });
});
