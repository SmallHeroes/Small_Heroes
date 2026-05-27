import { describe, expect, it } from 'vitest';
import {
  assembleGuardedV2PagePrompt,
  inferFramingType,
  inferSceneState,
  resolveGuardedV2SpecForPage,
} from '../style02-guarded-v2';

describe('guarded-v2 assembler', () => {
  it('uses explicit Bolly page 6 hand-detail + gesture', () => {
    const spec = resolveGuardedV2SpecForPage(6, {
      companionId: 'bolly_armadillo',
      sceneClass: 'night-bedroom',
      bookPageText: 'יד קטנה נפתחת לאט על השמיכה.',
    });
    const { debug } = assembleGuardedV2PagePrompt({
      sceneDescription: 'hand on blanket',
      spec,
    });
    expect(debug.framingType).toBe('hand-detail');
    expect(debug.framingTypeSource).toBe('explicit');
    expect(debug.handDetailRuleApplied).toBe(true);
    expect(debug.closeUpRuleApplied).toBe(false);
    expect(debug.sceneState).toBe('in-bed');
  });

  it('page 5 object-close-up does not apply close-up face rule', () => {
    const spec = resolveGuardedV2SpecForPage(5, { companionId: 'bolly_armadillo' });
    const { debug, prompt } = assembleGuardedV2PagePrompt({
      sceneDescription: 'Bolly curled on blanket',
      spec,
    });
    expect(debug.framingType).toBe('object-close-up');
    expect(debug.closeUpRuleApplied).toBe(false);
    expect(prompt).not.toContain('HAND DETAIL RULE');
    expect(prompt).toContain('ILLUSTRATION ANCHOR');
  });

  it('infers sleeping from Hebrew asleep cues', () => {
    const { value } = inferSceneState({
      pageNumber: 10,
      bookPageText: 'הילד נרדם בשקט.',
      sceneClass: 'night-bedroom',
    });
    expect(value).toBe('sleeping');
  });

  it('page 2 transitional close-emotional explicit from recipe', () => {
    const spec = resolveGuardedV2SpecForPage(2, { companionId: 'bolly_armadillo' });
    expect(spec.framingType).toBe('close-emotional');
    expect(spec.sceneState).toBe('transitional');
    const framing = inferFramingType(spec, 'transitional');
    expect(framing.value).toBe('close-emotional');
    expect(framing.source).toBe('explicit');
  });
});
