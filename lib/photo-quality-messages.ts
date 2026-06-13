/**
 * Friendly Hebrew messages for photo-quality reason codes.
 * PhotoGuidance — respectful, non-accusatory tone; parent is always in control.
 */

const MSG_MULTIPLE_FACES =
  'יש בתמונה כמה פנים בולטות — אם תרצו, תמונה שבה הילד/ה במרכז יכולה לעזור. אפשר גם להמשיך כמו שזה.';
const MSG_NO_FACE =
  'ייתכן שהתמונה פחות אידיאלית — אפשר להמשיך, להחליף תמונה, או להמשיך בלי תמונה.';
const MSG_FACE_TOO_SMALL =
  'הפנים קטנות יחסית — תמונה מקרוב יותר יכולה לעזור לדיוק, אבל אפשר להמשיך גם ככה.';
const MSG_FACE_SMALLISH =
  'התמונה תעבוד! אם תרצו דמות עוד יותר מדויקת, תמונה קצת יותר קרובה יכולה לעזור — או פשוט להמשיך.';
const MSG_BLURRY =
  'התמונה תעבוד! אם תרצו דמות עוד יותר מדויקת, תמונה חדה יותר יכולה לעזור — או פשוט להמשיך.';
const MSG_DARK =
  'התאורה כהה יחסית — אם יש תמונה עם יותר אור, היא יכולה לעזור. אפשר גם להמשיך עם התמונה הזו.';
const MSG_LIGHTING =
  'התאורה לא אידיאלית — תמונה עם אור נעים יכולה לעזור, אבל אפשר להמשיך גם ככה.';
const MSG_GENERIC =
  'התמונה תעבוד! אם תרצו, אפשר להחליף לתמונה אחרת — או פשוט להמשיך.';

const REASON_PRIORITY: Array<{ codes: string[]; message: string }> = [
  { codes: ['multiple_faces_no_dominant', 'face_count_not_exactly_one'], message: MSG_MULTIPLE_FACES },
  { codes: ['no_face_detected'], message: MSG_NO_FACE },
  { codes: ['face_too_small_critical', 'face_area_too_small', 'face_too_small'], message: MSG_FACE_TOO_SMALL },
  { codes: ['face_borderline_size'], message: MSG_FACE_SMALLISH },
  { codes: ['low_sharpness', 'sharpness_too_low'], message: MSG_BLURRY },
  { codes: ['low_brightness'], message: MSG_DARK },
  { codes: ['brightness_out_of_range'], message: MSG_LIGHTING },
];

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
