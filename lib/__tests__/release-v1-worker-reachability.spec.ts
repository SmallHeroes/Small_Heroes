import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  probeReleaseV1WorkerReachability,
  RELEASE_V1_WORKER_PROBE_HEADER,
  RELEASE_V1_WORKER_PROBE_VERSION,
} from '@/lib/generation-chunked/release-v1-worker-reachability';

const CONTINUITY = {
  version: 'generation-release-continuity/v1' as const,
  protocol: 'release/v1' as const,
  workerBaseUrl: 'https://fixed-preview.vercel.app',
  workerPath: '/api/release/v1/generate/worker' as const,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('release/v1 protected worker reachability', () => {
  it('uses an exact state-free OPTIONS request with the deployed bypass secret', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
        headers: {
          [RELEASE_V1_WORKER_PROBE_HEADER]:
            RELEASE_V1_WORKER_PROBE_VERSION,
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await probeReleaseV1WorkerReachability(CONTINUITY, {
      VERCEL_AUTOMATION_BYPASS_SECRET: ' exact-bypass ',
    } as unknown as NodeJS.ProcessEnv);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://fixed-preview.vercel.app/api/release/v1/generate/worker',
      expect.objectContaining({
        method: 'OPTIONS',
        redirect: 'manual',
        cache: 'no-store',
        headers: {
          'x-vercel-protection-bypass': 'exact-bypass',
          'x-vercel-set-bypass-cookie': 'false',
        },
      }),
    );
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('body');
  });

  it.each([
    {
      label: 'Vercel SSO redirect',
      response: new Response(null, { status: 302 }),
    },
    {
      label: 'edge unauthorized',
      response: new Response(null, { status: 401 }),
    },
    {
      label: 'missing app marker',
      response: new Response(null, { status: 204 }),
    },
    {
      label: 'wrong app marker',
      response: new Response(null, {
        status: 204,
        headers: { [RELEASE_V1_WORKER_PROBE_HEADER]: 'wrong-version' },
      }),
    },
  ])('rejects $label', async ({ response }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(
      probeReleaseV1WorkerReachability(CONTINUITY, {
        VERCEL_AUTOMATION_BYPASS_SECRET: 'bypass',
      } as unknown as NodeJS.ProcessEnv),
    ).rejects.toThrow('protected reachability probe failed');
  });

  it('rejects a missing secret before network access', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      probeReleaseV1WorkerReachability(
        CONTINUITY,
        {} as unknown as NodeJS.ProcessEnv,
      ),
    ).rejects.toThrow('automation bypass is not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    await expect(
      probeReleaseV1WorkerReachability(CONTINUITY, {
        VERCEL_AUTOMATION_BYPASS_SECRET: 'bypass',
      } as unknown as NodeJS.ProcessEnv),
    ).rejects.toThrow('timeout');
  });

  it('exposes a state-free route marker without invoking worker POST logic', async () => {
    vi.doMock('@/app/api/generate/worker/handler', () => ({
      handleGenerationWorkerPost: vi.fn(),
    }));
    const route = await import('@/app/api/release/v1/generate/worker/route');
    const response = await route.OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get(RELEASE_V1_WORKER_PROBE_HEADER)).toBe(
      RELEASE_V1_WORKER_PROBE_VERSION,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe('');
  });
});
