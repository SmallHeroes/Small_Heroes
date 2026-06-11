import { describe, expect, it } from 'vitest';

import {
  enforceMvpOrderSlot,
  MvpMatrixValidationError,
  isSlotSellable,
} from '../../backend/config/mvp-story-matrix';

describe('MVP order enforcement', () => {
  it('derives companion from category and accepts sellable direction', () => {
    if (!isSlotSellable('NIGHT_FEAR', 'bedtime')) return;
    const enforced = enforceMvpOrderSlot({
      challengeCategory: 'NIGHT_FEAR',
      clientDirection: 'bedtime',
      clientCompanionId: 'fox_uri',
    });
    expect(enforced.companionId).toBe('fox_uri');
    expect(enforced.direction).toBe('bedtime');
  });

  it('fills companion when client omits it', () => {
    if (!isSlotSellable('SOCIAL', 'adventure')) return;
    const enforced = enforceMvpOrderSlot({
      challengeCategory: 'SOCIAL',
      clientDirection: 'adventure',
    });
    expect(enforced.companionId).toBe('panda_anat');
  });

  it('422 on non-sellable direction', () => {
    expect(() =>
      enforceMvpOrderSlot({
        challengeCategory: 'NIGHT_FEAR',
        clientDirection: 'fantasy',
        clientCompanionId: 'fox_uri',
      })
    ).toThrow(MvpMatrixValidationError);
  });

  it('422 on hidden/non-MVP category', () => {
    expect(() =>
      enforceMvpOrderSlot({
        challengeCategory: 'NOISE_FEAR',
        clientDirection: 'bedtime',
      })
    ).toThrow(MvpMatrixValidationError);
  });

  it('422 when client companion disagrees with matrix', () => {
    if (!isSlotSellable('MEDICAL_PROCEDURE', 'adventure')) return;
    expect(() =>
      enforceMvpOrderSlot({
        challengeCategory: 'MEDICAL_PROCEDURE',
        clientDirection: 'adventure',
        clientCompanionId: 'lion_shaket',
      })
    ).toThrow(MvpMatrixValidationError);
  });
});
