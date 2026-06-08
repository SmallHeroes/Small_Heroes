/**
 * Anchored broken-form regexes — match malformed standalone tokens only.
 * Substring patterns (e.g. מהנה inside מהנהנת) are false positives; use negative lookahead.
 */

/** מַהְנֵה / standalone מהנה — NOT מהנהן / מהנהנת / מהנהנים / מהנהנות */
export const RE_BROKEN_MAHNEH = /מַהְנֵה|מהנה(?![נן])/;

/**
 * Truncated מצטמצ (B2 defect, no final ם) — NOT מצטמצם / מצטמצמת / מצטמצמים.
 * מצטמת alone (missing צם) is also truncated.
 */
export const RE_BROKEN_MITZTAMETS =
  /מִצְטָמֵצ|מצטמ[ץצ](?!ם|מ)|מצטמת(?!ם|מ)/;

/** Invented nonce forms for מציץ (B2 family) */
export const RE_BROKEN_METSITS = /מצציץ|מצמיץ|מצטץ/;

/** Non-word חולש (likely חולשה) */
export const RE_BROKEN_HOLES = /בתוך החולש|בְּתוֹךְ הַחוֹלֵשׁ|הַחוֹלֵשׁ/;

/** Non-word קיצקש */
export const RE_BROKEN_KITZKASH = /קִצְקָשׁ|קיצקש/;
