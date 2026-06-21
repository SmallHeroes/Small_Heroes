import { describe, expect, it } from 'vitest';

import { childPhotoUploadErrorHe, CHILD_PHOTO_TOO_LARGE_HE } from '../child-photo-client';

describe('child-photo-client', () => {
  it('maps compression failure to Hebrew', () => {
    expect(
      childPhotoUploadErrorHe(new Error('Child photo is still too large after compression.'))
    ).toBe(CHILD_PHOTO_TOO_LARGE_HE);
  });

  it('maps read failure to Hebrew', () => {
    expect(childPhotoUploadErrorHe(new Error('Could not read photo file'))).toMatch(/לא הצלחנו/);
  });
});
