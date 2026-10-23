import { describe, expect, it } from 'vitest';
import { READER_SAFE_FRAMING_VERSION as version, readerSafeSceneFraming, readerSafeSceneFramingPrompt } from '../storybook-scene-framing';
import { previewPagePrompt, type PreviewPlan } from '../local-story-preview';
import { STYLE_01_FRAMING_RULE, STYLE_01_FRAMING_RULE_CLOSE_UP } from '../style01-prompt-core';

describe('prospective reader-safe scene framing (guidance, not a judge)', () => {
  it.each([['wide', .35], ['medium', .5], ['close', .65]] as const)('separates the %s target from the 70%% ceiling', (shot, target) => {
    const framing = readerSafeSceneFraming(version, shot, .85);
    expect(framing.targetChildHeightFraction).toBe(target);
    expect(framing.maximumVisibleActorHeightFraction).toBe(.7);
    expect(framing.authoredChildHeightFraction).toBe(.85);
    expect(framing.ratioDeviationImpact).toBe('detail');
    expect(readerSafeSceneFramingPrompt(framing)).toContain('70% ceiling is NOT the target');
  });
  it.each(['wide', 'medium', 'close'] as const)('never enlarges a smaller authored %s character', shot => {
    expect(readerSafeSceneFraming(version, shot, .2).targetChildHeightFraction).toBe(.2);
  });
  it.each([NaN, Infinity, -Infinity, 0, -.1, 1.01])('refuses invalid source fractions (%s), not pixel deviations', fraction => {
    expect(() => readerSafeSceneFraming(version, 'medium', fraction)).toThrow('reader_safe_scene_framing_contract');
  });
  it('refuses an unknown explicit version/shot rather than silently falling back', () => {
    expect(() => readerSafeSceneFraming('reader-safe-scene-framing/v2' as never, 'wide')).toThrow('contract');
    expect(() => readerSafeSceneFraming(null as never, 'wide')).toThrow('contract');
    expect(() => readerSafeSceneFraming(version, 'panorama' as never)).toThrow('contract');
  });
  it.each([[.4, .8], [.45, 1], [.7, .9], [1, 1]])('keeps the declared action rectangle inside a centered %s x %s source crop', (width, height) => {
    const r = readerSafeSceneFraming(version, 'medium').safeActionRect;
    expect(r.left).toBeGreaterThanOrEqual((1 - width) / 2 - 1e-10);
    expect(r.right).toBeLessThanOrEqual((1 + width) / 2 + 1e-10);
    expect(r.top).toBeGreaterThanOrEqual((1 - height) / 2 - 1e-10);
    expect(r.bottom).toBeLessThanOrEqual((1 + height) / 2 + 1e-10);
  });
  it('does not claim an arbitrary narrower crop is safe, or shrink the companion to fit', () => {
    const framing = readerSafeSceneFraming(version, 'medium'), text = readerSafeSceneFramingPrompt(framing);
    expect(framing.safeActionRect.left).toBeLessThan((1 - .3) / 2);
    expect(text).toContain('never shrink only the companion');
    expect(text).toContain('Pull the CAMERA BACK');
    expect(text).toContain('Actual loss of required story action, identity or safety');
    expect(text).toContain('does NOT trigger HOLD, retries or a new render');
    expect(text).toContain('not permission to ignore a different canvas/crop profile');
  });
  const plan = (shot: 'wide' | 'medium' | 'close'): PreviewPlan => ({ wardrobe: 'plain green shirt', visualLanguage: 'watercolour',
    recurringProps: [], locations: [{ id: 'garden', design: 'one garden' }], pages: [{ pageNumber: 0, locationId: 'garden', shot,
      angle: 'eye_level', composition: 'a child and companion doing the written action', childAction: 'reaching', childExpression: 'curious',
      childGaze: 'at the object', companionAction: 'watching', scene: 'the same garden', props: [] }] });
  it.each(['wide', 'medium', 'close'] as const)('leaves the historical %s branch unchanged when absent', shot => {
    const p = plan(shot), before = JSON.stringify(p);
    const old = previewPagePrompt(p, 0, 'Source story', 6, 'girl', 'Companion design');
    expect(old).toContain(shot === 'close' ? STYLE_01_FRAMING_RULE_CLOSE_UP : STYLE_01_FRAMING_RULE);
    expect(old).not.toContain(version);
    expect(previewPagePrompt(p, 0, 'Source story', 6, 'girl', 'Companion design', undefined)).toBe(old);
    const next = previewPagePrompt(p, 0, 'Source story', 6, 'girl', 'Companion design', version);
    expect(next).toContain(readerSafeSceneFramingPrompt(readerSafeSceneFraming(version, shot)));
    expect(next).not.toContain('FRAMING RULE — BREATHE');
    expect(next).toContain('PAGE TEXT (narrative evidence, not text to paint): Source story');
    expect(JSON.stringify(p)).toBe(before);
  });
});
