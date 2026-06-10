/**
 * Friendly Hebrew messages for photo-quality reason codes.
 * Used by the upload-stage analyzer (/api/photo/analyze) and by the checkout
 * PhotoGate backstop — the parent always sees Hebrew, never raw gate codes.
 * Covers both code families: the analyze classifier (multiple_faces_no_dominant,
 * face_too_small…) and the checkout gate (face_count_not_exactly_one…).
 */

const MSG_MULTIPLE_FACES =
  'יש בתמונה כמה פנים בולטות ולא ברור מי הגיבור/ה — צריך תמונה שבה הילד/ה במרכז וברור.';
const MSG_NO_FACE = 'לא זוהו פנים בתמונה — נסו תמונה ברורה של הפנים.';
const MSG_FACE_TOO_SMALL = 'הפנים בתמונה קטנות מדי — נסו תמונה מקרוב יותר.';
const MSG_FACE_SMALLISH = 'הפנים בתמונה קטנות יחסית — תמונה מקרוב תיתן תוצאה מדויקת יותר.';
const MSG_BLURRY = 'התמונה מטושטשת — נסו תמונה חדה יותר.';
const MSG_DARK = 'התמונה כהה מדי — נסו תמונה עם יותר אור.';
const MSG_LIGHTING = 'התאורה בתמונה לא מתאימה — נסו תמונה עם אור טבעי ונעים.';
const MSG_GENERIC = 'קשה לנו לעבוד עם התמונה הזו — נסו תמונה ברורה של הפנים של הילד/ה.';

/** Ordered by what the parent should fix first.
 *  `face_count_not_exactly_one` is a LEGACY alias — the gates now emit only
 *  `multiple_faces_no_dominant` (dominant-face rule), but old wizard states
 *  persisted in localStorage may still carry the old code. */
const REASON_PRIORITY: Array<{ codes: string[]; message: string }> = [
  { codes: ['multiple_faces_no_dominant', 'face_count_not_exactly_one'], message: MSG_MULTIPLE_FACES },
  { codes: ['no_face_detected'], message: MSG_NO_FACE },
  { codes: ['face_too_small_critical', 'face_area_too_small'], message: MSG_FACE_TOO_SMALL },
  { codes: ['face_too_small', 'face_borderline_size'], message: MSG_FACE_SMALLISH },
  { codes: ['low_sharpness', 'sharpness_too_low'], message: MSG_BLURRY },
  { codes: ['low_brightness'], message: MSG_DARK },
  { codes: ['brightness_out_of_range'], message: MSG_LIGHTING },
];

/**
 * The single most actionable Hebrew message for a set of reason codes.
 * Returns null when there is nothing to tell the parent (no known codes).
 * The checkout gate reports `face_count_not_exactly_one` for BOTH zero and
 * multiple faces — pass faceCount so zero faces gets the right message.
 */
export function hebrewPhotoMessage(
  reasonCodes: string[] | null | undefined,
  context?: { faceCount?: number }
): string | null {
  if (!Array.isArray(reasonCodes) || reasonCodes.length === 0) return null;
  if (reasonCodes.includes('face_count_not_exactly_one') && context?.faceCount === 0) {
    return MSG_NO_FACE;
  }
  for (const entry of REASON_PRIORITY) {
    if (entry.codes.some((code) => reasonCodes.includes(code))) return entry.message;
  }
  return MSG_GENERIC;
}
