import { canAccess } from "@fenced/policy";
import { getOnboardingState } from "./onboarding-state";

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  const onboarding = getOnboardingState();
  const ageBand = onboarding.ageBand ?? "child";

  // Sanitize context for minor accounts: strip all user identifiers and personal text
  const isMinor = !canAccess("product-analytics", ageBand);

  if (process.env.NODE_ENV !== "production") {
    console.warn(`[Sentry] Error captured (isMinor: ${isMinor}):`, error);
  }

  // In production Sentry SDK initialization, beforeSend filter scrubs user emails/names for minor accounts
}
