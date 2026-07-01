import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// (#6-fix-3 BLOCKER 2 + 3) Exercise the REAL reserveMarkAndClearRegen against a fake tx whose QualityEvidence store
// performs a REAL conditional increment (regenCount++ WHERE regenCount < budget) — proving the durable budget
// actually advances at the RESCUE level and stops at the cap, NOT via a mock counter. We mock ONLY the write
// barrier (raw-SQL bound) to run the callback with our fake tx; the reserve/mark/clear logic runs for real.
const mocks = vi.hoisted(() => {
  const qe: Record<string, { regenCount: number; evidence: Record<string, unknown> | null; verdict: string }> = {};
  const calls = {
    imageAssetDeleteMany: [] as unknown[],
    generatedBookUpdate: [] as unknown[],
    orderUpdate: [] as unknown[],
    bookPages: [{ id: 'pg2' }] as Array<{ id: string }>,
    bookId: 'b1' as string | null,
  };
  const tx = {
    qualityEvidence: {
      upsert: async ({ where, create }: { where: { orderId_artifactKey: { artifactKey: string } }; create: { regenCount?: number; evidence?: Record<string, unknown> | null; verdict: string } }) => {
        const k = where.orderId_artifactKey.artifactKey;
        if (!qe[k]) qe[k] = { regenCount: create.regenCount ?? 0, evidence: create.evidence ?? null, verdict: create.verdict };
        return {};
      },
      updateMany: async ({ where, data }: { where: { artifactKey: string; regenCount?: { lt: number } }; data: { regenCount?: { increment: number } } }) => {
        const row = qe[where.artifactKey];
        if (!row) return { count: 0 };
        if (where.regenCount?.lt !== undefined && !(row.regenCount < where.regenCount.lt)) return { count: 0 };
        if (data.regenCount?.increment) row.regenCount += Number(data.regenCount.increment);
        return { count: 1 };
      },
      findUnique: async ({ where }: { where: { orderId_artifactKey: { artifactKey: string } } }) => {
        const k = where.orderId_artifactKey.artifactKey;
        return qe[k] ? { evidence: qe[k].evidence } : null;
      },
      update: async ({ where, data }: { where: { orderId_artifactKey: { artifactKey: string } }; data: { evidence: Record<string, unknown> } }) => {
        const k = where.orderId_artifactKey.artifactKey;
        if (qe[k]) qe[k].evidence = data.evidence;
        return {};
      },
    },
    generatedBook: {
      findUnique: async ({ select }: { select?: { pages?: unknown } }) =>
        select?.pages ? { pages: calls.bookPages } : calls.bookId ? { id: calls.bookId } : null,
      update: async (a: unknown) => { calls.generatedBookUpdate.push(a); return {}; },
    },
    imageAsset: { deleteMany: async (a: unknown) => { calls.imageAssetDeleteMany.push(a); return { count: 1 }; } },
    order: { update: async (a: unknown) => { calls.orderUpdate.push(a); return {}; } },
  };
  return { qe, calls, tx };
});

vi.mock('@/lib/generation-pipeline/readiness-manifest', () => ({
  isReadinessManifestEnabled: () => process.env.READINESS_MANIFEST_ENABLED === 'true',
  withDeliveryInputMutation: async (
    _prisma: unknown,
    _args: unknown,
    cb: (tx: unknown) => Promise<unknown>,
  ) => ({ value: await cb(mocks.tx) }),
}));

import { reserveMarkAndClearRegen } from '@/lib/generation-chunked/clear-page-images-for-regen';

const ev = (key: string) => mocks.qe[key].evidence as Record<string, unknown>;
let prev: string | undefined;
beforeEach(() => {
  prev = process.env.READINESS_MANIFEST_ENABLED;
  process.env.READINESS_MANIFEST_ENABLED = 'true';
  for (const k of Object.keys(mocks.qe)) delete mocks.qe[k];
  mocks.calls.imageAssetDeleteMany.length = 0;
  mocks.calls.generatedBookUpdate.length = 0;
  mocks.calls.orderUpdate.length = 0;
  mocks.calls.bookPages = [{ id: 'pg2' }];
  mocks.calls.bookId = 'b1';
  mocks.qe['page:2'] = { regenCount: 0, evidence: { qaContext: { expectsCompanion: true } }, verdict: 'failed' };
});
afterEach(() => {
  if (prev === undefined) delete process.env.READINESS_MANIFEST_ENABLED;
  else process.env.READINESS_MANIFEST_ENABLED = prev;
});

describe('reserveMarkAndClearRegen (#6-fix-3) — REAL atomic reserve → mark → clear', () => {
  it('budget remaining → reserves (regenCount 0→1), marks regenPending (preserving the real qaContext), clears the page asset', async () => {
    const r = await reserveMarkAndClearRegen({} as never, { orderId: 'o1', artifactKey: 'page:2' });
    expect(r).toEqual({ granted: true });
    expect(mocks.qe['page:2'].regenCount).toBe(1); // DURABLE increment (real conditional update, not a mock counter)
    expect(ev('page:2').regenPending).toBe(true); // durable marker set
    expect(ev('page:2').qaContext).toEqual({ expectsCompanion: true }); // BLOCKER 1: real context preserved
    expect(mocks.calls.imageAssetDeleteMany).toEqual([{ where: { pageId: { in: ['pg2'] } } }]); // asset cleared
  });

  it('budget SPENT (regenCount 2) → granted:false, NO increment, NO mark, NO clear (asset survives → recommit refunds)', async () => {
    mocks.qe['page:2'].regenCount = 2;
    const r = await reserveMarkAndClearRegen({} as never, { orderId: 'o1', artifactKey: 'page:2' });
    expect(r).toEqual({ granted: false });
    expect(mocks.qe['page:2'].regenCount).toBe(2); // unchanged — the conditional reserve declined
    expect(ev('page:2').regenPending).toBeUndefined(); // never marked
    expect(mocks.calls.imageAssetDeleteMany).toEqual([]); // asset NOT destroyed (Blocker 3: reserve BEFORE clear)
  });

  it('reserving exactly consumes the budget: 0→1→2 granted, the 3rd is declined (≤ budget replacements)', async () => {
    const a = await reserveMarkAndClearRegen({} as never, { orderId: 'o1', artifactKey: 'page:2' });
    const b = await reserveMarkAndClearRegen({} as never, { orderId: 'o1', artifactKey: 'page:2' });
    const c = await reserveMarkAndClearRegen({} as never, { orderId: 'o1', artifactKey: 'page:2' });
    expect([a, b, c]).toEqual([{ granted: true }, { granted: true }, { granted: false }]);
    expect(mocks.qe['page:2'].regenCount).toBe(2); // capped at the budget, never higher
  });

  it('cover artifact → nulls the cover (+ order mirror), reserves, marks', async () => {
    mocks.qe['cover'] = { regenCount: 0, evidence: null, verdict: 'failed' };
    const r = await reserveMarkAndClearRegen({} as never, { orderId: 'o1', artifactKey: 'cover' });
    expect(r).toEqual({ granted: true });
    expect(mocks.qe['cover'].regenCount).toBe(1);
    expect(ev('cover').regenPending).toBe(true);
    expect(mocks.calls.generatedBookUpdate).toEqual([{ where: { id: 'b1' }, data: { coverImageUrl: null } }]);
    expect(mocks.calls.orderUpdate).toEqual([{ where: { id: 'o1' }, data: { coverImageUrl: null } }]);
    expect(mocks.calls.imageAssetDeleteMany).toEqual([]);
  });

  it('flag OFF → granted:false, no writes (legacy path unchanged)', async () => {
    process.env.READINESS_MANIFEST_ENABLED = 'false';
    const r = await reserveMarkAndClearRegen({} as never, { orderId: 'o1', artifactKey: 'page:2' });
    expect(r).toEqual({ granted: false });
    expect(mocks.qe['page:2'].regenCount).toBe(0);
    expect(mocks.calls.imageAssetDeleteMany).toEqual([]);
  });

  it('malformed artifact key → granted:false, no clear', async () => {
    const r = await reserveMarkAndClearRegen({} as never, { orderId: 'o1', artifactKey: 'not-a-key' });
    expect(r).toEqual({ granted: false });
    expect(mocks.calls.imageAssetDeleteMany).toEqual([]);
  });
});
