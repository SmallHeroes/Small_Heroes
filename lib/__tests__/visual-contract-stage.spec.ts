import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  assembleFullStoryText,
  ensureBookVisualContract,
} from '@/lib/generation-pipeline/visual-contract-stage';
import type { PipelineCache } from '@/lib/generation-pipeline/types';

/** A structurally valid BookVisualContract JSON (mirrors the known-valid 1b fixture shape). */
function validContractJson(): string {
  return JSON.stringify({
    version: 1,
    storyKey: 'panda_anat_bedtime',
    worldType: 'cozy bedtime home',
    locations: [{ id: 'home_bedroom', name: 'Bedroom', description: 'a cozy bedroom', timeOfDay: 'night' }],
    zones: [{ id: 'bed', locationId: 'home_bedroom', name: 'Bed', description: 'the bed' }],
    cast: {
      child: { id: 'child', role: 'child', name: 'Anat', wardrobe: { description: 'yellow pajamas' } },
      companion: { id: 'panda_anat', role: 'companion', name: 'Panda', wardrobe: { description: 'red scarf' } },
    },
    recurringProps: [{ id: 'teddy', name: 'teddy bear', description: 'a teddy bear' }],
    forbiddenGlobalElements: ['armadillo'],
    coverContract: {
      worldType: 'cozy bedtime home',
      locationId: 'home_bedroom',
      timeOfDay: 'night',
      mustShow: ['child'],
      mustNotShow: ['daylight'],
    },
    pageContracts: [
      { pageNumber: 1, locationId: 'home_bedroom', zoneId: 'bed', sameLocationAs: null, mustShow: ['child'], mustNotShow: [], characterPresence: { child: true, companion: false }, propState: [], camera: 'wide establishing' },
      { pageNumber: 2, locationId: 'home_bedroom', zoneId: 'bed', sameLocationAs: 1, mustShow: ['teddy bear'], mustNotShow: [], characterPresence: { child: true, companion: true }, propState: [], camera: 'close' },
    ],
  });
}

const samplePages = [
  { pageNumber: 2, text: 'Page two text' },
  { pageNumber: 1, text: 'Page one text' },
];

afterEach(() => {
  delete process.env.VISUAL_CONTRACT_ENFORCEMENT;
  delete process.env.VERCEL_ENV;
});

describe('assembleFullStoryText', () => {
  it('orders pages by number and labels each', () => {
    expect(assembleFullStoryText(samplePages)).toBe(
      '--- Page 1 ---\nPage one text\n\n--- Page 2 ---\nPage two text'
    );
  });

  it('tolerates missing text', () => {
    expect(assembleFullStoryText([{ pageNumber: 1 }])).toBe('--- Page 1 ---\n');
  });
});

describe('ensureBookVisualContract', () => {
  it('enforcement OFF → no-op, returns cache unchanged, no LLM call', async () => {
    delete process.env.VISUAL_CONTRACT_ENFORCEMENT;
    const callLLM = vi.fn();
    const cache: PipelineCache = {};
    const res = await ensureBookVisualContract({ cache, pages: samplePages }, { callLLM });
    expect(res.compiled).toBe(false);
    expect(res.contract).toBeNull();
    expect(res.cache).toBe(cache);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it('enforcement ON + no cached contract → compiles once, caches it (fail-closed validated)', async () => {
    process.env.VISUAL_CONTRACT_ENFORCEMENT = 'true';
    delete process.env.VERCEL_ENV;
    const callLLM = vi.fn(async () => validContractJson());
    const cache: PipelineCache = {};
    const res = await ensureBookVisualContract(
      { cache, storyKey: 'panda_anat_bedtime', pages: samplePages, companion: { id: 'panda_anat', name: 'Panda' } },
      { callLLM }
    );
    expect(callLLM).toHaveBeenCalledTimes(1);
    expect(res.compiled).toBe(true);
    expect(res.contract?.worldType).toBe('cozy bedtime home');
    expect(res.cache.visualContract).toBeTruthy();
    expect(res.cache).not.toBe(cache); // new object → caller persists
  });

  it('enforcement ON + already cached → reuse, no second LLM call', async () => {
    process.env.VISUAL_CONTRACT_ENFORCEMENT = 'true';
    delete process.env.VERCEL_ENV;
    const first = await ensureBookVisualContract(
      { cache: {}, pages: samplePages },
      { callLLM: vi.fn(async () => validContractJson()) }
    );
    const callLLM2 = vi.fn();
    const res = await ensureBookVisualContract({ cache: first.cache, pages: samplePages }, { callLLM: callLLM2 });
    expect(res.compiled).toBe(false);
    expect(res.contract).toBe(first.contract);
    expect(callLLM2).not.toHaveBeenCalled();
  });

  it('enforcement ON + cached MVP contract WITHOUT a scaleContract → recompiles (cache keyed on scale validity)', async () => {
    process.env.VISUAL_CONTRACT_ENFORCEMENT = 'true';
    delete process.env.VERCEL_ENV;
    // A current-version cached contract for an MVP companion (panda_anat) but missing the scale lock.
    const staleV2NoScale = JSON.parse(validContractJson()) as Record<string, any>;
    staleV2NoScale.version = 2;
    delete staleV2NoScale.cast.companion.scaleContract;
    const callLLM = vi.fn(async () => validContractJson());
    const res = await ensureBookVisualContract(
      { cache: { visualContract: staleV2NoScale }, companion: { id: 'panda_anat' }, pages: samplePages },
      { callLLM }
    );
    expect(res.compiled).toBe(true); // version matched but scale was missing → recompiled
    expect(callLLM).toHaveBeenCalledTimes(1);
    expect(res.contract?.cast.companion?.scaleContract?.ratioToChild).toBeDefined();
  });

  it('enforcement ON + invalid contract from the model → throws (fail-closed, no silent render)', async () => {
    process.env.VISUAL_CONTRACT_ENFORCEMENT = 'true';
    delete process.env.VERCEL_ENV;
    const callLLM = vi.fn(async () => JSON.stringify({ version: 1 }));
    await expect(
      ensureBookVisualContract({ cache: {}, pages: samplePages }, { callLLM })
    ).rejects.toThrow();
  });
});
