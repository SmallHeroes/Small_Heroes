import { describe, expect, it } from 'vitest';

import {
  buildStage0MethodBReferences,
  buildStage0MethodBPrompt,
  sanitizeStage0AnchorIdentityText,
  type Stage0MethodBReferenceLayout,
} from '../generation-pipeline/stage0-method-b';
import {
  LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION,
  LION_BEDTIME_BAR_LOCKED_CHILD_DESCRIPTION,
} from '../generation-pipeline/stage0-resemblance-experiment';

describe('Stage0 Method B reference layouts (Brief F)', () => {
  const photo = '/tmp/bar.jpg';

  it('production default is photo + style refs only (no boy.png template)', () => {
    const refs = buildStage0MethodBReferences({
      childPhotoUrl: photo,
      childGender: 'boy',
    });
    expect(refs.layout).toBe('photo_only_no_template');
    expect(refs.referenceMode).toBe('anchor_photo_style_only');
    expect(refs.labels[0]).toBe('raw_child_photo');
    expect(refs.labels.join(' ')).not.toContain('style01_child_template');
    expect(refs.paths[0]).toBe(photo);
    expect(refs.paths.some((p) => p.endsWith('boy.png'))).toBe(false);
  });

  it('legacy template_first_photo_last layout still available', () => {
    const refs = buildStage0MethodBReferences({
      childPhotoUrl: photo,
      childGender: 'boy',
      layout: 'template_first_photo_last',
    });
    expect(refs.layout).toBe('template_first_photo_last');
    expect(refs.referenceMode).toBe('anchor_template_photo_last');
    expect(refs.labels[0]).toBe('style01_child_template');
    expect(refs.labels[refs.labels.length - 1]).toBe('raw_child_photo');
  });

  it('photo_first_with_template puts raw photo first (variant A)', () => {
    const refs = buildStage0MethodBReferences({
      childPhotoUrl: photo,
      childGender: 'boy',
      layout: 'photo_first_with_template',
    });
    expect(refs.referenceMode).toBe('anchor_photo_template_middle');
    expect(refs.labels[0]).toBe('raw_child_photo');
    expect(refs.labels[1]).toBe('style01_child_template');
    expect(refs.paths[0]).toBe(photo);
  });

  it('photo_only_no_template drops boy.png (variant B)', () => {
    const refs = buildStage0MethodBReferences({
      childPhotoUrl: photo,
      childGender: 'boy',
      layout: 'photo_only_no_template',
    });
    expect(refs.referenceMode).toBe('anchor_photo_style_only');
    expect(refs.labels[0]).toBe('raw_child_photo');
    expect(refs.labels.join(' ')).not.toContain('style01_child_template');
    expect(refs.paths[0]).toBe(photo);
    expect(refs.paths.some((p) => p.endsWith('boy.png'))).toBe(false);
  });

  it('Bar corrected identity has olive/tan skin — not pale, no toddler-pushing softness', () => {
    expect(LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION).toMatch(/olive/i);
    expect(LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION).toMatch(/NOT pale/i);
    expect(LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION).not.toMatch(/\bwarm pale\b/i);
    expect(LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION).not.toMatch(/young-child softness/i);
    expect(LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION).toMatch(/prominent cheeks/i);
    expect(LION_BEDTIME_BAR_CHILD_PHOTO_DESCRIPTION).toMatch(/round face/i);
    expect(LION_BEDTIME_BAR_LOCKED_CHILD_DESCRIPTION).not.toMatch(/t-shirt|denim|sneaker/i);
  });

  it('buildStage0MethodBPrompt enforces kindergarten-age 5 — not toddler, not 7–8', () => {
    const prompt = buildStage0MethodBPrompt({
      order: { childGender: 'boy', childAge: 5 },
      lockedChildDescription: 'Round face with prominent cheeks. Warm olive skin.',
    });
    expect(prompt).toMatch(/5-year-old kindergarten-age boy/i);
    expect(prompt).toMatch(/NOT a toddler/i);
    expect(prompt).toMatch(/NOT a baby/i);
    expect(prompt).toMatch(/Do NOT make him look 7–8 or older/i);
    expect(prompt).toMatch(/ANTI-TODDLER/i);
    expect(prompt).toMatch(/NOT baby cheeks/i);
    expect(prompt).not.toMatch(/MUST read clearly as a boy of about 5/i);
  });

  it('sanitizeStage0AnchorIdentityText strips toddler phrasing but keeps cheeks', () => {
    const cleaned = sanitizeStage0AnchorIdentityText(
      'Round face with prominent cheeks and young-child softness. Large eyes.'
    );
    expect(cleaned).not.toMatch(/young-child softness/i);
    expect(cleaned).toMatch(/prominent cheeks/i);
    expect(cleaned).toMatch(/Round face/i);
  });
});
