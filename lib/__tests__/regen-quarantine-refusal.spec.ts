import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * (cutover Track 1.3) single-page regen must refuse a terminally-parked order up front (before any render or
 * readiness commit) — this covers the /api/debug/regen-page vector (P1-5a) and every other caller of the lib fn.
 */
const orderFindUnique = vi.fn();
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findUnique: orderFindUnique } } }));
// Readiness OFF so even a bypass could not reach the commit block; the guard fires well before this anyway.
vi.mock('@/lib/generation-pipeline/readiness-manifest', () => ({
  isReadinessManifestEnabled: () => false,
  withDeliveryInputMutation: async (_p: unknown, _a: unknown, cb: (tx: unknown) => unknown) => ({ value: await cb({}) }),
  commitBaseBookReadiness: vi.fn(),
}));

describe('single-page regen refuses a terminally-parked order (cutover 1.3)', () => {
  beforeEach(() => orderFindUnique.mockReset());

  it('throws (404-mapped) for a quarantine_cutover order — never re-renders', async () => {
    orderFindUnique.mockResolvedValue({ id: 'o1', status: 'needs_human_qa', deliveryHoldReason: 'quarantine_cutover:generating', book: { pages: [{ pageNumber: 1, imageAsset: {} }] } });
    const { regenerateSinglePageImage } = await import('@/lib/single-page-image-regen');
    await expect(regenerateSinglePageImage('o1', 1)).rejects.toThrow(/regen refused|not found/i);
  });

  it('throws for safety_hold and contract_world_hold too (shared terminal set)', async () => {
    const { regenerateSinglePageImage } = await import('@/lib/single-page-image-regen');
    for (const marker of ['safety_hold:hazard', 'contract_world_hold:drift']) {
      orderFindUnique.mockResolvedValue({ id: 'o1', status: 'needs_human_qa', deliveryHoldReason: marker, book: { pages: [{ pageNumber: 1, imageAsset: {} }] } });
      await expect(regenerateSinglePageImage('o1', 1)).rejects.toThrow(/regen refused|not found/i);
    }
  });
});
