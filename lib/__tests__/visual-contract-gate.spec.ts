import { describe, expect, it, vi } from 'vitest';

import {
  runPageContractGate,
  isVisualContractQaBlockError,
} from '@/lib/generation-pipeline/visual-contract-gate';
import type { BookVisualContract } from '@/lib/visual-contract-compiler';
import type { ResolvedPageContract } from '@/lib/visual-contract-compiler/derivePageVisualContracts';

const contract = {
  cast: { companion: { name: 'Panda' } },
  locations: [{ id: 'home_bedroom', name: 'Bedroom', description: 'a bedroom' }],
  forbiddenGlobalElements: ['armadillo'],
  coverContract: { worldType: 'home', timeOfDay: 'night' },
  recurringProps: [],
} as unknown as BookVisualContract;

const page = {
  pageNumber: 4,
  locationId: 'home_bedroom',
  characterPresence: { child: true, companion: true },
  companionWardrobeLock: 'red scarf',
  mustShow: [],
  mustNotShow: [],
} as unknown as ResolvedPageContract;

const PASS = JSON.stringify({
  locationMatchesContract: true,
  forbiddenEntitiesPresent: [],
  missingMajorProps: [],
  companionWardrobeMatches: true,
});
const FAIL_ARMADILLO = JSON.stringify({
  locationMatchesContract: true,
  forbiddenEntitiesPresent: ['armadillo'],
  missingMajorProps: [],
  companionWardrobeMatches: true,
});

function renderSpy() {
  const calls: Array<{ suppression: string; attempt: number }> = [];
  const render = vi.fn(async ({ suppression, attempt }: { suppression: string; extraNegative: string; attempt: number }) => {
    calls.push({ suppression, attempt });
    return { image: { tag: `img-${attempt}` }, url: `https://x/${attempt}.png` };
  });
  return { render, calls };
}

describe('runPageContractGate — no-leak + bounded render budget + feedback reroll', () => {
  it('first attempt PASSES → exactly one render; returns that image', async () => {
    const { render } = renderSpy();
    const vision = vi.fn(async () => PASS);
    const res = await runPageContractGate({ page, contract, render, vision, maxRerolls: 2 });
    expect(render).toHaveBeenCalledTimes(1);
    expect(res.renderCalls).toBe(1);
    expect(res.passedAttempt).toBe(0);
    expect((res.image as { tag: string }).tag).toBe('img-0');
  });

  it('FAIL → PASS: two attempts, suppression fed FORWARD (not blind), only the 2nd image promoted', async () => {
    const { render, calls } = renderSpy();
    const vision = vi.fn().mockResolvedValueOnce(FAIL_ARMADILLO).mockResolvedValueOnce(PASS);
    const res = await runPageContractGate({ page, contract, render, vision, maxRerolls: 2 });
    expect(render).toHaveBeenCalledTimes(2);
    expect(calls[0].suppression).toBe(''); // attempt 0 has no correction
    expect(calls[1].suppression).toMatch(/armadillo/i); // reroll received the caught entity
    expect(res.passedAttempt).toBe(1);
    expect((res.image as { tag: string }).tag).toBe('img-1'); // ONLY the passing attempt is the result
  });

  it('FAIL to exhaustion → throws VISUAL_CONTRACT_QA_BLOCK, returns NO image', async () => {
    const { render } = renderSpy();
    const vision = vi.fn(async () => FAIL_ARMADILLO);
    await expect(
      runPageContractGate({ page, contract, render, vision, maxRerolls: 2 })
    ).rejects.toSatisfy(isVisualContractQaBlockError);
    expect(render).toHaveBeenCalledTimes(3); // attempt 0 + 2 rerolls — the hard budget
  });

  it('proven render-call upper bound = maxRerolls+1 even when every attempt fails', async () => {
    const { render } = renderSpy();
    const vision = vi.fn(async () => FAIL_ARMADILLO);
    let err: unknown;
    try {
      await runPageContractGate({ page, contract, render, vision, maxRerolls: 1 });
    } catch (e) {
      err = e;
    }
    expect(isVisualContractQaBlockError(err)).toBe(true);
    expect(render).toHaveBeenCalledTimes(2); // 1 reroll + attempt 0 — never more
  });

  it('scale not_measurable does NOT trigger a reroll (other checks pass → one render)', async () => {
    const contractWithScale = {
      ...contract,
      cast: {
        companion: {
          name: 'Panda',
          scaleContract: { ratioToChild: 0.6, ratioBand: [0.5, 0.72], humanLandmark: 'a panda cub', prohibitions: ['x'] },
        },
      },
    } as unknown as BookVisualContract;
    const { render } = renderSpy();
    const vision = vi.fn(async () =>
      JSON.stringify({
        locationMatchesContract: true,
        forbiddenEntitiesPresent: [],
        missingMajorProps: [],
        companionWardrobeMatches: true,
        bothFullBody: false, // not full-body → not_measurable
        childHeightFraction: null,
        companionHeightFraction: null,
        scaleConfidence: 0.2,
      })
    );
    const res = await runPageContractGate({ page, contract: contractWithScale, render, vision, maxRerolls: 2 });
    expect(render).toHaveBeenCalledTimes(1);
    expect(res.passedAttempt).toBe(0);
  });
});
