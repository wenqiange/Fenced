import { TRPCError } from "@trpc/server";
import { MemoryRateLimitStore } from "./rate-limit";

/**
 * Per-user daily cap on AI provider calls.
 *
 * The generic `/trpc/*` IP-based rate limiter (100 req/min) is far too
 * permissive to serve as a cost control for LLM calls: it limits burst rate,
 * not daily spend, and is keyed by IP rather than account. This is a second,
 * narrower limiter keyed by `userId` with a 24h rolling window, applied only
 * to AI endpoints.
 */
const DEFAULT_DAILY_LIMIT = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

let store = new MemoryRateLimitStore();

/** Test-only: swap in a fresh store so tests do not leak counters between runs. */
export function _resetAiQuotaStoreForTesting(): void {
    store = new MemoryRateLimitStore();
}

export interface AiQuotaCheck {
    allowed: boolean;
    remaining: number;
    limit: number;
    resetAt: number;
}

/**
 * Records one AI call for `userId` and reports whether it was within quota.
 * Call this once per AI provider invocation attempt, before making the call.
 */
export async function checkAiQuota(
    userId: string,
    limit: number = DEFAULT_DAILY_LIMIT,
    now: number = Date.now(),
): Promise<AiQuotaCheck> {
    const hit = await store.hit(`ai-daily:${userId}`, DAY_MS, now);
    return {
        allowed: hit.count <= limit,
        remaining: Math.max(0, limit - hit.count),
        limit,
        resetAt: hit.resetAt,
    };
}

/** Throws a tRPC-shaped error when the daily AI quota is exhausted. */
export async function enforceAiQuota(
    userId: string,
    limit: number = DEFAULT_DAILY_LIMIT,
    now: number = Date.now(),
): Promise<void> {
    const result = await checkAiQuota(userId, limit, now);
    if (!result.allowed) {
        const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - now) / 1000));
        throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Daily AI request limit reached (${result.limit}/day). Try again in ${Math.ceil(retryAfterSeconds / 3600)}h.`,
        });
    }
}
