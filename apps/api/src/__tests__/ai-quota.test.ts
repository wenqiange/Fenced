import { test } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";
import { checkAiQuota, enforceAiQuota, _resetAiQuotaStoreForTesting } from "../ai-quota";

test("allows requests under the daily limit", async () => {
    _resetAiQuotaStoreForTesting();
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
        const result = await checkAiQuota("user-a", 30, now);
        assert.equal(result.allowed, true);
    }
});

test("blocks once the daily limit is exceeded, keyed per user", async () => {
    _resetAiQuotaStoreForTesting();
    const now = 2_000_000;
    for (let i = 0; i < 3; i++) {
        await checkAiQuota("user-b", 3, now);
    }
    const fourth = await checkAiQuota("user-b", 3, now);
    assert.equal(fourth.allowed, false);
    assert.equal(fourth.remaining, 0);

    // A different user is not affected by user-b's usage.
    const otherUser = await checkAiQuota("user-c", 3, now);
    assert.equal(otherUser.allowed, true);
});

test("enforceAiQuota throws TOO_MANY_REQUESTS once exhausted", async () => {
    _resetAiQuotaStoreForTesting();
    const now = 3_000_000;
    for (let i = 0; i < 2; i++) {
        await enforceAiQuota("user-d", 2, now);
    }
    await assert.rejects(
        () => enforceAiQuota("user-d", 2, now),
        (err: unknown) => {
            assert.ok(err instanceof TRPCError);
            assert.equal(err.code, "TOO_MANY_REQUESTS");
            return true;
        },
    );
});

test("quota resets after the 24h window elapses", async () => {
    _resetAiQuotaStoreForTesting();
    const day = 24 * 60 * 60 * 1000;
    const start = 4_000_000;
    for (let i = 0; i < 2; i++) {
        await checkAiQuota("user-e", 2, start);
    }
    const stillBlocked = await checkAiQuota("user-e", 2, start + 1000);
    assert.equal(stillBlocked.allowed, false);

    const afterWindow = await checkAiQuota("user-e", 2, start + day + 1);
    assert.equal(afterWindow.allowed, true);
});
