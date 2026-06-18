import { describe, expect, it } from 'vitest';

import { shouldUseGenericNightStoryWardrobe } from '../style01-story-wardrobe';
import { evaluateEntityQaFromRaw } from '../generation-pipeline/page-entity-qa';

describe('scene-time-aware wardrobe gate', () => {
  it('a _bedtime story defaults to night when page time-of-day is untagged', () => {
    expect(shouldUseGenericNightStoryWardrobe({}, 'panda_anat_bedtime')).toBe(true);
  });

  it('an explicit DAY page wins (day clothes) even inside a bedtime story', () => {
    expect(
      shouldUseGenericNightStoryWardrobe({ storyTimeOfDay: 'day' }, 'panda_anat_bedtime')
    ).toBe(false);
  });

  it('an explicit NIGHT page is night', () => {
    expect(
      shouldUseGenericNightStoryWardrobe({ storyTimeOfDay: 'night' }, 'fox_uri_fantasy')
    ).toBe(true);
  });

  it('a non-bedtime daytime story is not forced to night', () => {
    expect(shouldUseGenericNightStoryWardrobe({ storyTimeOfDay: 'day' }, 'koko_fantasy')).toBe(
      false
    );
  });
});

describe('entity QA crowd relaxation', () => {
  const crowdRaw = {
    singleChildOnly: false,
    duplicateChildCount: 5,
    companionPresentOk: true,
    companionSpeciesOk: true,
    companionIdentityOk: true,
    companionCount: 0,
    singleCompanionOnly: true,
  };

  it('hard-fails duplicate_child by default', () => {
    const r = evaluateEntityQaFromRaw({ expectsChild: true, expectsCompanion: false, raw: crowdRaw });
    expect(r.hardFailures).toContain('duplicate_child');
  });

  it('does NOT fail duplicate_child in a crowd scene (allowMultipleChildren)', () => {
    const r = evaluateEntityQaFromRaw({
      expectsChild: true,
      expectsCompanion: false,
      raw: crowdRaw,
      allowMultipleChildren: true,
    });
    expect(r.hardFailures).not.toContain('duplicate_child');
    expect(r.status).toBe('pass');
  });
});
