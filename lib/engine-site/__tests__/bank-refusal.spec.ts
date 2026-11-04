import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ order: { findUnique: vi.fn(), update: vi.fn() },
  job: { create: vi.fn(), update: vi.fn() }, chain: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { order: mocks.order, generationJob: mocks.job } }));
vi.mock('@/lib/generation-chunked/env-separation-guard', () => ({ assertEnvSeparation: vi.fn(), assertProdGenerationAllowed: vi.fn() }));
vi.mock('@/lib/generation-chunked/chain-worker', () => ({ chainGenerationWorker: mocks.chain }));
import { startChunkedGeneration } from '@/lib/generation-chunked/start';

beforeEach(() => vi.clearAllMocks());
describe('actual legacy generation start refuses new-engine orders before job creation/chain', () => {
  it.each(['engine-site/v1', 'engine-site/future'])('%s never enters the bank worker as a fallback', async frozenProductVersion => {
    mocks.order.findUnique.mockResolvedValue({ id: 'synthetic_order', frozenProductVersion });
    expect(await startChunkedGeneration('synthetic_order')).toMatchObject({ started: false, message: 'engine_site_requires_personal_worker' });
    expect(mocks.job.create).not.toHaveBeenCalled(); expect(mocks.job.update).not.toHaveBeenCalled();
    expect(mocks.order.update).not.toHaveBeenCalled(); expect(mocks.chain).not.toHaveBeenCalled();
  });
});
