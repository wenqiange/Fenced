import { canAccess } from "@fenced/policy";
import { getOnboardingState } from "./onboarding-state";

export type EventName =
  | "onboarding_started"
  | "age_band_selected"
  | "intent_selected"
  | "categories_selected"
  | "permission_granted"
  | "session_started"
  | "session_completed"
  | "session_abandoned"
  | "task_created"
  | "task_completed"
  | "streak_updated";

class AnalyticsService {
  private isAllowed(): boolean {
    const onboarding = getOnboardingState();
    const ageBand = onboarding.ageBand ?? "child";
    return canAccess("product-analytics", ageBand);
  }

  track(event: EventName, properties?: Record<string, unknown>): void {
    if (!this.isAllowed()) {
      // Under-16 / minor accounts strictly suppress telemetry data per COPPA / Children's Code policy
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`[Analytics] Track event: ${event}`, properties ?? {});
    }

    // PostHog SDK tracking call lands here for adult accounts
  }

  identify(userId: string, traits?: Record<string, unknown>): void {
    if (!this.isAllowed()) return;
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Analytics] Identify user: ${userId}`, traits ?? {});
    }
  }

  screen(screenName: string): void {
    if (!this.isAllowed()) return;
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Analytics] View screen: ${screenName}`);
    }
  }
}

export const analytics = new AnalyticsService();
