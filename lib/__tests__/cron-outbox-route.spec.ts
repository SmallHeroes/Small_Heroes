import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Wiring test for the Outbox cron (P1-e3). The route is where the worker deps compose for real, and a
 * regression here would pass every lib-level unit test. It pins: (1) recheck forwards row.payloadHash (B4
 * payload binding); (2) the `suppress` dep is present and delegates to suppressAndInvalidateDelivery (B-r3-2
 * atomic invalidation — without it, processDelivery's fallback is invalidation-free); (3) the flag-OFF and
 * auth short-circuits. prisma + the readiness/outbox/email modules are mocked so no env validation runs.
 */
describe('cron/outbox route — worker wiring (B-r3-2 + B4)', () => {
  let savedSecret: string | undefined;
  beforeEach(() => { vi.resetModules(); savedSecret = process.env.CRON_SECRET; });
  afterEach(() => { if (savedSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = savedSecret; });

  const loadRoute = async (readinessOver: Record<string, unknown> = {}) => {
    const recheckBaseBookDelivery = vi.fn(async () => ({ outcome: 'allow' }));
    const suppressAndInvalidateDelivery = vi.fn(async () => true);
    const isReadinessManifestEnabled = vi.fn(() => true);
    let capturedDeps: { recheck: (r: unknown) => unknown; suppress: (a: unknown) => unknown } | undefined;
    const drainOutbox = vi.fn(async (_p: unknown, _o: unknown, deps: typeof capturedDeps) => { capturedDeps = deps; return { claimed: 0, sent: 0, suppressed: 0, failed: 0, retry: 0, lost_lease: 0 }; });
    const sendBookReadyEmail = vi.fn(async () => ({}));
    vi.doMock('@/lib/prisma', () => ({ prisma: { __tag: 'prisma' } }));
    vi.doMock('@/lib/generation-pipeline/readiness-manifest', () => ({ recheckBaseBookDelivery, suppressAndInvalidateDelivery, isReadinessManifestEnabled, ...readinessOver }));
    vi.doMock('@/lib/generation-chunked/delivery-outbox', () => ({ drainOutbox }));
    vi.doMock('@/backend/lib/email', () => ({ sendBookReadyEmail }));
    const mod = await import('@/app/api/generate/cron/outbox/route');
    return { GET: mod.GET, getDeps: () => capturedDeps, recheckBaseBookDelivery, suppressAndInvalidateDelivery, drainOutbox };
  };
  const req = (auth: string | null) => ({ headers: { get: (h: string) => (h === 'authorization' ? auth : null) } }) as never;

  it('recheck forwards row.payloadHash; suppress is present and delegates to suppressAndInvalidateDelivery', async () => {
    process.env.CRON_SECRET = 'secret';
    const t = await loadRoute();
    await t.GET(req('Bearer secret'));
    expect(t.drainOutbox).toHaveBeenCalled();
    const deps = t.getDeps()!;
    await deps.recheck({ orderId: 'o1', scope: 'base_book', payloadHash: 'ph' });
    expect(t.recheckBaseBookDelivery).toHaveBeenCalledWith(expect.anything(), 'o1', 'base_book', {}, 'ph');
    expect(typeof deps.suppress).toBe('function');
    const sArgs = { row: { id: 'ob1', orderId: 'o1', scope: 'base_book' }, token: 2, disposition: { outcome: 'suppress' } };
    await deps.suppress(sArgs);
    expect(t.suppressAndInvalidateDelivery).toHaveBeenCalledWith(expect.anything(), sArgs);
  });

  it('short-circuits (no drain) when READINESS_MANIFEST_ENABLED is off', async () => {
    process.env.CRON_SECRET = 'secret';
    const t = await loadRoute({ isReadinessManifestEnabled: () => false });
    const res = await t.GET(req('Bearer secret'));
    expect(t.drainOutbox).not.toHaveBeenCalled();
    expect((await res.json()).skipped).toBeDefined();
  });

  it('401 on bad auth, 503 without CRON_SECRET — never drains', async () => {
    process.env.CRON_SECRET = 'secret';
    const t = await loadRoute();
    const res401 = await t.GET(req('Bearer wrong'));
    expect(res401.status).toBe(401);
    delete process.env.CRON_SECRET;
    const res503 = await t.GET(req('Bearer secret'));
    expect(res503.status).toBe(503);
    expect(t.drainOutbox).not.toHaveBeenCalled();
  });
});
