import { describe, expect, it } from 'vitest';
import { READER_FIT_FRAMING_VERSION as v2, READER_SAFE_FRAMING_VERSION as v1,
  readerSafeSceneFraming, readerSafeSceneFramingPrompt } from '../storybook-scene-framing';
import { auditionJudgeInstruction } from '../personal-wizard/simple-book-reviewed-audition';
import { reviewedBookLayoutSchema, LEGACY_BOOK_LAYOUT } from '../../scripts/personal-simple-book-reviewed-audition';

describe('prospective smaller cast / complete-artwork framing v2', () => {
  it.each([['wide', .3], ['medium', .4], ['close', .5]] as const)('binds a smaller %s camera target, not a new visual gate', (shot, target) => {
    const f = readerSafeSceneFraming(v2, shot, .9);
    expect(f.targetChildHeightFraction).toBe(target);
    expect(f.maximumVisibleActorHeightFraction).toBe(.55);
    expect(f.profile).toBe('complete_source_contain_reader');
    expect(f.safeActionRect).toEqual({ left: .08, top: .08, right: .92, bottom: .92 });
    expect(f.ratioDeviationImpact).toBe('detail');
    expect(f.targetChildHeightFraction).toBeLessThan(readerSafeSceneFraming(v1, shot, .9).targetChildHeightFraction);
    expect(readerSafeSceneFraming(v2, shot, .18).targetChildHeightFraction).toBe(.18);
    expect(readerSafeSceneFramingPrompt(f)).toContain('Pull the CAMERA BACK');
    expect(readerSafeSceneFramingPrompt(f)).toContain('never shrink only the companion');
    const judge = auditionJudgeInstruction('page', { packet: { readerFraming: f } });
    expect(judge).toContain('55%');
    expect(judge).not.toContain('70% ceiling');
    expect(judge).toContain('detail');
  });
  it('is an explicit native-layout opt-in, never a reinterpretation of consumed v1 evidence', () => {
    expect(reviewedBookLayoutSchema.parse({ ...LEGACY_BOOK_LAYOUT, readerFraming: v2 }).readerFraming).toBe(v2);
    expect(reviewedBookLayoutSchema.parse(LEGACY_BOOK_LAYOUT)).not.toHaveProperty('readerFraming');
    expect(readerSafeSceneFraming(v1, 'medium', .8)).toEqual({ version: v1, scope: 'cover_and_body_scenes_only',
      profile: 'square_source_center_cover_tall_reader', shot: 'medium', authoredChildHeightFraction: .8,
      targetChildHeightFraction: .5, maximumVisibleActorHeightFraction: .7,
      safeActionRect: { left: .3, top: .1, right: .7, bottom: .9 }, sourcePlanUnchanged: true, ratioDeviationImpact: 'detail' });
    expect(readerSafeSceneFramingPrompt(readerSafeSceneFraming(v1, 'medium'))).toContain('70% ceiling is NOT the target');
  });
  it('rejects tampering with the new prospective target or visibility envelope', () => {
    for (const patch of [{ targetChildHeightFraction: .9 }, { maximumVisibleActorHeightFraction: .7 },
      { safeActionRect: { left: .3, top: .1, right: .7, bottom: .9 } }]) {
      const framing = { ...readerSafeSceneFraming(v2, 'medium'), ...patch };
      expect(() => auditionJudgeInstruction('page', { packet: { readerFraming: framing } })).toThrow('audition_reader_framing_contract');
    }
  });
});
