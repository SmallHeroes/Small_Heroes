import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('cron/exceptions route', () => {
  let savedSecret: string | undefined;

  beforeEach(() => {
    vi.resetModules();
    savedSecret = process.env.CRON_SECRET;
  });
  afterEach(() => {
    if (savedSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = savedSecret;
  });

  async function load(enabled = true) {
    const drainExceptionCases = vi.fn(async () => ({
      synced: 0,
      claimed: 0,
      resolved: 0,
      retry_scheduled: 0,
      refund_pending: 0,
      lost_lease: 0,
    }));
    vi.doMock('@/lib/prisma', () => ({ prisma: { tag: 'prisma' } }));
    vi.doMock('@/lib/generation-chunked/exception-processor', () => ({
      drainExceptionCases,
    }));
    vi.doMock('@/lib/generation-pipeline/readiness-manifest', () => ({
      isReadinessManifestEnabled: () => enabled,
    }));
    const route = await import('@/app/api/generate/cron/exceptions/route');
    return { GET: route.GET, drainExceptionCases };
  }

  const req = (authorization: string | null) => ({
    headers: {
      get: (name: string) => name === 'authorization' ? authorization : null,
    },
  }) as never;

  it('authenticates and processes at most one fenced case per invocation', async () => {
    process.env.CRON_SECRET = 'secret';
    const route = await load();

    const res = await route.GET(req('Bearer secret'));

    expect(res.status).toBe(200);
    expect(route.drainExceptionCases).toHaveBeenCalledWith(
      expect.anything(),
      { limit: 1 },
    );
  });

  it('is inert while the readiness flag is off', async () => {
    process.env.CRON_SECRET = 'secret';
    const route = await load(false);

    const res = await route.GET(req('Bearer secret'));

    expect((await res.json()).skipped).toBe('readiness_manifest_disabled');
    expect(route.drainExceptionCases).not.toHaveBeenCalled();
  });

  it('fails closed on missing or incorrect cron authentication', async () => {
    process.env.CRON_SECRET = 'secret';
    const route = await load();
    expect((await route.GET(req('Bearer wrong'))).status).toBe(401);
    delete process.env.CRON_SECRET;
    expect((await route.GET(req('Bearer secret'))).status).toBe(503);
    expect(route.drainExceptionCases).not.toHaveBeenCalled();
  });
});
