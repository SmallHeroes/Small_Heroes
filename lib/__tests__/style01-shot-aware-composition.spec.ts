import { describe, expect, it } from 'vitest';

import {
  OverShoulderGuardError,
  assertOverShoulderAllowed,
  buildShotAwareFramingRule,
  shotPlanToCompositionSpec,
} from '../book-shot-plan/compose';
import type { PageShot } from '../book-shot-plan/types';
import { assembleStyle01Phase2Prompt } from '../style01-prompt-assembly';
import { enrichImageDirection } from '../../backend/providers/image-prompt-enricher';

function assembleProbe(shot: PageShot): string {
  const enriched = enrichImageDirection({
    rawImageDirection: 'pediatric clinic exam room with child and bunny companion',
    layout: 'full_bleed_soft',
    wordCount: 20,
    textZone: null,
    pageShot: shot,
  });
  return assembleStyle01Phase2Prompt({
    pageNumber: shot.page,
    totalPages: 12,
    pagePrompt: enriched,
    rawScenePrompt: enriched,
    bookPageText: 'בדיקה קטנה',
    childFirstName: 'נועה',
    childAge: 7,
    childGender: 'girl',
    childDescription: 'girl with curly hair',
    companion: {
      id: 'bunny_ometz',
      name: 'בוּנִי',
      visualDescription: 'cream bunny with floppy ears',
    },
    challengeCategory: 'MEDICAL_PROCEDURE',
    pageShot: shot,
    explicitCloseUp: shot.shot === 'close_up',
  }).prompt;
}

describe('B1 shot-aware composition', () => {
  it('close_up prompt — true close-up, no medium house rules', () => {
    const prompt = assembleProbe({
      page: 7,
      shot: 'close_up',
      rationale: 'emotional tapping beat',
    });
    expect(prompt).toMatch(/65.?80|65–80/);
    expect(prompt).toMatch(/TRUE CLOSE-UP/i);
    expect(prompt).toMatch(/Do NOT show full body/i);
    expect(prompt).toMatch(/Crop at face/i);
    expect(prompt).not.toMatch(/35.?50/);
    expect(prompt).not.toMatch(/AVOID TIGHT CROPS/i);
    expect(prompt).not.toMatch(/environment must occupy at least 50/i);
    expect(prompt).not.toMatch(/not as portrait close-ups/i);
  });

  it('establishing_wide prompt — small characters, no 35–50% house rule', () => {
    const prompt = assembleProbe({
      page: 1,
      shot: 'establishing_wide',
      angle: 'eye',
      rationale: 'open clinic',
    });
    expect(prompt).toMatch(/15.?25|15–25/);
    expect(prompt).toMatch(/environment dominates/i);
    expect(prompt).toMatch(/embedded/i);
    expect(prompt).toMatch(/recognizable/i);
    expect(prompt).not.toMatch(/35.?50/);
    expect(prompt).not.toMatch(/AVOID TIGHT CROPS/i);
  });

  it('dynamic_angle + low — physical floor/chair camera cues', () => {
    const prompt = assembleProbe({
      page: 4,
      shot: 'dynamic_angle',
      angle: 'low',
      rationale: 'bunny on chair',
    });
    expect(prompt).toMatch(/floor/i);
    expect(prompt).toMatch(/looking slightly upward/i);
    expect(prompt).toMatch(/chair legs/i);
  });

  it('medium prompt — keeps ordinary house breathe rules', () => {
    const prompt = assembleProbe({
      page: 5,
      shot: 'medium',
      angle: 'eye',
      rationale: 'quiet transition',
    });
    expect(prompt).toMatch(/35.?50/);
    expect(prompt).toMatch(/environment visible/i);
    expect(prompt).toMatch(/AVOID TIGHT CROPS|Avoid tight portrait/i);
  });

  it('over_shoulder guards throw on forbidden slots', () => {
    const base = { angle: 'over_shoulder' as const, rationale: 'ots test' };
    expect(() =>
      assertOverShoulderAllowed({ page: 1, shot: 'medium', ...base })
    ).toThrow(OverShoulderGuardError);
    expect(() =>
      assertOverShoulderAllowed({ page: 3, shot: 'close_up', ...base })
    ).toThrow(OverShoulderGuardError);
    expect(() =>
      assertOverShoulderAllowed({ page: 3, shot: 'intimate', ...base })
    ).toThrow(OverShoulderGuardError);
  });

  it('valid over_shoulder override produces OTS composition block', () => {
    const spec = shotPlanToCompositionSpec({
      page: 6,
      shot: 'medium',
      angle: 'over_shoulder',
      rationale: 'nurse thermometer OTS',
    });
    expect(spec.shotType).toMatch(/over_the_shoulder/i);
    const framing = buildShotAwareFramingRule({
      page: 6,
      shot: 'medium',
      angle: 'over_shoulder',
      rationale: 'ots',
    });
    expect(framing).toMatch(/over-the-shoulder/i);
    expect(framing).toMatch(/foreground/i);
    expect(framing).toMatch(/focal/i);
  });

  it('close_up spec uses large scale — not medium', () => {
    const spec = shotPlanToCompositionSpec({
      page: 7,
      shot: 'close_up',
      rationale: 'peak',
    });
    expect(spec.subjectScale).toBe('large');
    expect(spec.frameHeightPercent).toBe('65-80');
    expect(spec.subjectDominance).not.toMatch(/NOT isolated giant face portrait/i);
  });

  it('intimate framing keeps portrait protection — not on close_up', () => {
    const intimate = buildShotAwareFramingRule({
      page: 3,
      shot: 'intimate',
      rationale: 'emotional',
    });
    expect(intimate).toMatch(/Avoid giant isolated face-only portraits/i);
    const closeUp = buildShotAwareFramingRule({
      page: 7,
      shot: 'close_up',
      rationale: 'peak',
    });
    expect(closeUp).not.toMatch(/Avoid giant isolated face-only portraits/i);
  });
});
