import { describe, expect, it, vi } from 'vitest';
import * as stage0 from '../../generation-pipeline/stage0-method-b';
import { buildStage0MethodBPrompt, buildStage0AnchorAgeLockLine, STAGE0_ANCHOR_ANTI_TODDLER } from '../../generation-pipeline/stage0-method-b';
import { calibratedAnchorAgeLines, calibratedPhotoAnchorPrompt, ANCHOR_AGE_CALIBRATION_VERSION } from '../photo-anchor-age';

const input = (age: number, gender: 'boy' | 'girl') => ({ order: { childAge: age, childGender: gender }, lockedChildDescription: `A ${age}-year-old ${gender}.`,
  childPhotoDescription: null, referenceLayout: 'photo_only_no_template' as const });

describe('photo anchor age calibration (opt-in; the new engine only; production unchanged)', () => {
  it('age 5 keeps production\'s own calibrated line and block: the prompt is byte-identical to production\'s', () => {
    for (const g of ['boy', 'girl'] as const) expect(calibratedPhotoAnchorPrompt(input(5, g))).toBe(buildStage0MethodBPrompt(input(5, g)));
  });

  it('every other age 2-12: exactly production\'s two age elements are replaced, with two-sided bounds; everything else is production\'s', () => {
    for (const g of ['boy', 'girl'] as const) for (let age = 2; age <= 12; age++) {
      if (age === 5) continue;
      const production = buildStage0MethodBPrompt(input(age, g)), calibrated = calibratedPhotoAnchorPrompt(input(age, g));
      const productionLine = buildStage0AnchorAgeLockLine({ childAge: age, childGender: g }), { ageLock, ageBounds } = calibratedAnchorAgeLines(age, g);
      expect(calibrated).not.toContain(productionLine);
      expect(calibrated.split(ageLock).length - 1).toBe(1);
      expect(ageLock).toContain(`must read as about ${age}: NOT ${age + 2} or older`);
      expect(ageLock).toContain(`not younger than ${age - 1}`);
      // Only the two elements differ: putting production's back gives production's prompt exactly.
      expect(calibrated.replace(ageLock, () => productionLine).replace(ageBounds, () => STAGE0_ANCHOR_ANTI_TODDLER)).toBe(production);
      if (age === 4) expect(ageBounds).toBe(STAGE0_ANCHOR_ANTI_TODDLER);
      else { expect(calibrated).not.toContain(STAGE0_ANCHOR_ANTI_TODDLER); expect(ageBounds).toContain('AGE BOUNDS (mandatory)'); }
      if (age >= 6) expect(ageBounds).toContain(`NOT a ${age + 2}-${age + 3}-year-old`);
      if (age <= 3) expect(ageBounds).toContain(`a ${age}-year-old toddler`);
    }
  });

  it('production drift is refused (an age element missing or repeated), never silently wrong', () => {
    const real = buildStage0MethodBPrompt(input(7, 'boy'));
    const spy = vi.spyOn(stage0, 'buildStage0MethodBPrompt');
    for (const drifted of ['a production prompt without its age line', `${real}\n${real}`]) {
      spy.mockReturnValue(drifted);
      expect(() => calibratedPhotoAnchorPrompt(input(7, 'boy'))).toThrow('anchor_age_production_drift');
    }
    spy.mockRestore();
    expect(calibratedPhotoAnchorPrompt(input(7, 'boy'))).toContain(calibratedAnchorAgeLines(7, 'boy').ageLock);
  });

  it('ages outside 2-12, non-integers and unknown genders are refused; the calibration is versioned', () => {
    for (const [age, g] of [[1, 'boy'], [13, 'girl'], [7.5, 'boy'], [7, 'other']] as const)
      expect(() => calibratedAnchorAgeLines(age, g as 'boy')).toThrow('anchor_age_out_of_range');
    expect(ANCHOR_AGE_CALIBRATION_VERSION).toBe('anchor-age-calibration/v1');
  });
});
