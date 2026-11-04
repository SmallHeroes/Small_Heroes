import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ order: vi.fn(), start: vi.fn(), worker: vi.fn(), bank: vi.fn(), lease: vi.fn(), chain: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { order: { findUnique: m.order } } }));
vi.mock('@/lib/generation-chunked/env-separation-guard', () => ({ assertProdGenerationAllowed: () => {}, assertEnvSeparation: () => {} }));
vi.mock('@/lib/engine-site/production-worker', () => ({ startProductionPersonalJob: m.start, runProductionPersonalWorker: m.worker }));
vi.mock('@/lib/generation-pipeline/chunk-runner', () => ({ processGenerationChunk: m.bank }));
vi.mock('@/lib/generation-chunked/lease', () => ({ acquireGenerationLease: m.lease, releaseGenerationLease: vi.fn() }));
vi.mock('@/lib/generation-chunked/chain-worker', () => ({ chainGenerationWorker: m.chain }));
import { startChunkedGeneration } from '@/lib/generation-chunked/start';
import { runGenerationWorkerInvocation } from '@/lib/generation-chunked/process-worker';
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('ENGINE_SITE_WORKER_ENABLED', 'true');
  m.order.mockResolvedValue({ id: 'synthetic_order', frozenProductVersion: 'engine-site/v1', status: 'paid', selectionFilename: null, visualPackageAuthority: null });
  m.start.mockResolvedValue({ started: true, created: true }); m.worker.mockResolvedValue({ kind: 'progress', phase: 'story' }); });
afterEach(() => vi.unstubAllEnvs());
describe('actual existing generation entries route by immutable personal protocol', () => {
  it('Q14 schedules a bounded re-poll for a saved background response', async () => {
    m.worker.mockResolvedValueOnce({ kind: 'pending', phase: 'story' });
    await runGenerationWorkerInvocation('synthetic_order');
    expect(m.chain).toHaveBeenCalledWith('synthetic_order', undefined, { delayMs: 15_000 });
  });
  it('routes start and worker to the personal durable implementation before the bank runner/lease', async () => {
    expect(await startChunkedGeneration('synthetic_order')).toMatchObject({ started: true, message: 'engine_site_personal_job_created' });
    expect(m.start).toHaveBeenCalledTimes(1);
    expect(await runGenerationWorkerInvocation('synthetic_order')).toMatchObject({ ok: true, stage: 'story' });
    expect(m.worker).toHaveBeenCalledTimes(1); expect(m.bank).not.toHaveBeenCalled(); expect(m.lease).not.toHaveBeenCalled();
  });
  it('does not self-chain a long step into a300second invocation loop', async () => {
    for (const kind of ['long_step_required']) {
      m.worker.mockResolvedValueOnce({ kind, phase: 'story' });
      await runGenerationWorkerInvocation('synthetic_order');
    }
    expect(m.chain).not.toHaveBeenCalled();
  });
});
