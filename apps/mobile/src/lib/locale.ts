import type { DateLocale } from "@fenced/nlp";

/**
 * Best-effort mapping from the device's locale to the NLP parser's date
 * locale. Defaults to "en" (US month/day reading) on any detection failure
 * or unsupported language, preserving existing behaviour for everyone else.
 */
export function getNlpDateLocale(): DateLocale {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Localization = require("expo-localization");
        const tag: string | undefined =
            Localization.getLocales?.()[0]?.languageCode ?? Localization.locale?.split(/[-_]/)[0];
        if (tag === "ca") return "ca";
        if (tag === "es") return "es";
    } catch {
        /* expo-localization unavailable (e.g. in a non-Expo test environment) */
    }
    return "en";
}
