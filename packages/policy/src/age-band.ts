import type { AgeBand } from "@fenced/core";

const CONSENT_AGE_BY_COUNTRY: Record<string, number> = {
  US: 13, // COPPA
  GB: 13,
  BE: 13, CZ: 15, DK: 13, EE: 13, FI: 13, LV: 13, PL: 13, PT: 13, SE: 13,
  AT: 14, BG: 14, CY: 14, IT: 14, LT: 14, ES: 14,
  FR: 15, GR: 15, SI: 15,
  DE: 16, HR: 16, HU: 16, IE: 16, LU: 16, MT: 16, NL: 16, RO: 16, SK: 16,
};

const DEFAULT_CONSENT_AGE = 16;

export function getConsentAge(jurisdiction: string): number {
  return CONSENT_AGE_BY_COUNTRY[jurisdiction.toUpperCase()] ?? DEFAULT_CONSENT_AGE;
}

export function resolveAgeBand(ageInYears: number, jurisdiction: string): AgeBand {
  if (ageInYears < 13) return "child";
  const consentAge = getConsentAge(jurisdiction);
  if (ageInYears < consentAge) return "teen";
  return "adult";
}

export function childrensCodeApplies(ageInYears: number, jurisdiction: string): boolean {
  if (jurisdiction.toUpperCase() === "GB") return ageInYears < 18;
  return ageInYears < getConsentAge(jurisdiction);
}
