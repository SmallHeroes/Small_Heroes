import { describe, expect, it, vi } from 'vitest';

import {
  evaluateRerollIdentity,
  gatePageWithResemblance,
  type RerollIdentityVerdict,
} from '@/lib/generation-pipeline/visual-contract-gate';
import type { BookVisualContract } from '@/lib/visual-contract-compiler';
import type { ResolvedPageContract } from '@/lib/visual-contract-compiler/derivePageVisualContracts';

// Integration unit for the LIVE per-page decision: contract gate (bounded feedback reroll) + the 3-state
// reroll identity recheck (pass | fail | not_measurable). Only a real identity FAIL drops the page.
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

const verdict = (status: RerollIdentityVerdict['status'], score: number | null = 0.8): RerollIdentityVerdict => ({
  status,
  score,
  reason: status,
});

function renderSpy() {
  const render = vi.fn(
    async ({ attempt }: { suppression: string; extraNegative: string; attempt: number }) => ({
      image: { tag: `img-${attempt}` },
      url: `https://x/${attempt}.png`,
    })
  );
  return { render };
}

describe('gatePageWithResemblance — live per-page decision (gate + 3-state reroll identity)', () => {
  it('attempt 0 PASSES → kept, recheck NOT called, no identityStatus', async () => {
    const { render } = renderSpy();
    const vision = vi.fn(async () => PASS);
    const recheck = vi.fn(async () => verdict('pass'));
    const out = await gatePageWithResemblance({ page, contract, render, vision, maxRerolls: 2, resemblanceRecheck: recheck });
    expect(out.kept).toBe(true);
    if (out.kept) {
      expect((out.image as { tag: string }).tag).toBe('img-0');
      expect(out.identityStatus).toBeUndefined();
    }
    expect(recheck).not.toHaveBeenCalled(); // only PROMOTED rerolls (passedAttempt>0) are re-checked
  });

  it('reroll + identity PASS → keeps the reroll image, identityStatus=pass, recheck ran on the reroll', async () => {
    const { render } = renderSpy();
    const vision = vi.fn().mockResolvedValueOnce(FAIL_ARMADILLO).mockResolvedValueOnce(PASS);
    const recheck = vi.fn(async (_img: unknown, _url: string, _passedAttempt: number) => verdict('pass'));
    const out = await gatePageWithResemblance({ page, contract, render, vision, maxRerolls: 2, resemblanceRecheck: recheck });
    expect(out.kept).toBe(true);
    if (out.kept) {
      expect((out.image as { tag: string }).tag).toBe('img-1');
      expect(out.passedAttempt).toBe(1);
      expect(out.identityStatus).toBe('pass');
    }
    expect(recheck).toHaveBeenCalledTimes(1);
    expect(recheck.mock.calls[0][2]).toBe(1); // passedAttempt forwarded
  });

  it('reroll + identity FAIL → kept:false (drop, no-leak), identityStatus=fail', async () => {
    const { render } = renderSpy();
    const vision = vi.fn().mockResolvedValueOnce(FAIL_ARMADILLO).mockResolvedValueOnce(PASS);
    const recheck = vi.fn(async () => verdict('fail', 0.2)); // measurable single face, clear mismatch
    const out = await gatePageWithResemblance({ page, contract, render, vision, maxRerolls: 2, resemblanceRecheck: recheck });
    expect(out.kept).toBe(false);
    if (!out.kept) {
      expect(out.reason).toMatch(/identity FAIL/i);
      expect(out.identityStatus).toBe('fail');
    }
  });

  it('reroll + identity NOT_MEASURABLE → KEPT (never dropped), identityStatus=not_measurable', async () => {
    // The page-3 false-low case: a multi-face / busy scene is unmeasurable → kept for human review, NOT dropped.
    const { render } = renderSpy();
    const vision = vi.fn().mockResolvedValueOnce(FAIL_ARMADILLO).mockResolvedValueOnce(PASS);
    const recheck = vi.fn(async () => verdict('not_measurable', 0.252));
    const out = await gatePageWithResemblance({ page, contract, render, vision, maxRerolls: 2, resemblanceRecheck: recheck });
    expect(out.kept).toBe(true);
    if (out.kept) {
      expect((out.image as { tag: string }).tag).toBe('img-1');
      expect(out.identityStatus).toBe('not_measurable');
    }
  });

  it('contract gate exhausted → kept:false, NO image (no-leak), recheck not called', async () => {
    const { render } = renderSpy();
    const vision = vi.fn(async () => FAIL_ARMADILLO);
    const recheck = vi.fn(async () => verdict('pass'));
    const out = await gatePageWithResemblance({ page, contract, render, vision, maxRerolls: 2, resemblanceRecheck: recheck });
    expect(out.kept).toBe(false);
    expect(render).toHaveBeenCalledTimes(3); // attempt 0 + 2 rerolls — the proven budget
    expect(recheck).not.toHaveBeenCalled(); // nothing passed, so nothing to re-check
  });

  it('non-election page (no resemblanceRecheck) → reroll promoted without an identity check', async () => {
    const { render } = renderSpy();
    const vision = vi.fn().mockResolvedValueOnce(FAIL_ARMADILLO).mockResolvedValueOnce(PASS);
    const out = await gatePageWithResemblance({ page, contract, render, vision, maxRerolls: 2, resemblanceRecheck: null });
    expect(out.kept).toBe(true);
    if (out.kept) {
      expect((out.image as { tag: string }).tag).toBe('img-1');
      expect(out.identityStatus).toBeUndefined();
    }
  });
});

describe('evaluateRerollIdentity — 3-state, un-broken (no whole-image hard-block)', () => {
  it('geometryWeird (multi-face / tiny face) → not_measurable, NEVER fail — the page-3 false-low case', () => {
    // 0.252 score + clearMismatch, but geometryWeird (4 faces in scene) → not_measurable, NOT dropped.
    const v = evaluateRerollIdentity({ score: 0.252, geometryWeird: true, faceDetectConfidence: 0.9, clearMismatch: true });
    expect(v.status).toBe('not_measurable');
  });

  it('low face-detect confidence → not_measurable (cannot trust the histogram)', () => {
    const v = evaluateRerollIdentity({ score: 0.2, geometryWeird: false, faceDetectConfidence: 0.3, clearMismatch: true });
    expect(v.status).toBe('not_measurable');
  });

  it('null score → not_measurable', () => {
    expect(evaluateRerollIdentity({ score: null, geometryWeird: false, faceDetectConfidence: 0.9 }).status).toBe('not_measurable');
  });

  it('measurable single prominent face + CLEAR mismatch → fail (the only hard-fail case)', () => {
    const v = evaluateRerollIdentity({ score: 0.2, geometryWeird: false, faceDetectConfidence: 0.9, clearMismatch: true });
    expect(v.status).toBe('fail');
  });

  it('measurable face + NO clear mismatch → pass (a 0.60 score the old 0.70 gate would have dropped)', () => {
    const v = evaluateRerollIdentity({ score: 0.6, geometryWeird: false, faceDetectConfidence: 0.9, clearMismatch: false });
    expect(v.status).toBe('pass');
  });
});
