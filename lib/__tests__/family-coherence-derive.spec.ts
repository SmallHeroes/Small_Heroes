import { describe, expect, it } from 'vitest';
import {
  deriveFamilyCoherenceProfile,
  inferSkinToneBand,
} from '../family-coherence/derive';
import { buildBabySiblingVisualLock } from '../family-coherence/member-locks';
import {
  applyFamilyCoherenceToEntityLocks,
  buildFamilyCoherencePromptBlock,
} from '../family-coherence/prompt';
import { detectHumanFamilyRolesOnPage } from '../family-coherence/detect-roles';

describe('family coherence derive', () => {
  it('infers deep-warm band from photo description', () => {
    const band = inferSkinToneBand('deep brown skin warm smile curly black hair');
    expect(band).toBe('deep-warm');
  });

  it('baby lock forbids default pale-pink and uses profile band', () => {
    const profile = deriveFamilyCoherenceProfile({
      childPhotoDescription: 'deep brown skin, coily black hair, round face',
    });
    const lock = buildBabySiblingVisualLock(profile);
    expect(lock).toMatch(/FORBIDDEN: default pale-pink/i);
    expect(lock).not.toMatch(/Pinkish skin tone/i);
    expect(lock).toContain(profile.skinTonePrompt);
  });

  it('detects mother and baby on Dini page 2 staging', () => {
    const roles = detectHumanFamilyRolesOnPage({
      staging:
        'Child on tiptoe at crib. Mother beside holding bottle. Newborn baby sister in crib.',
      presentEntityIds: ['baby_sister', 'crib'],
    });
    expect(roles).toContain('mother');
    expect(roles).toContain('baby_sibling');
  });

  it('prompt block includes mother continuity on family pages', () => {
    const profile = deriveFamilyCoherenceProfile({
      childPhotoDescription: 'long curly dark brown hair, medium tan skin',
    });
    const bundle = {
      profile,
      memberLocks: { mother: 'SAME MOM LOCK', baby_sibling: buildBabySiblingVisualLock(profile) },
    };
    const block = buildFamilyCoherencePromptBlock(bundle, {
      staging: 'Mother and father in doorway, baby in crib',
      presentEntityIds: ['baby_sister'],
    });
    expect(block).toContain('FAMILY VISUAL COHERENCE');
    expect(block).toContain('SAME MOM LOCK');
  });

  it('replaces static baby_sister lock in entity locks', () => {
    const profile = deriveFamilyCoherenceProfile({
      childPhotoDescription: 'warm pale skin, straight blonde hair',
    });
    const bundle = {
      profile,
      memberLocks: { baby_sibling: buildBabySiblingVisualLock(profile) },
    };
    const staticLock = 'RECURRING ENTITY LOCK — BABY SISTER\nPinkish skin tone';
    const out = applyFamilyCoherenceToEntityLocks(staticLock, bundle, {
      presentEntityIds: ['baby_sister'],
    });
    expect(out).not.toContain('Pinkish skin tone');
    expect(out).toContain('family skin-tone band');
  });
});
