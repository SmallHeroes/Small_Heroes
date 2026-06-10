/**
 * Parent-facing Hebrew messages for PhotoGate / photo-analyze reason codes.
 * Both code families (upload analyzer + checkout gate) must map to friendly Hebrew.
 */
import { describe, expect, it } from 'vitest';
import { hebrewPhotoMessage } from '../photo-quality-messages';

const MSG_MULTI =
  'יש בתמונה כמה פנים בולטות ולא ברור מי הגיבור/ה — צריך תמונה שבה הילד/ה במרכז וברור.';

describe('hebrewPhotoMessage', () => {
  it('multiple_faces_no_dominant (the only multi-face code the gates emit) → dominant-face message', () => {
    expect(hebrewPhotoMessage(['multiple_faces_no_dominant'])).toBe(MSG_MULTI);
  });

  it('legacy face_count_not_exactly_one (old stored wizard states) maps to the same message', () => {
    expect(hebrewPhotoMessage(['face_count_not_exactly_one'], { faceCount: 3 })).toBe(MSG_MULTI);
  });

  it('legacy face_count_not_exactly_one with zero faces → no-face message, not multi-face', () => {
    expect(hebrewPhotoMessage(['face_count_not_exactly_one'], { faceCount: 0 })).toBe(
      'לא זוהו פנים בתמונה — נסו תמונה ברורה של הפנים.'
    );
  });

  it('no_face_detected → no-face message', () => {
    expect(hebrewPhotoMessage(['no_face_detected'])).toBe(
      'לא זוהו פנים בתמונה — נסו תמונה ברורה של הפנים.'
    );
  });

  it('blur and darkness codes → matching friendly Hebrew', () => {
    expect(hebrewPhotoMessage(['sharpness_too_low'])).toBe('התמונה מטושטשת — נסו תמונה חדה יותר.');
    expect(hebrewPhotoMessage(['low_sharpness'])).toBe('התמונה מטושטשת — נסו תמונה חדה יותר.');
    expect(hebrewPhotoMessage(['low_brightness'])).toBe('התמונה כהה מדי — נסו תמונה עם יותר אור.');
  });

  it('face-count problems outrank blur (most actionable first)', () => {
    expect(hebrewPhotoMessage(['low_sharpness', 'multiple_faces_no_dominant'])).toBe(MSG_MULTI);
  });

  it('no codes → null (nothing to show)', () => {
    expect(hebrewPhotoMessage([])).toBeNull();
    expect(hebrewPhotoMessage(undefined)).toBeNull();
  });

  it('unknown codes → generic Hebrew fallback, never English', () => {
    const message = hebrewPhotoMessage(['some_future_code']);
    expect(message).toBeTruthy();
    expect(message).toMatch(/[\u0590-\u05FF]/);
  });
});
