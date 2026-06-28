import { describe, expect, it, vi } from 'vitest';

import {
  gatePageWithResemblance,
  rerollKeepsResemblance,
} from '@/lib/generation-pipeline/visual-contract-gate';
import type { BookVisualContract } from '@/lib/visual-contract-compiler';
import type { ResolvedPageContract } from '@/lib/visual-contract-compiler/derivePageVisualContracts';

// Integration unit for the LIVE per-page decision: contract gate (bounded feedback reroll) + the
// election-only resemblance re-check that keeps a contract fix from silently losing child identity.
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
  const render = vi.fn(
    async ({ attempt }: { suppression: string; extraNegative: string; attempt: number }) => ({
      image: { tag: `img-${attempt}` },
      url: `https://x/${attempt}.png`,
    })
  );
  return { render };
}

describe('gatePageWithResemblance — live per-page decision (gate + reroll resemblance, no-leak)', () => {
  it('attempt 0 PASSES → kept, image promoted, resemblance re-check NOT called', async () => {
    const { render } = renderSpy();
    const vision = vi.fn(async () => PASS);
    const recheck = vi.fn(async () => true);
    const out = await gatePageWithResemblance({
      page,
      contract,
      render,
      vision,
      maxRerolls: 2,
      resemblanceRecheck: recheck,
    });
    expect(out.kept).toBe(true);
    if (out.kept) expect((out.image as { tag: string }).tag).toBe('img-0');
    expect(recheck).not.toHaveBeenCalled(); // only PROMOTED rerolls (passedAttempt>0) are re-checked
  });

  it('FAIL→PASS reroll + resemblance OK → keeps the reroll image; re-check ran on the reroll', async () => {
    const { render } = renderSpy();
    const vision = vi.fn().mockResolvedValueOnce(FAIL_ARMADILLO).mockResolvedValueOnce(PASS);
    const recheck = vi.fn(async (_img: unknown, _url: string, _passedAttempt: number) => true);
    const out = await gatePageWithResemblance({
      page,
      contract,
      render,
      vision,
      maxRerolls: 2,
      resemblanceRecheck: recheck,
    });
    expect(out.kept).toBe(true);
    if (out.kept) {
      expect((out.image as { tag: string }).tag).toBe('img-1');
      expect(out.passedAttempt).toBe(1);
    }
    expect(recheck).toHaveBeenCalledTimes(1);
    expect(recheck.mock.calls[0][2]).toBe(1); // passedAttempt forwarded
  });

  it('FAIL→PASS reroll but resemblance LOST → kept:false (identity-after-reroll drop, no-leak)', async () => {
    const { render } = renderSpy();
    const vision = vi.fn().mockResolvedValueOnce(FAIL_ARMADILLO).mockResolvedValueOnce(PASS);
    const recheck = vi.fn(async () => false); // reroll cleared the contract gate but lost identity
    const out = await gatePageWithResemblance({
      page,
      contract,
      render,
      vision,
      maxRerolls: 2,
      resemblanceRecheck: recheck,
    });
    expect(out.kept).toBe(false);
    if (!out.kept) expect(out.reason).toMatch(/resemblance/i);
  });

  it('contract gate exhausted → kept:false, NO image (no-leak)', async () => {
    const { render } = renderSpy();
    const vision = vi.fn(async () => FAIL_ARMADILLO);
    const recheck = vi.fn(async () => true);
    const out = await gatePageWithResemblance({
      page,
      contract,
      render,
      vision,
      maxRerolls: 2,
      resemblanceRecheck: recheck,
    });
    expect(out.kept).toBe(false);
    expect(render).toHaveBeenCalledTimes(3); // attempt 0 + 2 rerolls — the proven budget
    expect(recheck).not.toHaveBeenCalled(); // nothing passed, so nothing to re-check
  });

  it('non-election page (no resemblanceRecheck) → reroll promoted without a resemblance check', async () => {
    const { render } = renderSpy();
    const vision = vi.fn().mockResolvedValueOnce(FAIL_ARMADILLO).mockResolvedValueOnce(PASS);
    const out = await gatePageWithResemblance({
      page,
      contract,
      render,
      vision,
      maxRerolls: 2,
      resemblanceRecheck: null,
    });
    expect(out.kept).toBe(true);
    if (out.kept) expect((out.image as { tag: string }).tag).toBe('img-1');
  });
});

describe('rerollKeepsResemblance — real reroll-resemblance enforcement (P1-1)', () => {
  it('drops BELOW the effective threshold, keeps AT/ABOVE it (0.69 blocked, 0.70 passes)', () => {
    expect(rerollKeepsResemblance(0.69, 0.7)).toBe(false);
    expect(rerollKeepsResemblance(0.7, 0.7)).toBe(true);
    expect(rerollKeepsResemblance(0.71, 0.7)).toBe(true);
  });

  it('fails CLOSED on a null/absent score', () => {
    expect(rerollKeepsResemblance(null, 0.7)).toBe(false);
    expect(rerollKeepsResemblance(undefined, 0.7)).toBe(false);
  });

  it('enforces on a reroll with NO anchor-election: a 0.69 reroll → page dropped', async () => {
    const { render } = renderSpy();
    const vision = vi.fn().mockResolvedValueOnce(FAIL_ARMADILLO).mockResolvedValueOnce(PASS);
    // recheck encodes the REAL rule (effective threshold 0.70), independent of any anchor-election
    const recheck = async () => rerollKeepsResemblance(0.69, 0.7);
    const out = await gatePageWithResemblance({
      page,
      contract,
      render,
      vision,
      maxRerolls: 2,
      resemblanceRecheck: recheck,
    });
    expect(out.kept).toBe(false);
    if (!out.kept) expect(out.reason).toMatch(/resemblance/i);
  });

  it('enforces on a reroll with NO anchor-election: a 0.70 reroll → page kept', async () => {
    const { render } = renderSpy();
    const vision = vi.fn().mockResolvedValueOnce(FAIL_ARMADILLO).mockResolvedValueOnce(PASS);
    const recheck = async () => rerollKeepsResemblance(0.7, 0.7);
    const out = await gatePageWithResemblance({
      page,
      contract,
      render,
      vision,
      maxRerolls: 2,
      resemblanceRecheck: recheck,
    });
    expect(out.kept).toBe(true);
    if (out.kept) expect((out.image as { tag: string }).tag).toBe('img-1');
  });
});
