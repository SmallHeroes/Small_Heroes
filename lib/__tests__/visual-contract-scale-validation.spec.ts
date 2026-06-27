import { describe, expect, it } from 'vitest';

import {
  validateBookVisualContract,
  compileBookVisualContract,
  isInvalidVisualContractError,
  type BookVisualContract,
  type CompanionScaleContract,
} from '@/lib/visual-contract-compiler';

const scale: CompanionScaleContract = {
  ratioToChild: 0.6,
  ratioBand: [0.5, 0.72],
  humanLandmark: 'a small panda cub',
  prohibitions: ['never as tall as the child'],
};

function validContractWithScale(): BookVisualContract {
  return {
    version: 2,
    storyKey: 'demo',
    worldType: 'home',
    locations: [{ id: 'home_bedroom', name: 'Bedroom', description: 'a bedroom' }],
    zones: [],
    cast: {
      child: { id: 'child', role: 'child', wardrobe: { description: 'pajamas' } },
      companion: { id: 'panda_anat', role: 'companion', name: 'Panda', wardrobe: { description: 'red scarf' }, scaleContract: { ...scale } },
    },
    recurringProps: [],
    forbiddenGlobalElements: ['dragon'],
    coverContract: { worldType: 'home', locationId: 'home_bedroom', mustShow: ['child'], mustNotShow: [] },
    pageContracts: [
      { pageNumber: 1, locationId: 'home_bedroom', sameLocationAs: null, mustShow: [], mustNotShow: [], characterPresence: { child: true, companion: true }, propState: [], camera: 'wide' },
    ],
  } as unknown as BookVisualContract;
}

describe('validateBookVisualContract — scaleContract structure', () => {
  it('accepts a well-formed scaleContract', () => {
    expect(validateBookVisualContract(validContractWithScale()).ok).toBe(true);
  });
  it('rejects ratioToChild outside (0,1)', () => {
    const c = validContractWithScale();
    (c.cast.companion!.scaleContract as CompanionScaleContract).ratioToChild = 1.4;
    expect(validateBookVisualContract(c).ok).toBe(false);
  });
  it('rejects an inverted ratioBand', () => {
    const c = validContractWithScale();
    (c.cast.companion!.scaleContract as unknown as Record<string, unknown>).ratioBand = [0.8, 0.5];
    expect(validateBookVisualContract(c).ok).toBe(false);
  });
  it('rejects ratioToChild outside its band', () => {
    const c = validContractWithScale();
    (c.cast.companion!.scaleContract as unknown as Record<string, unknown>).ratioBand = [0.1, 0.2];
    expect(validateBookVisualContract(c).ok).toBe(false);
  });
  it('rejects a missing humanLandmark', () => {
    const c = validContractWithScale();
    (c.cast.companion!.scaleContract as unknown as Record<string, unknown>).humanLandmark = '';
    expect(validateBookVisualContract(c).ok).toBe(false);
  });
  it('rejects prohibitions that are not a string[]', () => {
    const c = validContractWithScale();
    (c.cast.companion!.scaleContract as unknown as Record<string, unknown>).prohibitions = 'nope';
    expect(validateBookVisualContract(c).ok).toBe(false);
  });
});

describe('compileBookVisualContract — fail-closed for an MVP companion', () => {
  const caller = (json: string) => ({ callLLM: async () => json });
  function llmContract(withCompanion: boolean): string {
    const c = validContractWithScale() as unknown as Record<string, any>;
    delete c.cast.companion.scaleContract; // the LLM never produces scale; the canon is stamped
    if (!withCompanion) delete c.cast.companion;
    return JSON.stringify(c);
  }

  it('stamps the canonical scaleContract when the companion is present', async () => {
    const contract = await compileBookVisualContract(
      { fullStoryText: 'x', pageCount: 1, companion: { id: 'panda_anat' }, companionScaleContract: scale },
      caller(llmContract(true))
    );
    expect(contract.cast.companion?.scaleContract?.ratioToChild).toBe(0.6);
  });

  it('throws (fail-closed) when the LLM omits the companion on an MVP order', async () => {
    await expect(
      compileBookVisualContract(
        { fullStoryText: 'x', pageCount: 1, companion: { id: 'panda_anat' }, companionScaleContract: scale },
        caller(llmContract(false))
      )
    ).rejects.toSatisfy(isInvalidVisualContractError);
  });
});
