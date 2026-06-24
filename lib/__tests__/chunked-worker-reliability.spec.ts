import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * P0 chunked-generation reliability (Codex audit, order cmqs41q7g class): a chain 401 left the job
 * stuck at stage=text — status=running, no lastError, no durable kick — and preview crons don't run,
 * so nothing reclaimed the expired lease. These tests pin the recovery contract.
 */

const ENV_KEYS = [
  'INTERNAL_WORKER_BASE_URL',
  'VERCEL_URL',
  'APP_URL',
  'NEXT_PUBLIC_APP_URL',
  'GENERATION_SECRET',
  'CRON_SECRET',
  'GENERATION_MAX_STALE_RECLAIMS',
];
let snapshot: Record<string, string | undefined>;
beforeEach(() => {
  snapshot = {};
  for (const k of ENV_KEYS) snapshot[k] = process.env[k];
  for (const k of ENV_KEYS) delete process.env[k];
  vi.resetModules();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('resolveInternalWorkerBaseUrl — never chain via NEXT_PUBLIC_APP_URL when an internal target exists', () => {
  async function load() {
    vi.doMock('@/lib/prisma', () => ({ prisma: {} }));
    return (await import('@/lib/generation-chunked/chain-worker')).resolveInternalWorkerBaseUrl;
  }

  it('prefers INTERNAL_WORKER_BASE_URL', async () => {
    process.env.INTERNAL_WORKER_BASE_URL = 'https://internal.example';
    process.env.VERCEL_URL = 'dep.vercel.app';
    process.env.NEXT_PUBLIC_APP_URL = 'https://public.example';
    const fn = await load();
    expect(fn()).toEqual({ url: 'https://internal.example', source: 'INTERNAL_WORKER_BASE_URL', isFallback: false });
  });

  it('prefers VERCEL_URL (own deployment) over NEXT_PUBLIC_APP_URL — and adds https://', async () => {
    process.env.VERCEL_URL = 'dep-abc.vercel.app';
    process.env.NEXT_PUBLIC_APP_URL = 'https://public.example';
    const fn = await load();
    const t = fn();
    expect(t).toEqual({ url: 'https://dep-abc.vercel.app', source: 'VERCEL_URL', isFallback: false });
    expect(t?.url).not.toContain('public.example');
  });

  it('falls back to APP_URL / NEXT_PUBLIC_APP_URL only, flagged isFallback', async () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://public.example';
    const fn = await load();
    expect(fn()).toEqual({ url: 'https://public.example', source: 'APP_URL_FALLBACK', isFallback: true });
  });

  it('returns null when nothing configured', async () => {
    const fn = await load();
    expect(fn()).toBeNull();
  });
});

describe('chainGenerationWorker — a non-OK chain writes a DB-visible diagnostic (never silent)', () => {
  it('records lastChainStatus + lastChainError on a 401 without failing the job', async () => {
    process.env.VERCEL_URL = 'dep-abc.vercel.app';
    process.env.GENERATION_SECRET = 'sek';
    const update = vi.fn(async () => ({}));
    vi.doMock('@/lib/prisma', () => ({ prisma: { generationJob: { update }, order: { update: vi.fn() } } }));
    vi.doMock('@/lib/generation-chunked/env-separation-guard', () => ({ assertEnvSeparation: vi.fn() }));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, text: async () => 'Unauthorized' }))
    );

    const { chainGenerationWorker } = await import('@/lib/generation-chunked/chain-worker');
    chainGenerationWorker('o1');

    type UpdateArg = { data?: { lastChainStatus?: number; lastChainError?: string; status?: string } };
    await vi.waitFor(() => {
      const calls = update.mock.calls as unknown as UpdateArg[][];
      const diag = calls.find((c) => c[0]?.data?.lastChainStatus === 401);
      expect(diag).toBeTruthy();
      expect(diag![0].data!.lastChainError).toContain('401');
    });
    // Never marks the job failed on a chain blip — the sweeper recovers it.
    const calls = update.mock.calls as unknown as UpdateArg[][];
    const failed = calls.find((c) => c[0]?.data?.status === 'failed');
    expect(failed).toBeUndefined();
  });

  it('sends an Authorization: Bearer header (no browser cookies)', async () => {
    process.env.VERCEL_URL = 'dep-abc.vercel.app';
    process.env.GENERATION_SECRET = 'sek';
    const update = vi.fn(async () => ({}));
    vi.doMock('@/lib/prisma', () => ({ prisma: { generationJob: { update }, order: { update: vi.fn(async () => ({})) } } }));
    vi.doMock('@/lib/generation-chunked/env-separation-guard', () => ({ assertEnvSeparation: vi.fn() }));
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    const { chainGenerationWorker } = await import('@/lib/generation-chunked/chain-worker');
    chainGenerationWorker('o1');

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://dep-abc.vercel.app/api/generate/worker');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sek');
    // Let the post-fetch success diagnostic write settle (avoids a dangling rejection).
    await vi.waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ lastChainStatus: 200 }) })
      )
    );
  });
});

describe('worker route auth — Bearer / x-generation-secret / body, always JSON', () => {
  async function loadPost(workerResult = { ok: true, stage: 'text' as const }) {
    process.env.GENERATION_SECRET = 'sek';
    vi.doMock('@/lib/generation-chunked/process-worker', () => ({
      runGenerationWorkerInvocation: vi.fn(async () => workerResult),
    }));
    vi.doMock('@/lib/generation-chunked/env-separation-guard', () => ({
      isProdGenerationDisabled: vi.fn(() => false),
    }));
    return (await import('@/app/api/generate/worker/route')).POST;
  }
  function req(headers: Record<string, string>, body: unknown) {
    return new NextRequest('https://x/api/generate/worker', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  it('accepts Authorization: Bearer', async () => {
    const POST = await loadPost();
    const res = await POST(req({ authorization: 'Bearer sek' }, { orderId: 'o1' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('accepts x-generation-secret header', async () => {
    const POST = await loadPost();
    const res = await POST(req({ 'x-generation-secret': 'sek' }, { orderId: 'o1' }));
    expect(res.status).toBe(200);
  });

  it('accepts body secret (compat)', async () => {
    const POST = await loadPost();
    const res = await POST(req({}, { orderId: 'o1', secret: 'sek' }));
    expect(res.status).toBe(200);
  });

  it('rejects a wrong secret with 401 JSON (never HTML)', async () => {
    const POST = await loadPost();
    const res = await POST(req({ authorization: 'Bearer nope' }, { orderId: 'o1' }));
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect((await res.json()).error).toBe('Unauthorized');
  });
});

describe('cron sweep auth', () => {
  async function loadGet(resumed = 3) {
    vi.doMock('@/lib/generation-chunked/sweeper', () => ({
      sweepStaleGenerationJobs: vi.fn(async () => resumed),
    }));
    vi.doMock('@/lib/child-photo-deletion', () => ({
      sweepPendingChildPhotoDeletions: vi.fn(async () => 0),
    }));
    return (await import('@/app/api/generate/cron/sweep/route')).GET;
  }
  const get = (auth?: string) =>
    new NextRequest('https://x/api/generate/cron/sweep', { headers: auth ? { authorization: auth } : {} });

  it('503 when CRON_SECRET is not configured (never runs open)', async () => {
    const GET = await loadGet();
    expect((await GET(get('Bearer anything'))).status).toBe(503);
  });

  it('401 on wrong token', async () => {
    process.env.CRON_SECRET = 'cron-sek';
    const GET = await loadGet();
    expect((await GET(get('Bearer wrong'))).status).toBe(401);
  });

  it('200 on the right token', async () => {
    process.env.CRON_SECRET = 'cron-sek';
    const GET = await loadGet(5);
    const res = await GET(get('Bearer cron-sek'));
    expect(res.status).toBe(200);
    expect((await res.json()).resumed).toBe(5);
  });
});

describe('sweepStaleGenerationJobs — durable recovery of the cmqs class + anti-infinite-spend', () => {
  function mockPrisma(jobs: Array<Record<string, unknown>>) {
    // The cron describe doMock'd the sweeper module; ensure we import the REAL sweeper here.
    vi.doUnmock('@/lib/generation-chunked/sweeper');
    const update = vi.fn(async () => ({}));
    const orderUpdate = vi.fn(async () => ({}));
    vi.doMock('@/lib/prisma', () => ({
      prisma: {
        generationJob: { findMany: vi.fn(async () => jobs), update },
        order: { update: orderUpdate },
      },
    }));
    return { update, orderUpdate };
  }

  it('reclaims an expired-lease running job with retryable=false and resumes it (the cmqs class)', async () => {
    const { update } = mockPrisma([
      { orderId: 'cmqs', currentStage: 'text', staleReclaimCount: 0, lastReclaimStage: null, completedPageNumbers: [] },
    ]);
    const invoke = vi.fn(async () => ({ ok: true, stage: 'dna' }));
    vi.doMock('@/lib/generation-chunked/process-worker', () => ({ runGenerationWorkerInvocation: invoke }));

    const { sweepStaleGenerationJobs } = await import('@/lib/generation-chunked/sweeper');
    const processed = await sweepStaleGenerationJobs(10);

    expect(invoke).toHaveBeenCalledWith('cmqs');
    expect(processed).toBe(1);
    // Recorded the reclaim (count→1, fingerprint text:0) — not a hard fail.
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ staleReclaimCount: 1, lastReclaimStage: 'text:0' }) })
    );
  });

  it('hard-fails (retryable=false) after max no-progress reclaims instead of re-spending forever', async () => {
    process.env.GENERATION_MAX_STALE_RECLAIMS = '3';
    const { update } = mockPrisma([
      { orderId: 'stuck', currentStage: 'text', staleReclaimCount: 3, lastReclaimStage: 'text:0', completedPageNumbers: [] },
    ]);
    const invoke = vi.fn(async () => ({ ok: true }));
    vi.doMock('@/lib/generation-chunked/process-worker', () => ({ runGenerationWorkerInvocation: invoke }));

    const { sweepStaleGenerationJobs } = await import('@/lib/generation-chunked/sweeper');
    await sweepStaleGenerationJobs(10);

    expect(invoke).not.toHaveBeenCalled(); // stopped re-spending
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed', retryable: false }) })
    );
  });
});
