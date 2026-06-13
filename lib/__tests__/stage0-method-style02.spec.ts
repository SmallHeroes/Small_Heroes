import { describe, expect, it } from 'vitest';

import { assertPipelineStyleBranchMatchesOrder } from '../image-engine-guard';
import {
  buildStage0Style02Prompt,
  buildStage0Style02References,
} from '../generation-pipeline/stage0-method-style02';
import { STYLE_02_CHILD_PHOTO_IDENTITY_RULE } from '../style02-gptimage';

describe('stage0-method-style02', () => {
  it('buildStage0Style02References uses Style 02 refs only + photo last', () => {
    const { paths, labels } = buildStage0Style02References({
      childPhotoUrl: '/uploads/child.jpg',
    });
    expect(labels).toEqual(['style02_ref_1', 'style02_ref_2', 'raw_child_photo']);
    expect(paths[paths.length - 1]).toBe('/uploads/child.jpg');
    expect(labels.some((l) => l.includes('style01'))).toBe(false);
    expect(labels.some((l) => l.includes('template'))).toBe(false);
  });

  it('buildStage0Style02Prompt includes identity-only photo rule and wardrobe', () => {
    const prompt = buildStage0Style02Prompt({
      order: { childGender: 'girl', childAge: 5 },
      lockedChildDescription: 'Noa, girl age 5',
      wardrobeLock: 'BOOK WARDROBE LOCK: red pajamas',
      childPhotoDescription: 'curly brown hair, warm skin',
    });
    expect(prompt).toContain('Style 02');
    expect(prompt).toContain(STYLE_02_CHILD_PHOTO_IDENTITY_RULE);
    expect(prompt).toContain('red pajamas');
    expect(prompt).not.toContain('Style 01 watercolor');
  });

  it('Method-B guard rejects Style 02 orders at stage0-method-b (unchanged)', async () => {
    const { generateStage0MethodBAnchor } = await import('../generation-pipeline/stage0-method-b');
    await expect(
      generateStage0MethodBAnchor({
        order: {
          id: 'ord-test',
          illustrationStyle: 'detailed_whimsical_world',
          childGender: 'girl',
          childAge: 5,
        } as import('@prisma/client').Order,
        childPhotoUrl: '/photo.jpg',
        lockedChildDescription: 'test child',
      })
    ).rejects.toThrow(/style mismatch/);
  });

  it('Style02 stage0 branch guard rejects Style 01 orders', () => {
    expect(() =>
      assertPipelineStyleBranchMatchesOrder({
        orderIllustrationStyle: 'soft_hand_drawn_storybook',
        pipelineStyleBranch: 'style02',
        context: 'test',
      })
    ).toThrow(/style mismatch/);
  });
});
