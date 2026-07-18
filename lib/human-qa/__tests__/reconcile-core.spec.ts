import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub the per-order sync so these tests exercise the AGGREGATION + SLA-age math of the shared core alone.
vi.mock('@/lib/human-qa/sync-hold-case', () => ({ syncHumanQaHoldCase: vi.fn() }));

import { reconcileHumanQaHolds } from '@/lib/human-qa/reconcile-core';
import { syncHumanQaHoldCase } from '@/lib/human-qa/sync-hold-case';

const syncSpy = vi.mocked(syncHumanQaHoldCase);

function mkPrisma(orders: Array<{ id: string; updatedAt: Date }>) {
  return { order: { findMany: vi.fn(async () => orders) } } as unknown as Parameters<typeof reconcileHumanQaHolds>[0];
}

beforeEach(() => syncSpy.mockReset());

describe('reconcileHumanQaHolds — shared prod-capable core (P0-B)', () => {
  it('aggregates created / idempotent / skipped-by-reason across orders', async () => {
    const prisma = mkPrisma([
      { id: 'a', updatedAt: new Date('2026-07-18T00:00:00Z') },
      { id: 'b', updatedAt: new Date('2026-07-18T00:00:00Z') },
      { id: 'c', updatedAt: new Date('2026-07-18T00:00:00Z') },
      { id: 'd', updatedAt: new Date('2026-07-18T00:00:00Z') },
    ]);
    syncSpy
      .mockResolvedValueOnce({ action: 'created', kind: 'safety', scope: 'base_book', caseId: 'x' })
      .mockResolvedValueOnce({ action: 'idempotent', kind: 'safety', scope: 'base_book', caseId: 'y' })
      .mockResolvedValueOnce({ action: 'skipped', reason: 'recoverable' })
      .mockResolvedValueOnce({ action: 'skipped', reason: 'exception_case' });

    const s = await reconcileHumanQaHolds(prisma, { now: new Date('2026-07-18T00:01:00Z') });
    expect(s.scanned).toBe(4);
    expect(s.created).toBe(1);
    expect(s.idempotent).toBe(1);
    expect(s.skipped).toEqual({ recoverable: 1, exception_case: 1 });
    expect(s.errors).toHaveLength(0);
  });

  it('oldestMissingCaseAgeMs = age of the oldest order that needed a case created', async () => {
    const now = new Date('2026-07-18T00:10:00Z');
    const prisma = mkPrisma([
      { id: 'young', updatedAt: new Date('2026-07-18T00:09:00Z') }, // 1 min
      { id: 'old', updatedAt: new Date('2026-07-18T00:02:00Z') }, // 8 min — the oldest missing
      { id: 'skipme', updatedAt: new Date('2026-07-18T00:00:00Z') }, // 10 min but SKIPPED → not counted
    ]);
    syncSpy
      .mockResolvedValueOnce({ action: 'created', kind: 'anchor', scope: 'base_book', caseId: '1' })
      .mockResolvedValueOnce({ action: 'created', kind: 'anchor', scope: 'base_book', caseId: '2' })
      .mockResolvedValueOnce({ action: 'skipped', reason: 'recoverable' });
    const s = await reconcileHumanQaHolds(prisma, { now });
    expect(s.created).toBe(2);
    expect(s.oldestMissingCaseAgeMs).toBe(8 * 60 * 1000); // the skipped 10-min order does NOT count
  });

  it('a per-order throw is captured in errors and does not stop the scan', async () => {
    const prisma = mkPrisma([
      { id: 'a', updatedAt: new Date('2026-07-18T00:00:00Z') },
      { id: 'b', updatedAt: new Date('2026-07-18T00:00:00Z') },
    ]);
    syncSpy
      .mockRejectedValueOnce(new Error('tx deadlock'))
      .mockResolvedValueOnce({ action: 'created', kind: 'safety', scope: 'base_book', caseId: 'x' });
    const s = await reconcileHumanQaHolds(prisma, { now: new Date('2026-07-18T00:00:30Z') });
    expect(s.errors).toEqual([{ orderId: 'a', message: 'tx deadlock' }]);
    expect(s.created).toBe(1); // the scan continued past the failing order
  });

  it('flags legacy_unknown backfills for operator triage', async () => {
    const prisma = mkPrisma([{ id: 'lu', updatedAt: new Date('2026-07-18T00:00:00Z') }]);
    syncSpy.mockResolvedValueOnce({ action: 'created', kind: 'legacy_unknown', scope: 'base_book', caseId: 'z' });
    const s = await reconcileHumanQaHolds(prisma, { includeUnknown: true, now: new Date('2026-07-18T00:00:30Z') });
    expect(s.legacyUnknown).toEqual(['lu']);
  });

  it('passes includeUnknown / dryRun through to the per-order sync', async () => {
    const prisma = mkPrisma([{ id: 'a', updatedAt: new Date('2026-07-18T00:00:00Z') }]);
    syncSpy.mockResolvedValueOnce({ action: 'would_create', kind: 'anchor', scope: 'base_book' });
    await reconcileHumanQaHolds(prisma, { includeUnknown: true, dryRun: true, now: new Date() });
    expect(syncSpy).toHaveBeenCalledWith(prisma, 'a', { includeUnknown: true, dryRun: true });
  });
});
