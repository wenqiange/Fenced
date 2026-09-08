import { TRPCError } from "@trpc/server";
import type { AgeBand } from "@fenced/core";
import { canAccess, type Feature } from "@fenced/policy";

/** Narrows the context's free-form band string to the domain type. */
export function ageBandFromCtx(ageBand: string | undefined): AgeBand | null {
  if (ageBand === "child" || ageBand === "teen" || ageBand === "adult") {
    return ageBand;
  }
  return null;
}

/**
 * Whether the caller's age band permits a feature.
 *
 * Fails closed on an unresolved band: not knowing how old someone is is not a
 * reason to treat them as an adult.
 */
export function featureAllowed(
  feature: Feature,
  ageBand: string | undefined
): boolean {
  const band = ageBandFromCtx(ageBand);
  if (!band) return false;
  return canAccess(feature, band);
}

/**
 * Server-side enforcement of an age-banded feature.
 *
 * The client hides restricted features too, but this is the boundary that
 * actually holds — a hidden button is a UI convenience, not a control.
 */
export function requireFeature(
  feature: Feature,
  ageBand: string | undefined,
  message: string
): void {
  if (!featureAllowed(feature, ageBand)) {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }
}
