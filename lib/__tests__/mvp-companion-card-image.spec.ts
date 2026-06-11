import { existsSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { MVP_STORY_MATRIX } from '../../backend/config/mvp-story-matrix';
import { getCompanionById } from '../companions';

describe('MVP companion cardImage', () => {
  it('points each matrix companion at an existing public style01 sheet file', () => {
    const categories = Object.keys(MVP_STORY_MATRIX) as (keyof typeof MVP_STORY_MATRIX)[];
    expect(categories).toHaveLength(6);

    for (const category of categories) {
      const companionId = MVP_STORY_MATRIX[category].companionId;
      const companion = getCompanionById(companionId);
      expect(companion, companionId).not.toBeNull();
      expect(companion!.cardImage, `${companionId}.cardImage`).toBeTruthy();

      const rel = companion!.cardImage!.replace(/^\//, '');
      const abs = join(process.cwd(), 'public', rel);
      expect(existsSync(abs), abs).toBe(true);
    }
  });
});
