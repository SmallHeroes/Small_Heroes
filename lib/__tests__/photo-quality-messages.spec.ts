/**
 * Parent-facing Hebrew messages for PhotoGuidance reason codes.
 */
import { describe, expect, it } from 'vitest';
import { hebrewPhotoMessage } from '../photo-quality-messages';

describe('hebrewPhotoMessage', () => {
  it('no_face_detected → respectful advisory (not accusatory)', () => {
    const message = hebrewPhotoMessage(['no_face_detected']);
    expect(message).toMatch(/אפשר להמשיך/);
    expect(message).not.toMatch(/נדח|לא מספיק טוב|מטושטש/);
  });

  it('multiple_faces_no_dominant → respectful guidance', () => {
    const message = hebrewPhotoMessage(['multiple_faces_no_dominant']);
    expect(message).toMatch(/[\u0590-\u05FF]/);
    expect(message).toMatch(/אפשר/);
  });

  it('sharpness codes → encouraging tone', () => {
    const message = hebrewPhotoMessage(['sharpness_too_low']);
    expect(message).toMatch(/התמונה תעבוד/);
  });

  it('no codes → null', () => {
    expect(hebrewPhotoMessage([])).toBeNull();
    expect(hebrewPhotoMessage(undefined)).toBeNull();
  });

  it('unknown codes → generic encouraging Hebrew', () => {
    const message = hebrewPhotoMessage(['some_future_code']);
    expect(message).toMatch(/[\u0590-\u05FF]/);
    expect(message).toMatch(/המשיך|תעבוד/);
  });
});
