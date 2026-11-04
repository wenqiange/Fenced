import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { app } from "../app";

test("VPC Webhook - rejects request when VPC_WEBHOOK_SECRET is unset", async () => {
  const origSecret = process.env.VPC_WEBHOOK_SECRET;
  delete process.env.VPC_WEBHOOK_SECRET;
  try {
    const res = await app.request("/webhooks/vpc", {
      method: "POST",
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 503);
    const data = (await res.json()) as { error?: string };
    assert.equal(data.error, "VPC_WEBHOOK_SECRET is not configured on this server");
  } finally {
    if (origSecret) process.env.VPC_WEBHOOK_SECRET = origSecret;
  }
});

test("VPC Webhook - rejects request with missing or invalid signature", async () => {
  process.env.VPC_WEBHOOK_SECRET = "test-vpc-secret-key-123";
  const body = JSON.stringify({ event: "consent.granted" });

  // Missing header
  const resNoSig = await app.request("/webhooks/vpc", {
    method: "POST",
    body,
  });
  assert.equal(resNoSig.status, 401);

  // Wrong signature
  const resBadSig = await app.request("/webhooks/vpc", {
    method: "POST",
    headers: { "x-vpc-signature": "sha256=badbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadbadb" },
    body,
  });
  assert.equal(resBadSig.status, 401);
});

test("VPC Webhook - rejects request with invalid body payload", async () => {
  process.env.VPC_WEBHOOK_SECRET = "test-vpc-secret-key-123";
  const body = JSON.stringify({ event: "unknown.event" });
  const sig = crypto.createHmac("sha256", "test-vpc-secret-key-123").update(body).digest("hex");

  const res = await app.request("/webhooks/vpc", {
    method: "POST",
    headers: { "x-vpc-signature": `sha256=${sig}` },
    body,
  });
  assert.equal(res.status, 400);
});

test("VPC Webhook - rejects request with expired timestamp (> 5m)", async () => {
  process.env.VPC_WEBHOOK_SECRET = "test-vpc-secret-key-123";
  const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  const body = JSON.stringify({
    event: "consent.granted",
    userId: "11111111-1111-1111-1111-111111111111",
    vendorRef: "test-ref-expired-1",
    guardianEmail: "guardian@example.com",
    timestamp: sixMinutesAgo,
  });
  const sig = crypto.createHmac("sha256", "test-vpc-secret-key-123").update(body).digest("hex");

  const res = await app.request("/webhooks/vpc", {
    method: "POST",
    headers: { "x-vpc-signature": `sha256=${sig}` },
    body,
  });
  assert.equal(res.status, 400);
  const data = (await res.json()) as { error?: string };
  assert.match(data.error ?? "", /timestamp expired/i);
});
