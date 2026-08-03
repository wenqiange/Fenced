import { canAccess } from "@fenced/policy";
import type { AgeBand } from "@fenced/core";
import { getOnboardingState } from "./onboarding-state";

/** Client-side UI gate only — server still enforces. Default-deny if band unknown. */
export function canUseLlmUi(
  feature:
    | "llm-parsing"
    | "llm-replan-advice"
    | "llm-weekly-coach"
    | "llm-planning-chat" = "llm-parsing",
): boolean {
  const band = (getOnboardingState().ageBand ?? "child") as AgeBand;
  return canAccess(feature, band);
}
