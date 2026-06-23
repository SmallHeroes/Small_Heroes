import { describe, expect, it } from 'vitest';

import { storytimeNoAudioDwellMs } from '../../app/book/[id]/read-v2/reader-v2';

describe('storytimeNoAudioDwellMs', () => {
  it('enforces a 4s minimum dwell', () => {
    expect(storytimeNoAudioDwellMs('')).toBe(4000);
    expect(storytimeNoAudioDwellMs('שלום')).toBe(4000);
  });

  it('scales with word count beyond the minimum', () => {
    const words = Array.from({ length: 20 }, () => 'מילה').join(' ');
    expect(storytimeNoAudioDwellMs(words)).toBe(8000);
  });
});
